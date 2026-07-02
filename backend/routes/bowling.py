from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('bowling', __name__)


def _enrich_session(db, s):
    s['users'] = [dict(r) for r in db.execute(
        "SELECT u.id, u.name FROM bowling_session_users su JOIN users u ON u.id = su.user_id WHERE su.session_id = ?",
        (s['id'],)
    ).fetchall()]
    s['friends'] = [dict(r) for r in db.execute(
        "SELECT f.id, f.first_name, f.last_name FROM bowling_session_friends sf JOIN friends f ON f.id = sf.friend_id WHERE sf.session_id = ?",
        (s['id'],)
    ).fetchall()]
    # scores: { user_id: [score_g1, score_g2, ...] }
    score_rows = db.execute(
        """SELECT bs.user_id, u.name, bs.game_number, bs.score
           FROM bowling_scores bs JOIN users u ON u.id = bs.user_id
           WHERE bs.session_id = ? ORDER BY bs.user_id, bs.game_number""",
        (s['id'],)
    ).fetchall()
    scores = {}
    for r in score_rows:
        uid = str(r['user_id'])
        if uid not in scores:
            scores[uid] = {'name': r['name'], 'games': []}
        scores[uid]['games'].append(r['score'])
    s['scores'] = scores
    s['ratings'] = {str(r['user_id']): r['rating'] for r in db.execute(
        "SELECT user_id, rating FROM bowling_ratings WHERE session_id = ?", (s['id'],)
    ).fetchall()}
    return s


@bp.route('/bowling/venues', methods=['GET'])
def list_venues():
    db = get_db()
    city_id = request.args.get('city_id')
    rows = db.execute(
        "SELECT * FROM bowling_venues" + (" WHERE city_id = ?" if city_id else "") + " ORDER BY name",
        ([city_id] if city_id else [])
    ).fetchall()
    venues = [dict(r) for r in rows]
    for v in venues:
        v['session_count'] = db.execute(
            "SELECT COUNT(*) FROM bowling_sessions WHERE venue_id = ?", (v['id'],)
        ).fetchone()[0]
        v['last_played_at'] = db.execute(
            "SELECT MAX(played_at) FROM bowling_sessions WHERE venue_id = ?", (v['id'],)
        ).fetchone()[0]
    return jsonify(venues)


@bp.route('/bowling/venues', methods=['POST'])
def create_venue():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO bowling_venues (city_id, name, address, website, notes) VALUES (?,?,?,?,?)",
        (data['city_id'], data['name'], data.get('address'), data.get('website'), data.get('notes'))
    )
    db.commit()
    return jsonify(dict(db.execute("SELECT * FROM bowling_venues WHERE id = ?", (cur.lastrowid,)).fetchone())), 201


@bp.route('/bowling/venues/<int:venue_id>', methods=['PUT'])
def update_venue(venue_id):
    data = request.get_json()
    db = get_db()
    allowed = {'name', 'city_id', 'address', 'website', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        db.execute(f"UPDATE bowling_venues SET {', '.join(f'{k}=?' for k in updates)} WHERE id = ?",
                   list(updates.values()) + [venue_id])
        db.commit()
    row = db.execute("SELECT * FROM bowling_venues WHERE id = ?", (venue_id,)).fetchone()
    return jsonify(dict(row)) if row else (jsonify({'error': 'Not found'}), 404)


@bp.route('/bowling/venues/<int:venue_id>', methods=['DELETE'])
def delete_venue(venue_id):
    db = get_db()
    db.execute("DELETE FROM bowling_venues WHERE id = ?", (venue_id,))
    db.commit()
    return '', 204


@bp.route('/bowling/venues/<int:venue_id>/sessions', methods=['GET'])
def list_sessions(venue_id):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM bowling_sessions WHERE venue_id = ? ORDER BY played_at DESC NULLS LAST",
        (venue_id,)
    ).fetchall()
    return jsonify([_enrich_session(db, dict(r)) for r in rows])


@bp.route('/bowling/venues/<int:venue_id>/sessions', methods=['POST'])
def add_session(venue_id):
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO bowling_sessions (venue_id, played_at, notes) VALUES (?,?,?)",
        (venue_id, data.get('played_at'), data.get('notes'))
    )
    sid = cur.lastrowid
    for uid in (data.get('user_ids') or []):
        db.execute("INSERT OR IGNORE INTO bowling_session_users VALUES (?,?)", (sid, uid))
    for fid in (data.get('friend_ids') or []):
        db.execute("INSERT OR IGNORE INTO bowling_session_friends VALUES (?,?)", (sid, fid))
    # scores: { user_id: [g1, g2, ...] }
    for uid, games in (data.get('scores') or {}).items():
        for i, score in enumerate(games, 1):
            if score is not None and score != '':
                db.execute("INSERT INTO bowling_scores (session_id, user_id, game_number, score) VALUES (?,?,?,?)",
                           (sid, uid, i, int(score)))
    for uid, rating in (data.get('ratings') or {}).items():
        if rating:
            db.execute("INSERT OR REPLACE INTO bowling_ratings VALUES (?,?,?)", (sid, uid, int(rating)))
    db.commit()
    return jsonify(_enrich_session(db, dict(db.execute("SELECT * FROM bowling_sessions WHERE id = ?", (sid,)).fetchone()))), 201


@bp.route('/bowling/sessions/<int:session_id>', methods=['PUT'])
def update_session(session_id):
    data = request.get_json()
    db = get_db()
    allowed = {'played_at', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        db.execute(f"UPDATE bowling_sessions SET {', '.join(f'{k}=?' for k in updates)} WHERE id = ?",
                   list(updates.values()) + [session_id])
    if 'user_ids' in data:
        db.execute("DELETE FROM bowling_session_users WHERE session_id = ?", (session_id,))
        for uid in data['user_ids']:
            db.execute("INSERT OR IGNORE INTO bowling_session_users VALUES (?,?)", (session_id, uid))
    if 'friend_ids' in data:
        db.execute("DELETE FROM bowling_session_friends WHERE session_id = ?", (session_id,))
        for fid in data['friend_ids']:
            db.execute("INSERT OR IGNORE INTO bowling_session_friends VALUES (?,?)", (session_id, fid))
    if 'scores' in data:
        db.execute("DELETE FROM bowling_scores WHERE session_id = ?", (session_id,))
        for uid, games in data['scores'].items():
            for i, score in enumerate(games, 1):
                if score is not None and score != '':
                    db.execute("INSERT INTO bowling_scores (session_id, user_id, game_number, score) VALUES (?,?,?,?)",
                               (session_id, uid, i, int(score)))
    if 'ratings' in data:
        db.execute("DELETE FROM bowling_ratings WHERE session_id = ?", (session_id,))
        for uid, rating in data['ratings'].items():
            if rating:
                db.execute("INSERT OR REPLACE INTO bowling_ratings VALUES (?,?,?)", (session_id, uid, int(rating)))
    db.commit()
    return jsonify(_enrich_session(db, dict(db.execute("SELECT * FROM bowling_sessions WHERE id = ?", (session_id,)).fetchone())))


@bp.route('/bowling/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    db = get_db()
    db.execute("DELETE FROM bowling_sessions WHERE id = ?", (session_id,))
    db.commit()
    return '', 204
