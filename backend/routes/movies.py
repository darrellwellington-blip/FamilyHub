from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('movies', __name__)


def _enrich_viewing(db, v):
    v['users'] = [dict(r) for r in db.execute(
        "SELECT u.id, u.name FROM movie_viewing_users vu JOIN users u ON u.id = vu.user_id WHERE vu.viewing_id = ?",
        (v['id'],)
    ).fetchall()]
    v['friends'] = [dict(r) for r in db.execute(
        "SELECT f.id, f.first_name, f.last_name FROM movie_viewing_friends vf JOIN friends f ON f.id = vf.friend_id WHERE vf.viewing_id = ?",
        (v['id'],)
    ).fetchall()]
    v['ratings'] = {str(r['user_id']): r['rating'] for r in db.execute(
        "SELECT user_id, rating FROM movie_viewing_ratings WHERE viewing_id = ?", (v['id'],)
    ).fetchall()}
    return v


@bp.route('/movies', methods=['GET'])
def list_movies():
    db = get_db()
    search = request.args.get('q', '').strip()
    if search:
        rows = db.execute(
            "SELECT * FROM movies WHERE title LIKE ? ORDER BY title", (f'%{search}%',)
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM movies ORDER BY title").fetchall()
    movies = [dict(r) for r in rows]
    for m in movies:
        m['viewing_count'] = db.execute(
            "SELECT COUNT(*) FROM movie_viewings WHERE movie_id = ?", (m['id'],)
        ).fetchone()[0]
        m['last_viewed_at'] = db.execute(
            "SELECT MAX(viewed_at) FROM movie_viewings WHERE movie_id = ?", (m['id'],)
        ).fetchone()[0]
        avg = db.execute(
            "SELECT AVG(rating) FROM movie_viewing_ratings vr JOIN movie_viewings v ON v.id = vr.viewing_id WHERE v.movie_id = ?",
            (m['id'],)
        ).fetchone()[0]
        m['avg_rating'] = round(avg, 1) if avg else None
    return jsonify(movies)


@bp.route('/movies', methods=['POST'])
def create_movie():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO movies (title, year, genre, notes) VALUES (?,?,?,?)",
        (data['title'], data.get('year'), data.get('genre'), data.get('notes'))
    )
    db.commit()
    return jsonify(dict(db.execute("SELECT * FROM movies WHERE id = ?", (cur.lastrowid,)).fetchone())), 201


@bp.route('/movies/<int:movie_id>', methods=['PUT'])
def update_movie(movie_id):
    data = request.get_json()
    db = get_db()
    allowed = {'title', 'year', 'genre', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        db.execute(f"UPDATE movies SET {', '.join(f'{k}=?' for k in updates)} WHERE id = ?",
                   list(updates.values()) + [movie_id])
        db.commit()
    row = db.execute("SELECT * FROM movies WHERE id = ?", (movie_id,)).fetchone()
    return jsonify(dict(row)) if row else (jsonify({'error': 'Not found'}), 404)


@bp.route('/movies/<int:movie_id>', methods=['DELETE'])
def delete_movie(movie_id):
    db = get_db()
    db.execute("DELETE FROM movies WHERE id = ?", (movie_id,))
    db.commit()
    return '', 204


@bp.route('/movies/<int:movie_id>/viewings', methods=['GET'])
def list_viewings(movie_id):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM movie_viewings WHERE movie_id = ? ORDER BY viewed_at DESC NULLS LAST",
        (movie_id,)
    ).fetchall()
    return jsonify([_enrich_viewing(db, dict(r)) for r in rows])


@bp.route('/movies/<int:movie_id>/viewings', methods=['POST'])
def add_viewing(movie_id):
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO movie_viewings (movie_id, viewed_at, venue_type, theater_name, notes) VALUES (?,?,?,?,?)",
        (movie_id, data.get('viewed_at'), data.get('venue_type', 'home'),
         data.get('theater_name'), data.get('notes'))
    )
    vid = cur.lastrowid
    for uid in (data.get('user_ids') or []):
        db.execute("INSERT OR IGNORE INTO movie_viewing_users VALUES (?,?)", (vid, uid))
    for fid in (data.get('friend_ids') or []):
        db.execute("INSERT OR IGNORE INTO movie_viewing_friends VALUES (?,?)", (vid, fid))
    for uid, rating in (data.get('ratings') or {}).items():
        if rating:
            db.execute("INSERT OR REPLACE INTO movie_viewing_ratings VALUES (?,?,?)", (vid, uid, int(rating)))
    db.commit()
    return jsonify(_enrich_viewing(db, dict(db.execute("SELECT * FROM movie_viewings WHERE id = ?", (vid,)).fetchone()))), 201


@bp.route('/movie-viewings/<int:viewing_id>', methods=['PUT'])
def update_viewing(viewing_id):
    data = request.get_json()
    db = get_db()
    allowed = {'viewed_at', 'venue_type', 'theater_name', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        db.execute(f"UPDATE movie_viewings SET {', '.join(f'{k}=?' for k in updates)} WHERE id = ?",
                   list(updates.values()) + [viewing_id])
    if 'user_ids' in data:
        db.execute("DELETE FROM movie_viewing_users WHERE viewing_id = ?", (viewing_id,))
        for uid in data['user_ids']:
            db.execute("INSERT OR IGNORE INTO movie_viewing_users VALUES (?,?)", (viewing_id, uid))
    if 'friend_ids' in data:
        db.execute("DELETE FROM movie_viewing_friends WHERE viewing_id = ?", (viewing_id,))
        for fid in data['friend_ids']:
            db.execute("INSERT OR IGNORE INTO movie_viewing_friends VALUES (?,?)", (viewing_id, fid))
    if 'ratings' in data:
        db.execute("DELETE FROM movie_viewing_ratings WHERE viewing_id = ?", (viewing_id,))
        for uid, rating in data['ratings'].items():
            if rating:
                db.execute("INSERT OR REPLACE INTO movie_viewing_ratings VALUES (?,?,?)", (viewing_id, uid, int(rating)))
    db.commit()
    row = db.execute("SELECT * FROM movie_viewings WHERE id = ?", (viewing_id,)).fetchone()
    return jsonify(_enrich_viewing(db, dict(row)))


@bp.route('/movie-viewings/<int:viewing_id>', methods=['DELETE'])
def delete_viewing(viewing_id):
    db = get_db()
    db.execute("DELETE FROM movie_viewings WHERE id = ?", (viewing_id,))
    db.commit()
    return '', 204
