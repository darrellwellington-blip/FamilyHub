from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('minigolf', __name__)


def _enrich_session(db, s):
    s['users'] = [dict(r) for r in db.execute(
        "SELECT u.id, u.name FROM mini_golf_session_users su JOIN users u ON u.id = su.user_id WHERE su.session_id = ?",
        (s['id'],)
    ).fetchall()]
    s['friends'] = [dict(r) for r in db.execute(
        "SELECT f.id, f.first_name, f.last_name FROM mini_golf_session_friends sf JOIN friends f ON f.id = sf.friend_id WHERE sf.session_id = ?",
        (s['id'],)
    ).fetchall()]
    s['scores'] = [dict(r) for r in db.execute(
        "SELECT ms.user_id, u.name, ms.total_score FROM mini_golf_scores ms JOIN users u ON u.id = ms.user_id WHERE ms.session_id = ? ORDER BY ms.total_score",
        (s['id'],)
    ).fetchall()]
    s['ratings'] = {str(r['user_id']): r['rating'] for r in db.execute(
        "SELECT user_id, rating FROM mini_golf_ratings WHERE session_id = ?", (s['id'],)
    ).fetchall()}
    return s


@bp.route('/mini-golf/venues', methods=['GET'])
def list_venues():
    db = get_db()
    city_id = request.args.get('city_id')
    rows = db.execute(
        "SELECT * FROM mini_golf_venues" + (" WHERE city_id = ?" if city_id else "") + " ORDER BY name",
        ([city_id] if city_id else [])
    ).fetchall()
    venues = [dict(r) for r in rows]
    for v in venues:
        v['course_count'] = db.execute(
            "SELECT COUNT(*) FROM mini_golf_courses WHERE venue_id = ? AND is_active = 1", (v['id'],)
        ).fetchone()[0]
        v['session_count'] = db.execute(
            "SELECT COUNT(*) FROM mini_golf_sessions s JOIN mini_golf_courses c ON c.id = s.course_id WHERE c.venue_id = ?",
            (v['id'],)
        ).fetchone()[0]
    return jsonify(venues)


@bp.route('/mini-golf/venues', methods=['POST'])
def create_venue():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO mini_golf_venues (city_id, name, address, website, notes) VALUES (?,?,?,?,?)",
        (data['city_id'], data['name'], data.get('address'), data.get('website'), data.get('notes'))
    )
    db.commit()
    return jsonify(dict(db.execute("SELECT * FROM mini_golf_venues WHERE id = ?", (cur.lastrowid,)).fetchone())), 201


@bp.route('/mini-golf/venues/<int:venue_id>', methods=['PUT'])
def update_venue(venue_id):
    data = request.get_json()
    db = get_db()
    allowed = {'name', 'city_id', 'address', 'website', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        db.execute(f"UPDATE mini_golf_venues SET {', '.join(f'{k}=?' for k in updates)} WHERE id = ?",
                   list(updates.values()) + [venue_id])
        db.commit()
    row = db.execute("SELECT * FROM mini_golf_venues WHERE id = ?", (venue_id,)).fetchone()
    return jsonify(dict(row)) if row else (jsonify({'error': 'Not found'}), 404)


@bp.route('/mini-golf/venues/<int:venue_id>', methods=['DELETE'])
def delete_venue(venue_id):
    db = get_db()
    db.execute("DELETE FROM mini_golf_venues WHERE id = ?", (venue_id,))
    db.commit()
    return '', 204


@bp.route('/mini-golf/courses', methods=['GET'])
def list_courses():
    db = get_db()
    venue_id = request.args.get('venue_id')
    rows = db.execute(
        "SELECT * FROM mini_golf_courses WHERE is_active = 1" + (" AND venue_id = ?" if venue_id else "") + " ORDER BY name",
        ([venue_id] if venue_id else [])
    ).fetchall()
    courses = [dict(r) for r in rows]
    for c in courses:
        c['session_count'] = db.execute(
            "SELECT COUNT(*) FROM mini_golf_sessions WHERE course_id = ?", (c['id'],)
        ).fetchone()[0]
        c['last_played_at'] = db.execute(
            "SELECT MAX(played_at) FROM mini_golf_sessions WHERE course_id = ?", (c['id'],)
        ).fetchone()[0]
    return jsonify(courses)


@bp.route('/mini-golf/courses', methods=['POST'])
def create_course():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO mini_golf_courses (venue_id, name, holes, par, notes) VALUES (?,?,?,?,?)",
        (data['venue_id'], data['name'], data.get('holes', 18), data.get('par'), data.get('notes'))
    )
    db.commit()
    return jsonify(dict(db.execute("SELECT * FROM mini_golf_courses WHERE id = ?", (cur.lastrowid,)).fetchone())), 201


@bp.route('/mini-golf/courses/<int:course_id>', methods=['PUT'])
def update_course(course_id):
    data = request.get_json()
    db = get_db()
    allowed = {'name', 'holes', 'par', 'notes', 'is_active'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        db.execute(f"UPDATE mini_golf_courses SET {', '.join(f'{k}=?' for k in updates)} WHERE id = ?",
                   list(updates.values()) + [course_id])
        db.commit()
    row = db.execute("SELECT * FROM mini_golf_courses WHERE id = ?", (course_id,)).fetchone()
    return jsonify(dict(row)) if row else (jsonify({'error': 'Not found'}), 404)


@bp.route('/mini-golf/courses/<int:course_id>', methods=['DELETE'])
def delete_course(course_id):
    db = get_db()
    db.execute("DELETE FROM mini_golf_courses WHERE id = ?", (course_id,))
    db.commit()
    return '', 204


@bp.route('/mini-golf/courses/<int:course_id>/sessions', methods=['GET'])
def list_sessions(course_id):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM mini_golf_sessions WHERE course_id = ? ORDER BY played_at DESC NULLS LAST",
        (course_id,)
    ).fetchall()
    return jsonify([_enrich_session(db, dict(r)) for r in rows])


@bp.route('/mini-golf/courses/<int:course_id>/sessions', methods=['POST'])
def add_session(course_id):
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO mini_golf_sessions (course_id, played_at, notes) VALUES (?,?,?)",
        (course_id, data.get('played_at'), data.get('notes'))
    )
    sid = cur.lastrowid
    for uid in (data.get('user_ids') or []):
        db.execute("INSERT OR IGNORE INTO mini_golf_session_users VALUES (?,?)", (sid, uid))
    for fid in (data.get('friend_ids') or []):
        db.execute("INSERT OR IGNORE INTO mini_golf_session_friends VALUES (?,?)", (sid, fid))
    for uid, score in (data.get('scores') or {}).items():
        if score is not None and score != '':
            db.execute("INSERT INTO mini_golf_scores (session_id, user_id, total_score) VALUES (?,?,?)",
                       (sid, uid, int(score)))
    for uid, rating in (data.get('ratings') or {}).items():
        if rating:
            db.execute("INSERT OR REPLACE INTO mini_golf_ratings VALUES (?,?,?)", (sid, uid, int(rating)))
    db.commit()
    return jsonify(_enrich_session(db, dict(db.execute("SELECT * FROM mini_golf_sessions WHERE id = ?", (sid,)).fetchone()))), 201


@bp.route('/mini-golf/sessions/<int:session_id>', methods=['PUT'])
def update_session(session_id):
    data = request.get_json()
    db = get_db()
    allowed = {'played_at', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        db.execute(f"UPDATE mini_golf_sessions SET {', '.join(f'{k}=?' for k in updates)} WHERE id = ?",
                   list(updates.values()) + [session_id])
    if 'user_ids' in data:
        db.execute("DELETE FROM mini_golf_session_users WHERE session_id = ?", (session_id,))
        for uid in data['user_ids']:
            db.execute("INSERT OR IGNORE INTO mini_golf_session_users VALUES (?,?)", (session_id, uid))
    if 'friend_ids' in data:
        db.execute("DELETE FROM mini_golf_session_friends WHERE session_id = ?", (session_id,))
        for fid in data['friend_ids']:
            db.execute("INSERT OR IGNORE INTO mini_golf_session_friends VALUES (?,?)", (session_id, fid))
    if 'scores' in data:
        db.execute("DELETE FROM mini_golf_scores WHERE session_id = ?", (session_id,))
        for uid, score in data['scores'].items():
            if score is not None and score != '':
                db.execute("INSERT INTO mini_golf_scores (session_id, user_id, total_score) VALUES (?,?,?)",
                           (session_id, uid, int(score)))
    if 'ratings' in data:
        db.execute("DELETE FROM mini_golf_ratings WHERE session_id = ?", (session_id,))
        for uid, rating in data['ratings'].items():
            if rating:
                db.execute("INSERT OR REPLACE INTO mini_golf_ratings VALUES (?,?,?)", (session_id, uid, int(rating)))
    db.commit()
    return jsonify(_enrich_session(db, dict(db.execute("SELECT * FROM mini_golf_sessions WHERE id = ?", (session_id,)).fetchone())))


@bp.route('/mini-golf/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    db = get_db()
    db.execute("DELETE FROM mini_golf_sessions WHERE id = ?", (session_id,))
    db.commit()
    return '', 204
