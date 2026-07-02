from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('purchases', __name__)


def purchase_with_items(db, purchase):
    d = dict(purchase)
    items = db.execute(
        "SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id",
        (purchase['id'],)
    ).fetchall()
    d['items'] = [dict(i) for i in items]
    d['total'] = sum((i['quantity'] or 0) * (i['unit_price'] or 0) for i in d['items'])
    return d


# ─── Purchases (receipts) ────────────────────────────────────────────────────

@bp.route('/purchases', methods=['GET'])
def list_purchases():
    db = get_db()
    query = """SELECT p.*, u.name AS created_by_name,
        COALESCE((SELECT SUM(COALESCE(pi.quantity,0) * COALESCE(pi.unit_price,0))
                  FROM purchase_items pi WHERE pi.purchase_id = p.id), 0) AS total,
        COALESCE((SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id), 0) AS item_count
    FROM purchases p LEFT JOIN users u ON p.created_by = u.id
    WHERE 1=1"""
    params = []

    store = request.args.get('store')
    if store:
        query += " AND p.store = ?"
        params.append(store)

    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    if date_from:
        query += " AND p.purchased_at >= ?"
        params.append(date_from)
    if date_to:
        query += " AND p.purchased_at <= ?"
        params.append(date_to)

    query += " ORDER BY p.purchased_at DESC"
    rows = db.execute(query, params).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route('/purchases', methods=['POST'])
def create_purchase():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO purchases (store, purchased_at, notes, created_by) VALUES (?, ?, ?, ?)",
        (data.get('store'), data.get('purchased_at'), data.get('notes'), data.get('created_by'))
    )
    purchase_id = cur.lastrowid

    for item in data.get('items', []):
        db.execute(
            "INSERT INTO purchase_items (purchase_id, name, quantity, unit_price, photo_path, notes) VALUES (?, ?, ?, ?, ?, ?)",
            (purchase_id, item.get('name'), item.get('quantity', 1),
             item.get('unit_price'), item.get('photo_path'), item.get('notes'))
        )
    db.commit()

    purchase = db.execute("SELECT * FROM purchases WHERE id = ?", (purchase_id,)).fetchone()
    return jsonify(purchase_with_items(db, purchase)), 201


@bp.route('/purchases/<int:purchase_id>', methods=['GET'])
def get_purchase(purchase_id):
    db = get_db()
    purchase = db.execute("SELECT * FROM purchases WHERE id = ?", (purchase_id,)).fetchone()
    if not purchase:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(purchase_with_items(db, purchase))


@bp.route('/purchases/<int:purchase_id>', methods=['PUT'])
def update_purchase(purchase_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM purchases WHERE id = ?", (purchase_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404
    allowed = {'store', 'purchased_at', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE purchases SET {set_clause} WHERE id = ?",
                   list(updates.values()) + [purchase_id])
        db.commit()
    return jsonify(purchase_with_items(db, db.execute(
        "SELECT * FROM purchases WHERE id = ?", (purchase_id,)
    ).fetchone()))


@bp.route('/purchases/<int:purchase_id>', methods=['DELETE'])
def delete_purchase(purchase_id):
    db = get_db()
    db.execute("DELETE FROM purchases WHERE id = ?", (purchase_id,))
    db.commit()
    return '', 204


# ─── Purchase line items ──────────────────────────────────────────────────────

@bp.route('/purchases/<int:purchase_id>/items', methods=['POST'])
def add_purchase_item(purchase_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM purchases WHERE id = ?", (purchase_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404
    cur = db.execute(
        "INSERT INTO purchase_items (purchase_id, name, quantity, unit_price, photo_path, notes) VALUES (?, ?, ?, ?, ?, ?)",
        (purchase_id, data.get('name'), data.get('quantity', 1),
         data.get('unit_price'), data.get('photo_path'), data.get('notes'))
    )
    db.commit()
    return jsonify(dict(db.execute(
        "SELECT * FROM purchase_items WHERE id = ?", (cur.lastrowid,)
    ).fetchone())), 201


@bp.route('/purchases/items/<int:item_id>', methods=['PUT'])
def update_purchase_item(item_id):
    data = request.get_json()
    db = get_db()
    allowed = {'name', 'quantity', 'unit_price', 'photo_path', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE purchase_items SET {set_clause} WHERE id = ?",
                   list(updates.values()) + [item_id])
        db.commit()
    row = db.execute("SELECT * FROM purchase_items WHERE id = ?", (item_id,)).fetchone()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))


@bp.route('/purchases/items/<int:item_id>', methods=['DELETE'])
def delete_purchase_item(item_id):
    db = get_db()
    db.execute("DELETE FROM purchase_items WHERE id = ?", (item_id,))
    db.commit()
    return '', 204
