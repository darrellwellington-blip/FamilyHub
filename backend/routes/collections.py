from flask import Blueprint, jsonify, request
from database import get_db

bp = Blueprint('collections', __name__)


@bp.route('/collections', methods=['GET'])
def list_collections():
    db = get_db()
    rows = db.execute("""
        SELECT c.*,
               COUNT(ci.id)                                          AS item_count,
               SUM(CASE WHEN ci.inventory_item_id IS NOT NULL THEN 1 ELSE 0 END) AS owned_count
        FROM collections c
        LEFT JOIN collection_items ci ON ci.collection_id = c.id
        GROUP BY c.id
        ORDER BY c.name
    """).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route('/collections', methods=['POST'])
def create_collection():
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    db = get_db()
    cur = db.execute(
        "INSERT INTO collections (name, description) VALUES (?, ?)",
        (name, (data.get('description') or '').strip() or None)
    )
    db.commit()
    row = db.execute("SELECT * FROM collections WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify({**dict(row), 'item_count': 0, 'owned_count': 0}), 201


@bp.route('/collections/<int:cid>', methods=['PUT'])
def update_collection(cid):
    data = request.get_json()
    db = get_db()
    db.execute(
        "UPDATE collections SET name=?, description=? WHERE id=?",
        ((data.get('name') or '').strip(), (data.get('description') or '').strip() or None, cid)
    )
    db.commit()
    return jsonify({'ok': True})


@bp.route('/collections/<int:cid>', methods=['DELETE'])
def delete_collection(cid):
    db = get_db()
    db.execute("DELETE FROM collections WHERE id=?", (cid,))
    db.commit()
    return '', 204


# ── Collection items ──────────────────────────────────────────────────────────

@bp.route('/collections/<int:cid>/items', methods=['GET'])
def list_items(cid):
    db = get_db()
    rows = db.execute("""
        SELECT ci.*, inv.name AS inventory_name, inv.location, inv.photo_path AS inv_photo
        FROM collection_items ci
        LEFT JOIN inventory inv ON ci.inventory_item_id = inv.id
        WHERE ci.collection_id = ?
        ORDER BY ci.name
    """, (cid,)).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route('/collections/<int:cid>/items', methods=['POST'])
def create_item(cid):
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    db = get_db()
    cur = db.execute(
        "INSERT INTO collection_items (collection_id, name, notes) VALUES (?, ?, ?)",
        (cid, name, (data.get('notes') or '').strip() or None)
    )
    db.commit()
    row = db.execute("SELECT * FROM collection_items WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@bp.route('/collections/items/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    data = request.get_json()
    db = get_db()
    db.execute(
        "UPDATE collection_items SET name=?, notes=? WHERE id=?",
        ((data.get('name') or '').strip(), (data.get('notes') or '').strip() or None, item_id)
    )
    db.commit()
    return jsonify({'ok': True})


@bp.route('/collections/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    db = get_db()
    db.execute("DELETE FROM collection_items WHERE id=?", (item_id,))
    db.commit()
    return '', 204


@bp.route('/collections/items/<int:item_id>/mark-owned', methods=['POST'])
def mark_owned(item_id):
    """Create an inventory item and link it to this collection item."""
    data = request.get_json()
    db = get_db()
    ci = db.execute("SELECT * FROM collection_items WHERE id=?", (item_id,)).fetchone()
    if not ci:
        return jsonify({'error': 'Not found'}), 404

    # Create inventory item
    cur = db.execute(
        "INSERT INTO inventory (name, category, notes, status) VALUES (?, ?, ?, 'active')",
        (ci['name'], data.get('category', 'Collectibles'), data.get('notes') or None)
    )
    inv_id = cur.lastrowid
    db.execute(
        "UPDATE collection_items SET inventory_item_id=? WHERE id=?",
        (inv_id, item_id)
    )
    db.commit()
    return jsonify({'inventory_item_id': inv_id}), 201


@bp.route('/collections/items/<int:item_id>/unmark-owned', methods=['POST'])
def unmark_owned(item_id):
    db = get_db()
    db.execute("UPDATE collection_items SET inventory_item_id=NULL WHERE id=?", (item_id,))
    db.commit()
    return jsonify({'ok': True})
