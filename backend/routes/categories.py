from flask import Blueprint, jsonify, request
from database import get_db

bp = Blueprint('categories', __name__)


@bp.route('/task-categories', methods=['GET'])
def list_categories():
    db = get_db()
    rows = db.execute("SELECT * FROM task_categories ORDER BY name").fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route('/task-categories', methods=['POST'])
def create_category():
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    db = get_db()
    try:
        cur = db.execute("INSERT INTO task_categories (name) VALUES (?)", (name,))
        db.commit()
        cat = dict(db.execute("SELECT * FROM task_categories WHERE id = ?", (cur.lastrowid,)).fetchone())
        return jsonify(cat), 201
    except Exception:
        return jsonify({'error': 'Category already exists'}), 409


@bp.route('/task-categories/<int:cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    db = get_db()
    db.execute("DELETE FROM task_categories WHERE id = ?", (cat_id,))
    db.commit()
    return '', 204
