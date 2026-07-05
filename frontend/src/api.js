import { supabase } from './supabaseClient'

// ─── Helper ───────────────────────────────────────────────────────────────────

async function sb(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersApi = {
  list:   () => sb(supabase.from('users').select('*').order('id')),
  create: (data) => sb(supabase.from('users').insert(data).select().single()),
  delete: (id)   => sb(supabase.from('users').delete().eq('id', id)),
}

// ─── Task requirements ────────────────────────────────────────────────────────

export const requirementsApi = {
  list:   (taskId)       => sb(supabase.from('task_requirements').select('*').eq('task_id', taskId).order('sort_order')),
  create: (taskId, data) => sb(supabase.from('task_requirements').insert({ ...data, task_id: taskId }).select().single()),
  delete: (reqId)        => sb(supabase.from('task_requirements').delete().eq('id', reqId)),
}

// ─── Collections ──────────────────────────────────────────────────────────────

export const collectionsApi = {
  list:        ()          => sb(supabase.from('collections').select('*').order('name')),
  create:      (data)      => sb(supabase.from('collections').insert(data).select().single()),
  update:      (id, data)  => sb(supabase.from('collections').update(data).eq('id', id).select().single()),
  delete:      (id)        => sb(supabase.from('collections').delete().eq('id', id)),
  listItems:   (cid)       => sb(supabase.from('collection_items').select('*').eq('collection_id', cid).order('name')),
  createItem:  (cid, data) => sb(supabase.from('collection_items').insert({ ...data, collection_id: cid }).select().single()),
  updateItem:  (id, data)  => sb(supabase.from('collection_items').update(data).eq('id', id).select().single()),
  deleteItem:  (id)        => sb(supabase.from('collection_items').delete().eq('id', id)),
  markOwned:   (id, data)  => sb(supabase.from('collection_items').update({ is_owned: true, ...data }).eq('id', id).select().single()),
  unmarkOwned: (id)        => sb(supabase.from('collection_items').update({ is_owned: false }).eq('id', id).select().single()),
}

// ─── Task categories ──────────────────────────────────────────────────────────

export const categoriesApi = {
  list:   () => sb(supabase.from('task_categories').select('*').order('name')),
  create: (data) => sb(supabase.from('task_categories').insert(data).select().single()),
  delete: (id)   => sb(supabase.from('task_categories').delete().eq('id', id)),
}

// ─── Inventory ────────────────────────────────────────────────────────────────

const INVENTORY_SELECT = '*, batches:inventory_batches(id, quantity, unit, best_before_date, purchase_date, purchase_price, store, notes, added_at)'

export const inventoryApi = {
  list: (params = {}) => {
    let q = supabase.from('inventory_items').select(INVENTORY_SELECT).order('name')
    if (params.status)   q = q.eq('status', params.status)
    if (params.category) q = q.eq('category', params.category)
    if (params.q)        q = q.ilike('name', `%${params.q}%`)
    return sb(q)
  },
  get:     (id)       => sb(supabase.from('inventory_items').select(INVENTORY_SELECT).eq('id', id).single()),
  create:  (data)     => sb(supabase.from('inventory_items').insert(data).select(INVENTORY_SELECT).single()),
  update:  (id, data) => sb(supabase.from('inventory_items').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select(INVENTORY_SELECT).single()),
  delete:  (id)       => sb(supabase.from('inventory_items').delete().eq('id', id)),
  remove:  (id, data) => sb(supabase.from('inventory_items').update({ status: 'consumed', removed_at: new Date().toISOString(), ...data }).eq('id', id).select(INVENTORY_SELECT).single()),
  restore: (id)       => sb(supabase.from('inventory_items').update({ status: 'active', removed_at: null, removal_notes: null }).eq('id', id).select(INVENTORY_SELECT).single()),

  addBatch:    (itemId, data) => sb(supabase.from('inventory_batches').insert({ ...data, item_id: itemId }).select().single()),
  updateBatch: (id, data)     => sb(supabase.from('inventory_batches').update(data).eq('id', id).select().single()),
  deleteBatch: (id)           => sb(supabase.from('inventory_batches').delete().eq('id', id)),
}

// ─── Purchases (expense tracker) ─────────────────────────────────────────────

export const purchasesApi = {
  list:       (params = {}) => {
    let q = supabase.from('purchases').select('*, purchase_items(*)').order('purchased_at', { ascending: false })
    if (params.store) q = q.eq('store', params.store)
    return sb(q)
  },
  get:        (id)       => sb(supabase.from('purchases').select('*, purchase_items(*)').eq('id', id).single()),
  create:     (data)     => sb(supabase.from('purchases').insert(data).select().single()),
  update:     (id, data) => sb(supabase.from('purchases').update(data).eq('id', id).select().single()),
  delete:     (id)       => sb(supabase.from('purchases').delete().eq('id', id)),
  addItem:    (id, data) => sb(supabase.from('purchase_items').insert({ ...data, purchase_id: id }).select().single()),
  updateItem: (id, data) => sb(supabase.from('purchase_items').update(data).eq('id', id).select().single()),
  deleteItem: (id)       => sb(supabase.from('purchase_items').delete().eq('id', id)),
}

// ─── Shopping ─────────────────────────────────────────────────────────────────

async function listWithItems(id) {
  const lst  = await sb(supabase.from('shopping_lists').select('*').eq('id', id).single())
  const items = await sb(supabase.from('shopping_items')
    .select('*, added_by_user:users!added_by(name), checked_by_user:users!checked_by(name)')
    .eq('list_id', id).order('added_at'))
  return { ...lst, items }
}

export const shoppingApi = {
  lists: (params = {}) => {
    let q = supabase.from('shopping_lists').select('*, shopping_items(id, is_checked)').order('created_at', { ascending: false })
    if (params.archived !== undefined)
      q = q.eq('is_archived', params.archived === 'true' || params.archived === true)
    else
      q = q.eq('is_archived', false)
    return sb(q).then(lists => lists.map(l => ({
      ...l,
      item_count:    l.shopping_items?.length ?? 0,
      checked_count: l.shopping_items?.filter(i => i.is_checked).length ?? 0,
      shopping_items: undefined,
    })))
  },
  getList:     (id)       => listWithItems(id),
  createList:  (data)     => sb(supabase.from('shopping_lists').insert(data).select().single()),
  updateList:  (id, data) => sb(supabase.from('shopping_lists').update(data).eq('id', id).select().single()),
  deleteList:  (id)       => sb(supabase.from('shopping_lists').delete().eq('id', id)),
  archiveList: (id)       => sb(supabase.from('shopping_lists').update({ is_archived: true, completed_at: new Date().toISOString() }).eq('id', id).select().single()),

  newTrip: async (id) => {
    const tripId = await sb(supabase.rpc('new_shopping_trip', { p_template_id: id }))
    return listWithItems(tripId)
  },
  listTrips: (id) => sb(supabase.from('shopping_lists').select('*, shopping_items(id, is_checked)').eq('template_id', id).eq('is_archived', true).order('completed_at', { ascending: false }))
    .then(trips => trips.map(t => ({
      ...t,
      item_count:    t.shopping_items?.length ?? 0,
      checked_count: t.shopping_items?.filter(i => i.is_checked).length ?? 0,
      shopping_items: undefined,
    }))),

  recordPurchase: async (id, data) => {
    const purchaseId = await sb(supabase.rpc('record_shopping_purchase', {
      p_list_id:        id,
      p_purchased_ids:  data.purchased_ids  ?? [],
      p_carry_back_ids: data.carry_back_ids ?? [],
      p_notes:          data.notes ?? null,
    }))
    const rec = await sb(supabase.from('purchase_records').select('*, purchase_record_items(*)').eq('id', purchaseId).single())
    return rec
  },
  listPurchases: (params = {}) => {
    let q = supabase.from('purchase_records').select('*, purchase_record_items(*)').order('purchased_at', { ascending: false })
    if (params.list_id)   q = q.eq('list_id', params.list_id)
    if (params.store_name) q = q.eq('store_name', params.store_name)
    return sb(q)
  },

  addItem:    (listId, data) => sb(supabase.from('shopping_items').insert({ ...data, list_id: listId }).select().single()),
  updateItem: (id, data)     => sb(supabase.from('shopping_items').update(data).eq('id', id).select().single()),
  deleteItem: (id)           => sb(supabase.from('shopping_items').delete().eq('id', id)),
  checkItem:  async (id, data) => {
    const checked = data.is_checked
    const update = checked
      ? { is_checked: true,  checked_by: data.checked_by ?? null, checked_at: new Date().toISOString() }
      : { is_checked: false, checked_by: null, checked_at: null }
    return sb(supabase.from('shopping_items').update(update).eq('id', id).select().single())
  },
  library:        (store) => {
    let q = supabase.from('store_item_library').select('*').order('item_name')
    if (store) q = q.eq('store_name', store)
    return sb(q)
  },
  addLibraryItem: (data) => sb(supabase.from('store_item_library').insert(data).select().single()),
  delLibraryItem: (id)   => sb(supabase.from('store_item_library').delete().eq('id', id)),
}

// ─── Meals ────────────────────────────────────────────────────────────────────

async function mealWithRatings(id) {
  const meal    = await sb(supabase.from('meals').select('*, meal_ingredients(*), meal_ratings(*), meal_history(*)').eq('id', id).single())
  return meal
}

export const mealsApi = {
  list: (params = {}) => {
    let q = supabase.from('meals').select('*, meal_ratings(*), meal_history(id, made_at)').order('name')
    if (params.category) q = q.eq('category', params.category)
    if (params.q)        q = q.ilike('name', `%${params.q}%`)
    return sb(q)
  },
  create:  (data)     => sb(supabase.from('meals').insert(data).select().single()),
  update:  (id, data) => sb(supabase.from('meals').update(data).eq('id', id).select().single()),
  delete:  (id)       => sb(supabase.from('meals').delete().eq('id', id)),

  rate: async (id, data) => {
    await sb(supabase.rpc('upsert_meal_rating', {
      p_meal_id: id,
      p_user_id: data.user_id,
      p_rating:  data.rating,
    }))
    return mealWithRatings(id)
  },

  addHistory: (id, data) => sb(supabase.from('meal_history').insert({ ...data, meal_id: id }).select().single()),

  saveIngredients: async (id, ings) => {
    await sb(supabase.from('meal_ingredients').delete().eq('meal_id', id))
    if (ings.length) {
      await sb(supabase.from('meal_ingredients').insert(ings.map((g, i) => ({ ...g, meal_id: id, sort_order: i }))))
    }
    return mealWithRatings(id)
  },

  listTry:   () => sb(supabase.from('meals_to_try').select('*, proposed_by_user:users!proposed_by(name), meal_try_votes(*)').order('proposed_at', { ascending: false })),
  createTry: (data) => sb(supabase.from('meals_to_try').insert(data).select().single()),
  deleteTry: (id)   => sb(supabase.from('meals_to_try').delete().eq('id', id)),

  vote: async (id, data) => {
    await sb(supabase.rpc('upsert_meal_try_vote', {
      p_meal_try_id: id,
      p_user_id:     data.user_id,
      p_vote:        data.vote,
    }))
  },

  promote: async (id, data) => {
    const meal = await sb(supabase.from('meals').insert(data).select().single())
    await sb(supabase.from('meals_to_try').update({ promoted_meal_id: meal.id }).eq('id', id))
    return meal
  },

  listRestaurants:  () => sb(supabase.from('restaurants').select('*, restaurant_ratings(*), restaurant_visits(id, visited_at)').order('name')),
  createRestaurant: (data)     => sb(supabase.from('restaurants').insert(data).select().single()),
  updateRestaurant: (id, data) => sb(supabase.from('restaurants').update(data).eq('id', id).select().single()),
  deleteRestaurant: (id)       => sb(supabase.from('restaurants').delete().eq('id', id)),

  rateRestaurant: async (id, data) => {
    await sb(supabase.rpc('upsert_restaurant_rating', {
      p_restaurant_id: id,
      p_user_id:       data.user_id,
      p_rating:        data.rating,
    }))
  },

  listVisits:  (id)       => sb(supabase.from('restaurant_visits').select('*').eq('restaurant_id', id).order('visited_at', { ascending: false })),
  createVisit: (id, data) => sb(supabase.from('restaurant_visits').insert({ ...data, restaurant_id: id }).select().single()),

  getWeekPlan: async (ws) => {
    const slots = await sb(
      supabase.from('meal_plan_slots')
        .select(`*, meal:meals(id,name,photo_path,meal_ratings(*)), restaurant:restaurants(id,name), cook:users!cook_id(id,name), attendees:meal_plan_slot_attendees(user_id, user:users(id,name))`)
        .eq('week_start', ws)
    )
    // Reshape into { week_start, slots: { [day]: { [type]: slot } } }
    const shaped = {}
    for (const s of slots) {
      if (!shaped[s.day_of_week]) shaped[s.day_of_week] = {}
      shaped[s.day_of_week][s.meal_type] = {
        ...s,
        ratings:   s.meal?.meal_ratings ?? [],
        attendees: s.attendees?.map(a => a.user) ?? [],
      }
    }
    return { week_start: ws, slots: shaped }
  },

  updateSlot: async (ws, day, mt, data) => {
    await sb(supabase.rpc('upsert_meal_plan_slot', {
      p_week_start:     ws,
      p_day_of_week:    Number(day),
      p_meal_type:      mt,
      p_slot_type:      data.slot_type      ?? 'empty',
      p_meal_id:        data.meal_id        ?? null,
      p_restaurant_id:  data.restaurant_id  ?? null,
      p_leftovers_note: data.leftovers_note ?? null,
      p_cook_id:        data.cook_id        ?? null,
      p_attendee_ids:   data.attendees       ?? null,
    }))
  },
}

// ─── Adventures ───────────────────────────────────────────────────────────────

async function venuesWithRooms(cityId) {
  const venues = await sb(supabase.from('escape_room_venues').select(`
    *,
    rooms:escape_rooms(
      *,
      completions:escape_room_completions(
        *,
        users:escape_room_completion_users(user_id, user:users(id,name)),
        friends:escape_room_completion_friends(friend_id, friend:friends(id,first_name,last_name))
      )
    )
  `).eq('city_id', cityId).order('name'))

  return venues.map(v => {
    const allCompletions = v.rooms.flatMap(r => r.completions ?? [])
    return {
      ...v,
      room_count:      v.rooms.length,
      rooms_completed: v.rooms.filter(r => (r.completions?.length ?? 0) > 0).length,
      rooms: v.rooms.map(r => ({
        ...r,
        total_completions: r.completions?.length ?? 0,
        last_played_at:    r.completions?.length
          ? r.completions.sort((a,b) => (b.played_at??'').localeCompare(a.played_at??''))[0].played_at
          : null,
        last_escaped: r.completions?.length
          ? r.completions.sort((a,b) => (b.played_at??'').localeCompare(a.played_at??''))[0].escaped
          : null,
        completions: r.completions?.map(c => ({
          ...c,
          users:   c.users?.map(u => u.user)   ?? [],
          friends: c.friends?.map(f => f.friend) ?? [],
        })) ?? [],
      })),
    }
  })
}

export const adventuresApi = {
  listCities:  () => sb(supabase.from('cities').select('*').order('name')),
  createCity:  (data) => sb(supabase.from('cities').insert(data).select().single()),

  listVenues:  (cityId) => venuesWithRooms(cityId),
  createVenue: (data)   => sb(supabase.from('escape_room_venues').insert(data).select().single()),
  updateVenue: (id, data) => sb(supabase.from('escape_room_venues').update(data).eq('id', id).select().single()),
  deleteVenue: (id)       => sb(supabase.from('escape_room_venues').delete().eq('id', id)),

  listRooms:   (venueId) => sb(supabase.from('escape_rooms').select('*').eq('venue_id', venueId).order('name')),
  createRoom:  (data)    => sb(supabase.from('escape_rooms').insert(data).select().single()),
  updateRoom:  (id, data) => sb(supabase.from('escape_rooms').update(data).eq('id', id).select().single()),
  deleteRoom:  (id)       => sb(supabase.from('escape_rooms').delete().eq('id', id)),

  filterRooms: async (params) => {
    const result = await sb(supabase.rpc('filter_escape_rooms', {
      p_city_id:    Number(params.city_id),
      p_user_ids:   params.user_ids   ? params.user_ids.split(',').map(Number).filter(Boolean)   : [],
      p_friend_ids: params.friend_ids ? params.friend_ids.split(',').map(Number).filter(Boolean) : [],
      p_mode:       params.mode ?? 'new',
    }))
    return result ?? []
  },

  listCompletions: async (roomId) => {
    const rows = await sb(supabase.from('escape_room_completions').select(`
      *,
      users:escape_room_completion_users(user_id, user:users(id,name)),
      friends:escape_room_completion_friends(friend_id, friend:friends(id,first_name,last_name))
    `).eq('room_id', roomId).order('played_at', { ascending: false }))
    return rows.map(c => ({
      ...c,
      users:   c.users?.map(u => u.user)   ?? [],
      friends: c.friends?.map(f => f.friend) ?? [],
    }))
  },

  addCompletion: async (roomId, data) => {
    const { user_ids, friend_ids, ...rest } = data
    const comp = await sb(supabase.from('escape_room_completions').insert({ ...rest, room_id: roomId }).select().single())
    if (user_ids?.length)
      await sb(supabase.from('escape_room_completion_users').insert(user_ids.map(uid => ({ completion_id: comp.id, user_id: uid }))))
    if (friend_ids?.length)
      await sb(supabase.from('escape_room_completion_friends').insert(friend_ids.map(fid => ({ completion_id: comp.id, friend_id: fid }))))
    return comp
  },

  updateCompletion: async (id, data) => {
    const { user_ids, friend_ids, ...rest } = data
    const comp = await sb(supabase.from('escape_room_completions').update(rest).eq('id', id).select().single())
    if (user_ids !== undefined) {
      await sb(supabase.from('escape_room_completion_users').delete().eq('completion_id', id))
      if (user_ids.length)
        await sb(supabase.from('escape_room_completion_users').insert(user_ids.map(uid => ({ completion_id: id, user_id: uid }))))
    }
    if (friend_ids !== undefined) {
      await sb(supabase.from('escape_room_completion_friends').delete().eq('completion_id', id))
      if (friend_ids.length)
        await sb(supabase.from('escape_room_completion_friends').insert(friend_ids.map(fid => ({ completion_id: id, friend_id: fid }))))
    }
    return comp
  },

  deleteCompletion: (id) => sb(supabase.from('escape_room_completions').delete().eq('id', id)),

  listFriends:  () => sb(supabase.from('friends').select('*').order('first_name')),
  createFriend: (data)     => sb(supabase.from('friends').insert(data).select().single()),
  updateFriend: (id, data) => sb(supabase.from('friends').update(data).eq('id', id).select().single()),
  deleteFriend: (id)       => sb(supabase.from('friends').delete().eq('id', id)),

  getPrefs:  (userId) => sb(supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle()).then(r => r ?? {}),
  savePrefs: async (userId, data) => {
    await sb(supabase.from('user_preferences').upsert({ user_id: userId, ...data }))
  },
}

// ─── Mini Golf ────────────────────────────────────────────────────────────────

export const miniGolfApi = {
  listVenues:  (cityId) => sb(supabase.from('mini_golf_venues').select('*').eq('city_id', cityId).order('name')),
  createVenue: (data)   => sb(supabase.from('mini_golf_venues').insert(data).select().single()),
  updateVenue: (id, data) => sb(supabase.from('mini_golf_venues').update(data).eq('id', id).select().single()),
  deleteVenue: (id)       => sb(supabase.from('mini_golf_venues').delete().eq('id', id)),

  listCourses:  (venueId) => sb(supabase.from('mini_golf_courses').select('*').eq('venue_id', venueId).order('name')),
  createCourse: (data)    => sb(supabase.from('mini_golf_courses').insert(data).select().single()),
  updateCourse: (id, data) => sb(supabase.from('mini_golf_courses').update(data).eq('id', id).select().single()),
  deleteCourse: (id)       => sb(supabase.from('mini_golf_courses').delete().eq('id', id)),

  listSessions: (courseId) => sb(supabase.from('mini_golf_sessions').select(`
    *,
    users:mini_golf_session_users(user_id, user:users(id,name)),
    friends:mini_golf_session_friends(friend_id, friend:friends(id,first_name,last_name)),
    scores:mini_golf_scores(*),
    ratings:mini_golf_ratings(*)
  `).eq('course_id', courseId).order('played_at', { ascending: false })),

  addSession: async (courseId, data) => {
    const { user_ids, friend_ids, scores, ...rest } = data
    const session = await sb(supabase.from('mini_golf_sessions').insert({ ...rest, course_id: courseId }).select().single())
    if (user_ids?.length)
      await sb(supabase.from('mini_golf_session_users').insert(user_ids.map(uid => ({ session_id: session.id, user_id: uid }))))
    if (friend_ids?.length)
      await sb(supabase.from('mini_golf_session_friends').insert(friend_ids.map(fid => ({ session_id: session.id, friend_id: fid }))))
    if (scores?.length)
      await sb(supabase.from('mini_golf_scores').insert(scores.map(s => ({ ...s, session_id: session.id }))))
    return session
  },

  updateSession: (id, data) => sb(supabase.from('mini_golf_sessions').update(data).eq('id', id).select().single()),
  deleteSession: (id)       => sb(supabase.from('mini_golf_sessions').delete().eq('id', id)),
}

// ─── Bowling ──────────────────────────────────────────────────────────────────

export const bowlingApi = {
  listVenues:  (cityId) => sb(supabase.from('bowling_venues').select('*').eq('city_id', cityId).order('name')),
  createVenue: (data)   => sb(supabase.from('bowling_venues').insert(data).select().single()),
  updateVenue: (id, data) => sb(supabase.from('bowling_venues').update(data).eq('id', id).select().single()),
  deleteVenue: (id)       => sb(supabase.from('bowling_venues').delete().eq('id', id)),

  listSessions: (venueId) => sb(supabase.from('bowling_sessions').select(`
    *,
    users:bowling_session_users(user_id, user:users(id,name)),
    friends:bowling_session_friends(friend_id, friend:friends(id,first_name,last_name)),
    scores:bowling_scores(*),
    ratings:bowling_ratings(*)
  `).eq('venue_id', venueId).order('played_at', { ascending: false })),

  addSession: async (venueId, data) => {
    const { user_ids, friend_ids, scores, ...rest } = data
    const session = await sb(supabase.from('bowling_sessions').insert({ ...rest, venue_id: venueId }).select().single())
    if (user_ids?.length)
      await sb(supabase.from('bowling_session_users').insert(user_ids.map(uid => ({ session_id: session.id, user_id: uid }))))
    if (friend_ids?.length)
      await sb(supabase.from('bowling_session_friends').insert(friend_ids.map(fid => ({ session_id: session.id, friend_id: fid }))))
    if (scores?.length)
      await sb(supabase.from('bowling_scores').insert(scores.map(s => ({ ...s, session_id: session.id }))))
    return session
  },

  updateSession: (id, data) => sb(supabase.from('bowling_sessions').update(data).eq('id', id).select().single()),
  deleteSession: (id)       => sb(supabase.from('bowling_sessions').delete().eq('id', id)),
}

// ─── Movies ───────────────────────────────────────────────────────────────────

export const moviesApi = {
  list: (q) => {
    let query = supabase.from('movies').select('*, movie_viewings(id, viewed_at)').order('title')
    if (q) query = query.ilike('title', `%${q}%`)
    return sb(query)
  },
  create: (data)     => sb(supabase.from('movies').insert(data).select().single()),
  update: (id, data) => sb(supabase.from('movies').update(data).eq('id', id).select().single()),
  delete: (id)       => sb(supabase.from('movies').delete().eq('id', id)),

  listViewings: (movieId) => sb(supabase.from('movie_viewings').select(`
    *,
    users:movie_viewing_users(user_id, user:users(id,name)),
    friends:movie_viewing_friends(friend_id, friend:friends(id,first_name,last_name)),
    ratings:movie_viewing_ratings(*)
  `).eq('movie_id', movieId).order('viewed_at', { ascending: false })),

  addViewing: async (movieId, data) => {
    const { user_ids, friend_ids, ratings, ...rest } = data
    const viewing = await sb(supabase.from('movie_viewings').insert({ ...rest, movie_id: movieId }).select().single())
    if (user_ids?.length)
      await sb(supabase.from('movie_viewing_users').insert(user_ids.map(uid => ({ viewing_id: viewing.id, user_id: uid }))))
    if (friend_ids?.length)
      await sb(supabase.from('movie_viewing_friends').insert(friend_ids.map(fid => ({ viewing_id: viewing.id, friend_id: fid }))))
    if (ratings?.length)
      await sb(supabase.from('movie_viewing_ratings').insert(ratings.map(r => ({ ...r, viewing_id: viewing.id }))))
    return viewing
  },

  updateViewing: (id, data) => sb(supabase.from('movie_viewings').update(data).eq('id', id).select().single()),
  deleteViewing: (id)       => sb(supabase.from('movie_viewings').delete().eq('id', id)),
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasksApi = {
  list: (params = {}) => {
    let q = supabase.from('tasks')
      .select('*, task_completions(id, completed_at, completed_by), assigned_user:users!assigned_to(id, name), parent:tasks!parent_task_id(title)')
      .order('sort_order', { nullsFirst: false })
      .order('title')
    if (params.category)  q = q.eq('category', params.category)
    if (params.is_active !== undefined) q = q.eq('is_active', params.is_active !== 'false')
    return sb(q).then(rows => rows.map(t => ({
      ...t,
      assigned_to_name: t.assigned_user?.name ?? null,
      parent_title:     t.parent?.title ?? null,
      assigned_user:    undefined,
      parent:           undefined,
    })))
  },
  get:    (id)       => sb(supabase.from('tasks').select('*, task_completions(*), task_requirements(*)').eq('id', id).single()),
  create: (data)     => sb(supabase.from('tasks').insert(data).select().single()),
  update: (id, data) => sb(supabase.from('tasks').update(data).eq('id', id).select().single()),
  delete: (id)       => sb(supabase.from('tasks').delete().eq('id', id)),

  listCompletions: (id)       => sb(supabase.from('task_completions').select('*').eq('task_id', id).order('completed_at', { ascending: false })),
  addCompletion:   (id, data) => sb(supabase.from('task_completions').insert({ ...data, task_id: id }).select().single()),
  updateCompletion:(id, data) => sb(supabase.from('task_completions').update(data).eq('id', id).select().single()),
  deleteCompletion:(id)       => sb(supabase.from('task_completions').delete().eq('id', id)),
}
