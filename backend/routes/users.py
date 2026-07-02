from flask import Blueprint, jsonify, request
from database import get_db

bp = Blueprint('users', __name__)


@bp.route('/users', methods=['GET'])
def list_users():
    db = get_db()
    users = [dict(row) for row in db.execute("SELECT * FROM users ORDER BY id").fetchall()]
    return jsonify(users)


@bp.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    db = get_db()
    cur = db.execute("INSERT INTO users (name) VALUES (?)", (name,))
    db.commit()
    user = dict(db.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone())
    return jsonify(user), 201


@bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    db = get_db()
    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    return '', 204
