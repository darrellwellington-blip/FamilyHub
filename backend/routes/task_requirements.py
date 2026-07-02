from flask import Blueprint, jsonify, request
from database import get_db

bp = Blueprint('task_requirements', __name__)


def _req_row(row):
    d = dict(row)
    # Compute ready flag
    if d['type'] == 'inventory':
        d['ready'] = bool(d.get('inventory_item_id') and d.get('inv_status') == 'active')
    else:
        d['ready'] = bool(d.get('shopping_item_id') and d.get('is_checked'))
    return d


@bp.route('/tasks/<int:task_id>/requirements', methods=['GET'])
def list_requirements(task_id):
    db = get_db()
    rows = db.execute("""
        SELECT r.*,
               inv.name     AS inv_name,
               inv.status   AS inv_status,
               inv.location AS inv_location,
               si.name      AS si_name,
               si.is_checked,
               sl.name      AS sl_name
        FROM task_requirements r
        LEFT JOIN inventory_items inv ON r.inventory_item_id = inv.id
        LEFT JOIN shopping_items  si  ON r.shopping_item_id  = si.id
        LEFT JOIN shopping_lists  sl  ON r.shopping_list_id  = sl.id
        WHERE r.task_id = ?
        ORDER BY r.type, r.label
    """, (task_id,)).fetchall()
    return jsonify([_req_row(r) for r in rows])


@bp.route('/tasks/<int:task_id>/requirements', methods=['POST'])
def create_requirement(task_id):
    data = request.get_json()
    req_type = data.get('type')
    if req_type not in ('inventory', 'shopping'):
        return jsonify({'error': 'type must be inventory or shopping'}), 400

    db = get_db()

    if req_type == 'inventory':
        inv_id = data.get('inventory_item_id')
        if not inv_id:
            return jsonify({'error': 'inventory_item_id required'}), 400
        item = db.execute("SELECT name FROM inventory_items WHERE id=?", (inv_id,)).fetchone()
        if not item:
            return jsonify({'error': 'Inventory item not found'}), 404
        label = item['name']
        cur = db.execute(
            "INSERT INTO task_requirements (task_id, type, label, inventory_item_id) VALUES (?,?,?,?)",
            (task_id, 'inventory', label, inv_id)
        )
    else:
        list_id  = data.get('shopping_list_id')
        item_name = (data.get('label') or '').strip()
        if not list_id or not item_name:
            return jsonify({'error': 'shopping_list_id and label required'}), 400
        # Create the shopping item on the list
        si = db.execute(
            "INSERT INTO shopping_items (list_id, name) VALUES (?,?)",
            (list_id, item_name)
        )
        si_id = si.lastrowid
        cur = db.execute(
            """INSERT INTO task_requirements
               (task_id, type, label, shopping_item_id, shopping_list_id)
               VALUES (?,?,?,?,?)""",
            (task_id, 'shopping', item_name, si_id, list_id)
        )

    db.commit()
    rows = db.execute("""
        SELECT r.*,
               inv.name AS inv_name, inv.status AS inv_status, inv.location AS inv_location,
               si.name  AS si_name,  si.is_checked,
               sl.name  AS sl_name
        FROM task_requirements r
        LEFT JOIN inventory_items inv ON r.inventory_item_id = inv.id
        LEFT JOIN shopping_items  si  ON r.shopping_item_id  = si.id
        LEFT JOIN shopping_lists  sl  ON r.shopping_list_id  = sl.id
        WHERE r.id = ?
    """, (cur.lastrowid,)).fetchone()
    return jsonify(_req_row(rows)), 201


@bp.route('/task-requirements/<int:req_id>', methods=['DELETE'])
def delete_requirement(req_id):
    db = get_db()
    db.execute("DELETE FROM task_requirements WHERE id=?", (req_id,))
    db.commit()
    return '', 204
