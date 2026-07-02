from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('adventures', __name__)


# ─── Cities ──────────────────────────────────────────────────────────────────

@bp.route('/cities', methods=['GET'])
def list_cities():
    db = get_db()
    rows = db.execute("SELECT * FROM cities ORDER BY name").fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route('/cities', methods=['POST'])
def create_city():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO cities (name, province, country) VALUES (?, ?, ?)",
        (data['name'], data.get('province'), data.get('country', 'Canada'))
    )
    db.commit()
    row = db.execute("SELECT * FROM cities WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


# ─── Venues ──────────────────────────────────────────────────────────────────

@bp.route('/escape-venues', methods=['GET'])
def list_venues():
    db = get_db()
    city_id = request.args.get('city_id')
    query = "SELECT * FROM escape_room_venues"
    params = []
    if city_id:
        query += " WHERE city_id = ?"
        params.append(city_id)
    query += " ORDER BY name"
    venues = [dict(r) for r in db.execute(query, params).fetchall()]

    for v in venues:
        stats = db.execute("""
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN c.id IS NOT NULL THEN 1 END) as completed
            FROM escape_rooms r
            LEFT JOIN (
                SELECT DISTINCT room_id as id FROM escape_room_completions
            ) c ON c.id = r.id
            WHERE r.venue_id = ? AND r.is_active = 1
        """, (v['id'],)).fetchone()
        v['room_count'] = stats['total']
        v['rooms_completed'] = stats['completed']

    return jsonify(venues)


@bp.route('/escape-venues', methods=['POST'])
def create_venue():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO escape_room_venues (name, city_id, address, website, notes) VALUES (?,?,?,?,?)",
        (data['name'], data['city_id'], data.get('address'), data.get('website'), data.get('notes'))
    )
    db.commit()
    row = db.execute("SELECT * FROM escape_room_venues WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@bp.route('/escape-venues/<int:venue_id>', methods=['PUT'])
def update_venue(venue_id):
    data = request.get_json()
    db = get_db()
    allowed = {'name', 'city_id', 'address', 'website', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE escape_room_venues SET {clause} WHERE id = ?",
                   list(updates.values()) + [venue_id])
        db.commit()
    row = db.execute("SELECT * FROM escape_room_venues WHERE id = ?", (venue_id,)).fetchone()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))


@bp.route('/escape-venues/<int:venue_id>', methods=['DELETE'])
def delete_venue(venue_id):
    db = get_db()
    db.execute("DELETE FROM escape_room_venues WHERE id = ?", (venue_id,))
    db.commit()
    return '', 204


# ─── Rooms ───────────────────────────────────────────────────────────────────

@bp.route('/escape-rooms', methods=['GET'])
def list_rooms():
    db = get_db()
    venue_id = request.args.get('venue_id')
    query = "SELECT * FROM escape_rooms WHERE is_active = 1"
    params = []
    if venue_id:
        query += " AND venue_id = ?"
        params.append(venue_id)
    query += " ORDER BY name"
    rooms = [dict(r) for r in db.execute(query, params).fetchall()]

    for room in rooms:
        stats = db.execute("""
            SELECT COUNT(*) as completion_count,
                   MAX(played_at) as last_played_at,
                   (SELECT escaped FROM escape_room_completions
                    WHERE room_id = ? ORDER BY played_at DESC NULLS LAST LIMIT 1) as last_escaped
            FROM escape_room_completions WHERE room_id = ?
        """, (room['id'], room['id'])).fetchone()
        room['completion_count'] = stats['completion_count']
        room['last_played_at']   = stats['last_played_at']
        room['last_escaped']     = stats['last_escaped']

    return jsonify(rooms)


@bp.route('/escape-rooms', methods=['POST'])
def create_room():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        """INSERT INTO escape_rooms
               (venue_id, name, min_participants, max_participants, difficulty, description)
           VALUES (?,?,?,?,?,?)""",
        (data['venue_id'], data['name'], data.get('min_participants'),
         data.get('max_participants'), data.get('difficulty'), data.get('description'))
    )
    db.commit()
    row = db.execute("SELECT * FROM escape_rooms WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@bp.route('/escape-rooms/<int:room_id>', methods=['PUT'])
def update_room(room_id):
    data = request.get_json()
    db = get_db()
    allowed = {'name', 'min_participants', 'max_participants', 'difficulty', 'description', 'is_active'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE escape_rooms SET {clause} WHERE id = ?",
                   list(updates.values()) + [room_id])
        db.commit()
    row = db.execute("SELECT * FROM escape_rooms WHERE id = ?", (room_id,)).fetchone()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))


@bp.route('/escape-rooms/<int:room_id>', methods=['DELETE'])
def delete_room(room_id):
    db = get_db()
    db.execute("DELETE FROM escape_rooms WHERE id = ?", (room_id,))
    db.commit()
    return '', 204


# ─── Room filter by people ───────────────────────────────────────────────────

@bp.route('/escape-rooms/filter', methods=['GET'])
def filter_rooms():
    """
    Filter rooms by which selected people have (or haven't) visited.
    ?city_id=1&user_ids=1,2&friend_ids=3,4&mode=completed|new
    mode=completed → rooms at least one selected person has visited
    mode=new       → rooms NONE of the selected people have visited
    If no people selected, completed=any completion exists; new=no completion exists.
    """
    db       = get_db()
    city_id  = request.args.get('city_id', type=int)
    mode     = request.args.get('mode', 'new')
    raw_u    = request.args.get('user_ids', '')
    raw_f    = request.args.get('friend_ids', '')
    user_ids   = [int(x) for x in raw_u.split(',')   if x.strip()]
    friend_ids = [int(x) for x in raw_f.split(',')   if x.strip()]

    if not city_id:
        return jsonify({'error': 'city_id required'}), 400

    # Build the "participated" subquery based on selected people
    if user_ids or friend_ids:
        parts = []
        if user_ids:
            placeholders = ','.join('?' * len(user_ids))
            parts.append(f"EXISTS (SELECT 1 FROM escape_room_completion_users ecu WHERE ecu.completion_id = ec.id AND ecu.user_id IN ({placeholders}))")
        if friend_ids:
            placeholders = ','.join('?' * len(friend_ids))
            parts.append(f"EXISTS (SELECT 1 FROM escape_room_completion_friends ecf WHERE ecf.completion_id = ec.id AND ecf.friend_id IN ({placeholders}))")
        person_clause = ' OR '.join(parts)
        person_params = user_ids + friend_ids
    else:
        person_clause = '1=1'
        person_params = []

    visited_subq = f"""
        SELECT 1 FROM escape_room_completions ec
        WHERE ec.room_id = er.id AND ({person_clause})
    """

    if mode == 'completed':
        where_clause = f"EXISTS ({visited_subq})"
    else:
        where_clause = f"NOT EXISTS ({visited_subq})"

    query = f"""
        SELECT er.*, erv.name AS venue_name, erv.id AS venue_id_ref,
               (SELECT COUNT(*) FROM escape_room_completions ec2
                WHERE ec2.room_id = er.id) AS total_completions,
               (SELECT MAX(ec2.played_at) FROM escape_room_completions ec2
                WHERE ec2.room_id = er.id) AS last_played_at,
               (SELECT ec2.escaped FROM escape_room_completions ec2
                WHERE ec2.room_id = er.id ORDER BY ec2.played_at DESC LIMIT 1) AS last_escaped
        FROM escape_rooms er
        JOIN escape_room_venues erv ON er.venue_id = erv.id
        WHERE erv.city_id = ? AND er.is_active = 1 AND {where_clause}
        ORDER BY erv.name, er.name
    """
    params = [city_id] + person_params
    rows = [dict(r) for r in db.execute(query, params).fetchall()]

    # Group by venue
    venues = {}
    for r in rows:
        vid = r['venue_id']
        if vid not in venues:
            venues[vid] = {'id': vid, 'name': r['venue_name'], 'rooms': []}
        venues[vid]['rooms'].append(r)

    return jsonify(list(venues.values()))


# ─── Completions ─────────────────────────────────────────────────────────────

def _enrich_completion(db, comp):
    users = db.execute("""
        SELECT u.id, u.name FROM escape_room_completion_users cu
        JOIN users u ON u.id = cu.user_id
        WHERE cu.completion_id = ?
    """, (comp['id'],)).fetchall()
    friends = db.execute("""
        SELECT f.id, f.first_name, f.last_name FROM escape_room_completion_friends cf
        JOIN friends f ON f.id = cf.friend_id
        WHERE cf.completion_id = ?
    """, (comp['id'],)).fetchall()
    ratings = db.execute(
        "SELECT user_id, rating FROM escape_room_completion_ratings WHERE completion_id = ?",
        (comp['id'],)
    ).fetchall()
    comp['users']   = [dict(u) for u in users]
    comp['friends'] = [dict(f) for f in friends]
    comp['ratings'] = {str(r['user_id']): r['rating'] for r in ratings}
    return comp


@bp.route('/escape-rooms/<int:room_id>/completions', methods=['GET'])
def list_completions(room_id):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM escape_room_completions WHERE room_id = ? ORDER BY played_at DESC NULLS LAST",
        (room_id,)
    ).fetchall()
    result = [_enrich_completion(db, dict(r)) for r in rows]
    return jsonify(result)


@bp.route('/escape-rooms/<int:room_id>/completions', methods=['POST'])
def add_completion(room_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM escape_rooms WHERE id = ?", (room_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404

    cur = db.execute(
        """INSERT INTO escape_room_completions
               (room_id, played_at, escaped, time_taken_mins, rating, notes)
           VALUES (?,?,?,?,?,?)""",
        (room_id, data.get('played_at'), data.get('escaped'),
         data.get('time_taken_mins'), data.get('rating'), data.get('notes'))
    )
    comp_id = cur.lastrowid

    for uid in (data.get('user_ids') or []):
        db.execute("INSERT OR IGNORE INTO escape_room_completion_users VALUES (?,?)", (comp_id, uid))
    for fid in (data.get('friend_ids') or []):
        db.execute("INSERT OR IGNORE INTO escape_room_completion_friends VALUES (?,?)", (comp_id, fid))
    for uid, rating in (data.get('ratings') or {}).items():
        if rating:
            db.execute("INSERT OR REPLACE INTO escape_room_completion_ratings VALUES (?,?,?)",
                       (comp_id, uid, int(rating)))

    db.commit()
    row = dict(db.execute("SELECT * FROM escape_room_completions WHERE id = ?", (comp_id,)).fetchone())
    return jsonify(_enrich_completion(db, row)), 201


@bp.route('/escape-completions/<int:comp_id>', methods=['PUT'])
def update_completion(comp_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM escape_room_completions WHERE id = ?", (comp_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404

    allowed = {'played_at', 'escaped', 'time_taken_mins', 'rating', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE escape_room_completions SET {clause} WHERE id = ?",
                   list(updates.values()) + [comp_id])

    if 'user_ids' in data:
        db.execute("DELETE FROM escape_room_completion_users WHERE completion_id = ?", (comp_id,))
        for uid in data['user_ids']:
            db.execute("INSERT OR IGNORE INTO escape_room_completion_users VALUES (?,?)", (comp_id, uid))

    if 'friend_ids' in data:
        db.execute("DELETE FROM escape_room_completion_friends WHERE completion_id = ?", (comp_id,))
        for fid in data['friend_ids']:
            db.execute("INSERT OR IGNORE INTO escape_room_completion_friends VALUES (?,?)", (comp_id, fid))
    if 'ratings' in data:
        db.execute("DELETE FROM escape_room_completion_ratings WHERE completion_id = ?", (comp_id,))
        for uid, rating in data['ratings'].items():
            if rating:
                db.execute("INSERT OR REPLACE INTO escape_room_completion_ratings VALUES (?,?,?)",
                           (comp_id, uid, int(rating)))

    db.commit()
    row = dict(db.execute("SELECT * FROM escape_room_completions WHERE id = ?", (comp_id,)).fetchone())
    return jsonify(_enrich_completion(db, row))


@bp.route('/escape-completions/<int:comp_id>', methods=['DELETE'])
def delete_completion(comp_id):
    db = get_db()
    db.execute("DELETE FROM escape_room_completions WHERE id = ?", (comp_id,))
    db.commit()
    return '', 204


# ─── Friends ─────────────────────────────────────────────────────────────────

@bp.route('/friends', methods=['GET'])
def list_friends():
    db = get_db()
    rows = db.execute("SELECT * FROM friends ORDER BY first_name, last_name").fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route('/friends', methods=['POST'])
def create_friend():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO friends (first_name, last_name, email) VALUES (?,?,?)",
        (data['first_name'], data.get('last_name'), data.get('email'))
    )
    db.commit()
    row = db.execute("SELECT * FROM friends WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@bp.route('/friends/<int:friend_id>', methods=['PUT'])
def update_friend(friend_id):
    data = request.get_json()
    db = get_db()
    allowed = {'first_name', 'last_name', 'email'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE friends SET {clause} WHERE id = ?",
                   list(updates.values()) + [friend_id])
        db.commit()
    row = db.execute("SELECT * FROM friends WHERE id = ?", (friend_id,)).fetchone()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))


@bp.route('/friends/<int:friend_id>', methods=['DELETE'])
def delete_friend(friend_id):
    db = get_db()
    db.execute("DELETE FROM friends WHERE id = ?", (friend_id,))
    db.commit()
    return '', 204


# ─── User Preferences ────────────────────────────────────────────────────────

@bp.route('/user-preferences/<int:user_id>', methods=['GET'])
def get_preferences(user_id):
    db = get_db()
    row = db.execute("SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        return jsonify({'user_id': user_id, 'default_city_id': None})
    return jsonify(dict(row))


@bp.route('/user-preferences/<int:user_id>', methods=['PUT'])
def update_preferences(user_id):
    data = request.get_json()
    db = get_db()
    db.execute(
        """INSERT INTO user_preferences (user_id, default_city_id)
           VALUES (?,?)
           ON CONFLICT(user_id) DO UPDATE SET default_city_id = excluded.default_city_id""",
        (user_id, data.get('default_city_id'))
    )
    db.commit()
    row = db.execute("SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)).fetchone()
    return jsonify(dict(row))
