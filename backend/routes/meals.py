from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('meals', __name__)


# ─── helpers ─────────────────────────────────────────────────────────────────

def meal_detail(db, meal_id):
    meal = db.execute("SELECT * FROM meals WHERE id = ?", (meal_id,)).fetchone()
    if not meal:
        return None
    d = dict(meal)
    d['ratings'] = {
        str(r['user_id']): r['rating']
        for r in db.execute("SELECT user_id, rating FROM meal_ratings WHERE meal_id = ?", (meal_id,)).fetchall()
    }
    last = db.execute(
        "SELECT made_at FROM meal_history WHERE meal_id = ? ORDER BY made_at DESC LIMIT 1",
        (meal_id,)
    ).fetchone()
    d['last_made_at'] = last['made_at'] if last else None
    d['ingredients'] = [dict(r) for r in db.execute(
        "SELECT * FROM meal_ingredients WHERE meal_id = ? ORDER BY sort_order, id",
        (meal_id,)
    ).fetchall()]
    return d


def restaurant_detail(db, rid):
    r = db.execute("SELECT * FROM restaurants WHERE id = ?", (rid,)).fetchone()
    if not r:
        return None
    d = dict(r)
    d['ratings'] = {
        str(row['user_id']): row['rating']
        for row in db.execute(
            "SELECT user_id, rating FROM restaurant_ratings WHERE restaurant_id = ?", (rid,)
        ).fetchall()
    }
    return d


# ─── Meal library ─────────────────────────────────────────────────────────────

@bp.route('/meals', methods=['GET'])
def list_meals():
    db = get_db()
    query = "SELECT * FROM meals WHERE 1=1"
    params = []
    cat = request.args.get('category')
    if cat:
        query += " AND category = ?"
        params.append(cat)
    query += " ORDER BY name"
    meals = []
    for row in db.execute(query, params).fetchall():
        meals.append(meal_detail(db, row['id']))
    return jsonify(meals)


@bp.route('/meals', methods=['POST'])
def create_meal():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        """INSERT INTO meals (name, description, photo_path, category, recipe, min_frequency_days)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (data.get('name'), data.get('description'), data.get('photo_path'),
         data.get('category'), data.get('recipe'), data.get('min_frequency_days', 0))
    )
    db.commit()
    return jsonify(meal_detail(db, cur.lastrowid)), 201


@bp.route('/meals/<int:meal_id>', methods=['GET'])
def get_meal(meal_id):
    db = get_db()
    d = meal_detail(db, meal_id)
    if not d:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(d)


@bp.route('/meals/<int:meal_id>', methods=['PUT'])
def update_meal(meal_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM meals WHERE id = ?", (meal_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404
    allowed = {'name', 'description', 'photo_path', 'category', 'recipe', 'min_frequency_days'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE meals SET {set_clause} WHERE id = ?",
                   list(updates.values()) + [meal_id])
        db.commit()
    return jsonify(meal_detail(db, meal_id))


@bp.route('/meals/<int:meal_id>', methods=['DELETE'])
def delete_meal(meal_id):
    db = get_db()
    db.execute("DELETE FROM meals WHERE id = ?", (meal_id,))
    db.commit()
    return '', 204


@bp.route('/meals/<int:meal_id>/ingredients', methods=['PUT'])
def save_ingredients(meal_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM meals WHERE id = ?", (meal_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404
    db.execute("DELETE FROM meal_ingredients WHERE meal_id = ?", (meal_id,))
    for i, ing in enumerate(data.get('ingredients') or []):
        name = (ing.get('name') or '').strip()
        if name:
            db.execute(
                "INSERT INTO meal_ingredients (meal_id, name, quantity, unit, sort_order) VALUES (?,?,?,?,?)",
                (meal_id, name, ing.get('quantity') or None, ing.get('unit') or None, i)
            )
    db.commit()
    return jsonify(meal_detail(db, meal_id))


@bp.route('/meals/<int:meal_id>/ratings', methods=['POST'])
def rate_meal(meal_id):
    data = request.get_json()
    db = get_db()
    db.execute(
        """INSERT INTO meal_ratings (meal_id, user_id, rating, rated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(meal_id, user_id) DO UPDATE SET rating=excluded.rating, rated_at=excluded.rated_at""",
        (meal_id, data['user_id'], data['rating'])
    )
    db.commit()
    return jsonify(meal_detail(db, meal_id))


@bp.route('/meals/<int:meal_id>/history', methods=['GET'])
def list_meal_history(meal_id):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM meal_history WHERE meal_id = ? ORDER BY made_at DESC",
        (meal_id,)
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route('/meals/<int:meal_id>/history', methods=['POST'])
def add_meal_history(meal_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM meals WHERE id = ?", (meal_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404
    cur = db.execute(
        "INSERT INTO meal_history (meal_id, made_at, notes) VALUES (?, ?, ?)",
        (meal_id, data.get('made_at'), data.get('notes'))
    )
    db.commit()
    return jsonify(dict(db.execute("SELECT * FROM meal_history WHERE id = ?", (cur.lastrowid,)).fetchone())), 201


@bp.route('/meals/history/<int:history_id>', methods=['DELETE'])
def delete_meal_history(history_id):
    db = get_db()
    db.execute("DELETE FROM meal_history WHERE id = ?", (history_id,))
    db.commit()
    return '', 204


# ─── Meals to try ─────────────────────────────────────────────────────────────

def try_detail(db, try_id):
    row = db.execute("SELECT * FROM meals_to_try WHERE id = ?", (try_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    votes = db.execute(
        "SELECT user_id, vote FROM meal_try_votes WHERE meal_try_id = ?", (try_id,)
    ).fetchall()
    d['votes'] = {str(v['user_id']): v['vote'] for v in votes}
    return d


@bp.route('/meals/try', methods=['GET'])
def list_try():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM meals_to_try WHERE promoted_meal_id IS NULL ORDER BY proposed_at DESC"
    ).fetchall()
    return jsonify([try_detail(db, r['id']) for r in rows])


@bp.route('/meals/try', methods=['POST'])
def create_try():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO meals_to_try (name, description, photo_path, proposed_by) VALUES (?, ?, ?, ?)",
        (data.get('name'), data.get('description'), data.get('photo_path'), data.get('proposed_by'))
    )
    db.commit()
    return jsonify(try_detail(db, cur.lastrowid)), 201


@bp.route('/meals/try/<int:try_id>', methods=['GET'])
def get_try(try_id):
    db = get_db()
    d = try_detail(db, try_id)
    if not d:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(d)


@bp.route('/meals/try/<int:try_id>', methods=['PUT'])
def update_try(try_id):
    data = request.get_json()
    db = get_db()
    allowed = {'name', 'description', 'photo_path'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE meals_to_try SET {set_clause} WHERE id = ?",
                   list(updates.values()) + [try_id])
        db.commit()
    d = try_detail(db, try_id)
    if not d:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(d)


@bp.route('/meals/try/<int:try_id>', methods=['DELETE'])
def delete_try(try_id):
    db = get_db()
    db.execute("DELETE FROM meals_to_try WHERE id = ?", (try_id,))
    db.commit()
    return '', 204


@bp.route('/meals/try/<int:try_id>/vote', methods=['POST'])
def vote_try(try_id):
    data = request.get_json()
    db = get_db()
    db.execute(
        """INSERT INTO meal_try_votes (meal_try_id, user_id, vote, voted_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(meal_try_id, user_id) DO UPDATE SET vote=excluded.vote, voted_at=excluded.voted_at""",
        (try_id, data['user_id'], data['vote'])
    )
    db.commit()
    return jsonify(try_detail(db, try_id))


@bp.route('/meals/try/<int:try_id>/promote', methods=['POST'])
def promote_try(try_id):
    """Promote a meals-to-try entry into the main meal library."""
    db = get_db()
    entry = db.execute("SELECT * FROM meals_to_try WHERE id = ?", (try_id,)).fetchone()
    if not entry:
        return jsonify({'error': 'Not found'}), 404
    if entry['promoted_meal_id']:
        return jsonify({'error': 'Already promoted'}), 409

    data = request.get_json() or {}
    cur = db.execute(
        """INSERT INTO meals (name, description, photo_path, category, recipe, min_frequency_days)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (entry['name'], entry['description'], entry['photo_path'],
         data.get('category'), data.get('recipe'), data.get('min_frequency_days', 0))
    )
    meal_id = cur.lastrowid
    db.execute("UPDATE meals_to_try SET promoted_meal_id = ? WHERE id = ?", (meal_id, try_id))
    db.commit()
    return jsonify(meal_detail(db, meal_id)), 201


# ─── Restaurants ─────────────────────────────────────────────────────────────

@bp.route('/restaurants', methods=['GET'])
def list_restaurants():
    db = get_db()
    rows = db.execute("SELECT * FROM restaurants ORDER BY name").fetchall()
    return jsonify([restaurant_detail(db, r['id']) for r in rows])


@bp.route('/restaurants', methods=['POST'])
def create_restaurant():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO restaurants (name, cuisine, dine_in, takeout, notes) VALUES (?, ?, ?, ?, ?)",
        (data.get('name'), data.get('cuisine'),
         data.get('dine_in', 1), data.get('takeout', 1), data.get('notes'))
    )
    db.commit()
    return jsonify(restaurant_detail(db, cur.lastrowid)), 201


@bp.route('/restaurants/<int:rid>', methods=['GET'])
def get_restaurant(rid):
    db = get_db()
    d = restaurant_detail(db, rid)
    if not d:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(d)


@bp.route('/restaurants/<int:rid>', methods=['PUT'])
def update_restaurant(rid):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM restaurants WHERE id = ?", (rid,)).fetchone():
        return jsonify({'error': 'Not found'}), 404
    allowed = {'name', 'cuisine', 'dine_in', 'takeout', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE restaurants SET {set_clause} WHERE id = ?",
                   list(updates.values()) + [rid])
        db.commit()
    return jsonify(restaurant_detail(db, rid))


@bp.route('/restaurants/<int:rid>', methods=['DELETE'])
def delete_restaurant(rid):
    db = get_db()
    db.execute("DELETE FROM restaurants WHERE id = ?", (rid,))
    db.commit()
    return '', 204


@bp.route('/restaurants/<int:rid>/ratings', methods=['POST'])
def rate_restaurant(rid):
    data = request.get_json()
    db = get_db()
    db.execute(
        """INSERT INTO restaurant_ratings (restaurant_id, user_id, rating, rated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(restaurant_id, user_id) DO UPDATE SET rating=excluded.rating, rated_at=excluded.rated_at""",
        (rid, data['user_id'], data['rating'])
    )
    db.commit()
    return jsonify(restaurant_detail(db, rid))


def _visit_items(db, visit_id):
    return [dict(i) for i in db.execute("""
        SELECT vi.*, u.name AS user_name
        FROM restaurant_visit_items vi
        LEFT JOIN users u ON vi.user_id = u.id
        WHERE vi.visit_id = ?
        ORDER BY u.name
    """, (visit_id,)).fetchall()]


@bp.route('/restaurants/<int:rid>/visits', methods=['GET'])
def list_visits(rid):
    db = get_db()
    visits = db.execute(
        "SELECT * FROM restaurant_visits WHERE restaurant_id = ? ORDER BY visited_at DESC",
        (rid,)
    ).fetchall()
    result = []
    for v in visits:
        d = dict(v)
        d['items'] = _visit_items(db, v['id'])
        result.append(d)
    return jsonify(result)


@bp.route('/restaurants/<int:rid>/visits', methods=['POST'])
def create_visit(rid):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM restaurants WHERE id = ?", (rid,)).fetchone():
        return jsonify({'error': 'Not found'}), 404
    cur = db.execute(
        "INSERT INTO restaurant_visits (restaurant_id, visited_at, visit_type, notes) VALUES (?, ?, ?, ?)",
        (rid, data.get('visited_at'), data.get('visit_type'), data.get('notes'))
    )
    db.commit()
    visit_id = cur.lastrowid

    for item in data.get('items', []):
        db.execute(
            """INSERT INTO restaurant_visit_items
               (visit_id, user_id, item_name, rating, notes)
               VALUES (?, ?, ?, ?, ?)""",
            (visit_id, item.get('user_id'), item.get('item_name'),
             item.get('rating'), item.get('notes'))
        )
    db.commit()

    visit = dict(db.execute("SELECT * FROM restaurant_visits WHERE id = ?", (visit_id,)).fetchone())
    visit['items'] = _visit_items(db, visit_id)
    return jsonify(visit), 201


@bp.route('/restaurant-visits/<int:visit_id>', methods=['GET'])
def get_visit(visit_id):
    db = get_db()
    visit = db.execute("SELECT * FROM restaurant_visits WHERE id = ?", (visit_id,)).fetchone()
    if not visit:
        return jsonify({'error': 'Not found'}), 404
    d = dict(visit)
    d['items'] = _visit_items(db, visit_id)
    return jsonify(d)


@bp.route('/restaurant-visits/<int:visit_id>', methods=['PUT'])
def update_visit(visit_id):
    data = request.get_json()
    db = get_db()
    allowed = {'visited_at', 'visit_type', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE restaurant_visits SET {set_clause} WHERE id = ?",
                   list(updates.values()) + [visit_id])
        db.commit()
    visit = db.execute("SELECT * FROM restaurant_visits WHERE id = ?", (visit_id,)).fetchone()
    if not visit:
        return jsonify({'error': 'Not found'}), 404
    d = dict(visit)
    items = db.execute("SELECT * FROM restaurant_visit_items WHERE visit_id = ?", (visit_id,)).fetchall()
    d['items'] = [dict(i) for i in items]
    return jsonify(d)


@bp.route('/restaurant-visits/<int:visit_id>', methods=['DELETE'])
def delete_visit(visit_id):
    db = get_db()
    db.execute("DELETE FROM restaurant_visits WHERE id = ?", (visit_id,))
    db.commit()
    return '', 204


@bp.route('/restaurant-visits/<int:visit_id>/items', methods=['POST'])
def add_visit_item(visit_id):
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO restaurant_visit_items (visit_id, item_name, rating, photo_path, notes) VALUES (?, ?, ?, ?, ?)",
        (visit_id, data.get('item_name'), data.get('rating'), data.get('photo_path'), data.get('notes'))
    )
    db.commit()
    return jsonify(dict(db.execute(
        "SELECT * FROM restaurant_visit_items WHERE id = ?", (cur.lastrowid,)
    ).fetchone())), 201


@bp.route('/restaurant-visit-items/<int:item_id>', methods=['PUT'])
def update_visit_item(item_id):
    data = request.get_json()
    db = get_db()
    allowed = {'item_name', 'rating', 'photo_path', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE restaurant_visit_items SET {set_clause} WHERE id = ?",
                   list(updates.values()) + [item_id])
        db.commit()
    row = db.execute("SELECT * FROM restaurant_visit_items WHERE id = ?", (item_id,)).fetchone()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))


@bp.route('/restaurant-visit-items/<int:item_id>', methods=['DELETE'])
def delete_visit_item(item_id):
    db = get_db()
    db.execute("DELETE FROM restaurant_visit_items WHERE id = ?", (item_id,))
    db.commit()
    return '', 204


# ─── Meal plan ───────────────────────────────────────────────────────────────

def slot_detail(db, slot):
    d = dict(slot)
    d['attendees'] = [
        row['user_id']
        for row in db.execute(
            "SELECT user_id FROM meal_plan_slot_attendees WHERE slot_id = ?", (slot['id'],)
        ).fetchall()
    ]
    if d['meal_id']:
        m = db.execute("SELECT id, name, photo_path FROM meals WHERE id = ?", (d['meal_id'],)).fetchone()
        d['meal'] = dict(m) if m else None
    if d['restaurant_id']:
        r = db.execute("SELECT id, name FROM restaurants WHERE id = ?", (d['restaurant_id'],)).fetchone()
        d['restaurant'] = dict(r) if r else None
    return d


@bp.route('/meal-plan/<week_start>', methods=['GET'])
def get_week_plan(week_start):
    db = get_db()
    slots = db.execute(
        "SELECT * FROM meal_plan_slots WHERE week_start = ?", (week_start,)
    ).fetchall()

    plan = {}
    for day in range(7):
        plan[day] = {mt: None for mt in ('breakfast', 'lunch', 'dinner')}

    for slot in slots:
        plan[slot['day_of_week']][slot['meal_type']] = slot_detail(db, slot)

    return jsonify({'week_start': week_start, 'days': plan})


@bp.route('/meal-plan/<week_start>/<int:day>/<meal_type>', methods=['PUT'])
def update_slot(week_start, day, meal_type):
    data = request.get_json()
    db = get_db()

    # Upsert the slot
    db.execute(
        """INSERT INTO meal_plan_slots
               (week_start, day_of_week, meal_type, slot_type,
                meal_id, restaurant_id, leftovers_note, cook_id, reminder_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(week_start, day_of_week, meal_type) DO UPDATE SET
               slot_type     = excluded.slot_type,
               meal_id       = excluded.meal_id,
               restaurant_id = excluded.restaurant_id,
               leftovers_note= excluded.leftovers_note,
               cook_id       = excluded.cook_id,
               reminder_time = excluded.reminder_time""",
        (week_start, day, meal_type,
         data.get('slot_type', 'empty'), data.get('meal_id'), data.get('restaurant_id'),
         data.get('leftovers_note'), data.get('cook_id'), data.get('reminder_time'))
    )
    db.commit()

    slot = db.execute(
        "SELECT * FROM meal_plan_slots WHERE week_start=? AND day_of_week=? AND meal_type=?",
        (week_start, day, meal_type)
    ).fetchone()

    # Replace attendees if provided
    if 'attendees' in data:
        db.execute("DELETE FROM meal_plan_slot_attendees WHERE slot_id = ?", (slot['id'],))
        for uid in data['attendees']:
            db.execute(
                "INSERT OR IGNORE INTO meal_plan_slot_attendees (slot_id, user_id) VALUES (?, ?)",
                (slot['id'], uid)
            )
        db.commit()

    return jsonify(slot_detail(db, slot))


@bp.route('/meal-plan/<week_start>/<int:day>/<meal_type>/attendees', methods=['PUT'])
def set_slot_attendees(week_start, day, meal_type):
    data = request.get_json()
    db = get_db()
    slot = db.execute(
        "SELECT * FROM meal_plan_slots WHERE week_start=? AND day_of_week=? AND meal_type=?",
        (week_start, day, meal_type)
    ).fetchone()
    if not slot:
        return jsonify({'error': 'Slot not found — create the slot first'}), 404

    db.execute("DELETE FROM meal_plan_slot_attendees WHERE slot_id = ?", (slot['id'],))
    for uid in data.get('attendees', []):
        db.execute(
            "INSERT OR IGNORE INTO meal_plan_slot_attendees (slot_id, user_id) VALUES (?, ?)",
            (slot['id'], uid)
        )
    db.commit()
    return jsonify(slot_detail(db, slot))
