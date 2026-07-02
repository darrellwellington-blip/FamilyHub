from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('inventory', __name__)

ALLOWED_FIELDS = {
    'name', 'description', 'category', 'location', 'quantity', 'unit',
    'best_before_date', 'purchase_date', 'purchase_price', 'store',
    'serial_number', 'model_number', 'estimated_value', 'notes'
}


def item_with_photos(db, item):
    if item is None:
        return None
    d = dict(item)
    photos = db.execute(
        "SELECT * FROM inventory_photos WHERE item_id = ? ORDER BY sort_order",
        (item['id'],)
    ).fetchall()
    d['photos'] = [dict(p) for p in photos]
    return d


# ─── List & Create ────────────────────────────────────────────────────────────

@bp.route('/inventory', methods=['GET'])
def list_inventory():
    db = get_db()
    query = "SELECT * FROM inventory_items WHERE 1=1"
    params = []

    # Status filter: default to active items only
    status = request.args.get('status', 'active')
    if status == 'history':
        query += " AND status IN ('consumed', 'disposed')"
    elif status != 'all':
        query += " AND status = ?"
        params.append(status)

    for col in ('category', 'location'):
        val = request.args.get(col)
        if val:
            query += f" AND {col} = ?"
            params.append(val)

    search = request.args.get('search')
    if search:
        query += " AND (name LIKE ? OR description LIKE ? OR notes LIKE ?)"
        like = f"%{search}%"
        params.extend([like, like, like])

    query += " ORDER BY category, name"
    rows = db.execute(query, params).fetchall()
    return jsonify([item_with_photos(db, r) for r in rows])


@bp.route('/inventory', methods=['POST'])
def create_item():
    data = request.get_json()
    db = get_db()
    fields = {k: v for k, v in data.items() if k in ALLOWED_FIELDS}
    if not fields:
        return jsonify({'error': 'No valid fields provided'}), 400
    cols = ', '.join(fields.keys())
    placeholders = ', '.join('?' for _ in fields)
    cur = db.execute(
        f"INSERT INTO inventory_items ({cols}) VALUES ({placeholders})",
        list(fields.values())
    )
    db.commit()
    return jsonify(item_with_photos(db, db.execute(
        "SELECT * FROM inventory_items WHERE id = ?", (cur.lastrowid,)
    ).fetchone())), 201


# ─── Single item ──────────────────────────────────────────────────────────────

@bp.route('/inventory/<int:item_id>', methods=['GET'])
def get_item(item_id):
    db = get_db()
    item = db.execute("SELECT * FROM inventory_items WHERE id = ?", (item_id,)).fetchone()
    if not item:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(item_with_photos(db, item))


@bp.route('/inventory/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM inventory_items WHERE id = ?", (item_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404
    updates = {k: v for k, v in data.items() if k in ALLOWED_FIELDS}
    if updates:
        set_parts = [f"{k} = ?" for k in updates] + ["updated_at = datetime('now')"]
        db.execute(
            f"UPDATE inventory_items SET {', '.join(set_parts)} WHERE id = ?",
            list(updates.values()) + [item_id]
        )
        db.commit()
    return jsonify(item_with_photos(db, db.execute(
        "SELECT * FROM inventory_items WHERE id = ?", (item_id,)
    ).fetchone()))


@bp.route('/inventory/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    db = get_db()
    db.execute("DELETE FROM inventory_items WHERE id = ?", (item_id,))
    db.commit()
    return '', 204


# ─── Remove (soft) & Restore ─────────────────────────────────────────────────

@bp.route('/inventory/<int:item_id>/remove', methods=['POST'])
def remove_item(item_id):
    data = request.get_json() or {}
    db = get_db()
    if not db.execute("SELECT id FROM inventory_items WHERE id = ?", (item_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404
    status = data.get('status', 'consumed')
    if status not in ('consumed', 'disposed'):
        return jsonify({'error': "status must be 'consumed' or 'disposed'"}), 400
    db.execute(
        """UPDATE inventory_items
           SET status = ?, removed_at = datetime('now'), removal_notes = ?, updated_at = datetime('now')
           WHERE id = ?""",
        (status, data.get('removal_notes'), item_id)
    )
    db.commit()
    return jsonify(item_with_photos(db, db.execute(
        "SELECT * FROM inventory_items WHERE id = ?", (item_id,)
    ).fetchone()))


@bp.route('/inventory/<int:item_id>/restore', methods=['POST'])
def restore_item(item_id):
    db = get_db()
    if not db.execute("SELECT id FROM inventory_items WHERE id = ?", (item_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404
    db.execute(
        """UPDATE inventory_items
           SET status = 'active', removed_at = NULL, removal_notes = NULL, updated_at = datetime('now')
           WHERE id = ?""",
        (item_id,)
    )
    db.commit()
    return jsonify(item_with_photos(db, db.execute(
        "SELECT * FROM inventory_items WHERE id = ?", (item_id,)
    ).fetchone()))


# ─── Photos ───────────────────────────────────────────────────────────────────

@bp.route('/inventory/<int:item_id>/photos', methods=['POST'])
def add_photo(item_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM inventory_items WHERE id = ?", (item_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404

    count = db.execute(
        "SELECT COUNT(*) AS cnt FROM inventory_photos WHERE item_id = ?", (item_id,)
    ).fetchone()['cnt']
    if count >= 3:
        return jsonify({'error': 'Maximum 3 photos per item'}), 400

    sort_order = data.get('sort_order', count + 1)
    cur = db.execute(
        "INSERT INTO inventory_photos (item_id, photo_path, sort_order) VALUES (?, ?, ?)",
        (item_id, data.get('photo_path'), sort_order)
    )
    db.commit()
    return jsonify(dict(db.execute(
        "SELECT * FROM inventory_photos WHERE id = ?", (cur.lastrowid,)
    ).fetchone())), 201


@bp.route('/inventory/photos/<int:photo_id>', methods=['DELETE'])
def delete_photo(photo_id):
    db = get_db()
    db.execute("DELETE FROM inventory_photos WHERE id = ?", (photo_id,))
    db.commit()
    return '', 204
