from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('shopping', __name__)


def list_with_items(db, lst):
    d = dict(lst)
    items = db.execute(
        """SELECT si.*, u1.name AS added_by_name, u2.name AS checked_by_name
           FROM shopping_items si
           LEFT JOIN users u1 ON si.added_by = u1.id
           LEFT JOIN users u2 ON si.checked_by = u2.id
           WHERE si.list_id = ?
           ORDER BY si.added_at""",
        (lst['id'],)
    ).fetchall()
    d['items'] = [dict(i) for i in items]
    return d


# ─── Shopping lists ───────────────────────────────────────────────────────────

@bp.route('/shopping/lists', methods=['GET'])
def list_shopping_lists():
    db = get_db()
    archived = request.args.get('archived', 'false').lower() == 'true'
    rows = db.execute(
        """SELECT sl.*,
            COALESCE((SELECT COUNT(*) FROM shopping_items si
                      WHERE si.list_id = sl.id), 0) AS item_count,
            COALESCE((SELECT COUNT(*) FROM shopping_items si
                      WHERE si.list_id = sl.id AND si.is_checked = 1), 0) AS checked_count
           FROM shopping_lists sl
           WHERE sl.is_archived = ?
           ORDER BY sl.created_at DESC""",
        (1 if archived else 0,)
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route('/shopping/lists', methods=['POST'])
def create_list():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO shopping_lists (name, store_name, created_by, is_template) VALUES (?, ?, ?, ?)",
        (data.get('name'), data.get('store_name'), data.get('created_by'),
         1 if data.get('is_template') else 0)
    )
    db.commit()
    return jsonify(list_with_items(db, db.execute(
        "SELECT * FROM shopping_lists WHERE id = ?", (cur.lastrowid,)
    ).fetchone())), 201


@bp.route('/shopping/lists/<int:list_id>', methods=['GET'])
def get_list(list_id):
    db = get_db()
    lst = db.execute("SELECT * FROM shopping_lists WHERE id = ?", (list_id,)).fetchone()
    if not lst:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(list_with_items(db, lst))


@bp.route('/shopping/lists/<int:list_id>', methods=['PUT'])
def update_list(list_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM shopping_lists WHERE id = ?", (list_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404
    allowed = {'name', 'store_name', 'is_template'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE shopping_lists SET {set_clause} WHERE id = ?",
                   list(updates.values()) + [list_id])
        db.commit()
    return jsonify(list_with_items(db, db.execute(
        "SELECT * FROM shopping_lists WHERE id = ?", (list_id,)
    ).fetchone()))


@bp.route('/shopping/lists/<int:list_id>', methods=['DELETE'])
def delete_list(list_id):
    db = get_db()
    db.execute("DELETE FROM shopping_lists WHERE id = ?", (list_id,))
    db.commit()
    return '', 204


@bp.route('/shopping/lists/<int:list_id>/archive', methods=['POST'])
def archive_list(list_id):
    db = get_db()
    db.execute(
        "UPDATE shopping_lists SET is_archived = 1, completed_at = datetime('now') WHERE id = ?",
        (list_id,)
    )
    db.commit()
    return jsonify(list_with_items(db, db.execute(
        "SELECT * FROM shopping_lists WHERE id = ?", (list_id,)
    ).fetchone()))


# ─── Complete a purchase (without archiving the list) ────────────────────────

def purchase_detail(db, rec):
    d = dict(rec)
    d['items'] = [dict(r) for r in db.execute(
        "SELECT * FROM purchase_record_items WHERE purchase_id = ? ORDER BY id",
        (rec['id'],)
    ).fetchall()]
    return d


@bp.route('/shopping/purchases', methods=['GET'])
def list_purchases():
    db = get_db()
    list_id   = request.args.get('list_id')
    store     = request.args.get('store_name')
    query     = "SELECT * FROM purchase_records WHERE 1=1"
    params    = []
    if list_id:
        query += " AND list_id = ?"; params.append(list_id)
    if store:
        query += " AND store_name = ?"; params.append(store)
    query += " ORDER BY purchased_at DESC"
    rows = db.execute(query, params).fetchall()
    return jsonify([purchase_detail(db, r) for r in rows])


@bp.route('/shopping/lists/<int:list_id>/purchase', methods=['POST'])
def record_purchase(list_id):
    """Record what was bought, remove purchased items from the list, re-add carry-backs."""
    data = request.get_json() or {}
    db   = get_db()
    lst  = db.execute("SELECT * FROM shopping_lists WHERE id = ?", (list_id,)).fetchone()
    if not lst:
        return jsonify({'error': 'Not found'}), 404

    purchased_ids  = set(data.get('purchased_ids',  []))
    carry_back_ids = set(data.get('carry_back_ids', []))

    # Create the purchase record
    cur = db.execute(
        "INSERT INTO purchase_records (list_id, store_name, notes) VALUES (?, ?, ?)",
        (list_id, lst['store_name'], data.get('notes'))
    )
    db.commit()
    purchase_id = cur.lastrowid

    # Save purchased items to the record
    for item_id in purchased_ids:
        item = db.execute("SELECT * FROM shopping_items WHERE id = ? AND list_id = ?",
                          (item_id, list_id)).fetchone()
        if item:
            db.execute(
                "INSERT INTO purchase_record_items (purchase_id, name, quantity, unit, is_recurring) VALUES (?,?,?,?,?)",
                (purchase_id, item['name'], item['quantity'], item['unit'], item['is_recurring'])
            )
    db.commit()

    # Remove purchased items from the list (except carry-backs — those get unchecked instead)
    for item_id in purchased_ids:
        if item_id in carry_back_ids:
            db.execute("UPDATE shopping_items SET is_checked=0, checked_by=NULL, checked_at=NULL WHERE id=?", (item_id,))
        else:
            db.execute("DELETE FROM shopping_items WHERE id = ? AND list_id = ?", (item_id, list_id))
    db.commit()

    return jsonify(purchase_detail(db, db.execute(
        "SELECT * FROM purchase_records WHERE id = ?", (purchase_id,)
    ).fetchone())), 201


# ─── Template: start new trip ────────────────────────────────────────────────

@bp.route('/shopping/lists/<int:list_id>/new-trip', methods=['POST'])
def new_trip(list_id):
    """Create a dated trip list from a template, copying all its items."""
    db = get_db()
    tmpl = db.execute("SELECT * FROM shopping_lists WHERE id = ? AND is_template = 1", (list_id,)).fetchone()
    if not tmpl:
        return jsonify({'error': 'Template not found'}), 404

    from datetime import date
    trip_name = f"{tmpl['name']} – {date.today().strftime('%b %-d')}"
    cur = db.execute(
        "INSERT INTO shopping_lists (name, store_name, created_by, is_template, template_id) VALUES (?, ?, ?, 0, ?)",
        (trip_name, tmpl['store_name'], tmpl['created_by'], list_id)
    )
    db.commit()
    trip_id = cur.lastrowid

    items = db.execute("SELECT * FROM shopping_items WHERE list_id = ?", (list_id,)).fetchall()
    for item in items:
        db.execute(
            """INSERT INTO shopping_items
               (list_id, name, quantity, unit, description, notes, is_recurring, added_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (trip_id, item['name'], item['quantity'], item['unit'],
             item['description'], item['notes'], item['is_recurring'], item['added_by'])
        )
    db.commit()

    return jsonify(list_with_items(db, db.execute(
        "SELECT * FROM shopping_lists WHERE id = ?", (trip_id,)
    ).fetchone())), 201


@bp.route('/shopping/lists/<int:list_id>/trips', methods=['GET'])
def list_trips(list_id):
    """Return all completed trips for a template."""
    db = get_db()
    rows = db.execute(
        """SELECT sl.*,
            COALESCE((SELECT COUNT(*) FROM shopping_items si WHERE si.list_id = sl.id), 0) AS item_count,
            COALESCE((SELECT COUNT(*) FROM shopping_items si WHERE si.list_id = sl.id AND si.is_checked = 1), 0) AS checked_count
           FROM shopping_lists sl
           WHERE sl.template_id = ? AND sl.is_archived = 1
           ORDER BY sl.completed_at DESC""",
        (list_id,)
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route('/shopping/lists/<int:list_id>/complete', methods=['POST'])
def complete_trip(list_id):
    """Complete a trip: archive it and optionally carry recurring items back to template."""
    data = request.get_json() or {}
    db = get_db()
    trip = db.execute("SELECT * FROM shopping_lists WHERE id = ? AND is_template = 0", (list_id,)).fetchone()
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404

    db.execute(
        "UPDATE shopping_lists SET is_archived = 1, completed_at = datetime('now') WHERE id = ?",
        (list_id,)
    )
    db.commit()

    # If caller wants to add recurring purchased items back to the template
    carry_back = data.get('carry_back_ids', [])
    if carry_back and trip['template_id']:
        tmpl_id = trip['template_id']
        existing = {
            r['name'].lower()
            for r in db.execute("SELECT name FROM shopping_items WHERE list_id = ?", (tmpl_id,)).fetchall()
        }
        for item_id in carry_back:
            item = db.execute("SELECT * FROM shopping_items WHERE id = ? AND list_id = ?",
                              (item_id, list_id)).fetchone()
            if item and item['name'].lower() not in existing:
                db.execute(
                    """INSERT INTO shopping_items (list_id, name, quantity, unit, is_recurring)
                       VALUES (?, ?, ?, ?, 1)""",
                    (tmpl_id, item['name'], item['quantity'], item['unit'])
                )
        db.commit()

    return jsonify(list_with_items(db, db.execute(
        "SELECT * FROM shopping_lists WHERE id = ?", (list_id,)
    ).fetchone()))


# ─── Shopping items ───────────────────────────────────────────────────────────

@bp.route('/shopping/lists/<int:list_id>/items', methods=['GET'])
def list_items(list_id):
    db = get_db()
    items = db.execute(
        """SELECT si.*, u1.name AS added_by_name, u2.name AS checked_by_name
           FROM shopping_items si
           LEFT JOIN users u1 ON si.added_by = u1.id
           LEFT JOIN users u2 ON si.checked_by = u2.id
           WHERE si.list_id = ?
           ORDER BY si.is_checked, si.added_at""",
        (list_id,)
    ).fetchall()
    return jsonify([dict(i) for i in items])


@bp.route('/shopping/lists/<int:list_id>/items', methods=['POST'])
def add_item(list_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM shopping_lists WHERE id = ?", (list_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404
    cur = db.execute(
        """INSERT INTO shopping_items
               (list_id, name, quantity, unit, description, notes, photo_path, is_recurring, added_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (list_id, data.get('name'), data.get('quantity', 1), data.get('unit'),
         data.get('description'), data.get('notes'), data.get('photo_path'),
         1 if data.get('is_recurring') else 0, data.get('added_by'))
    )
    db.commit()
    return jsonify(dict(db.execute("SELECT * FROM shopping_items WHERE id = ?", (cur.lastrowid,)).fetchone())), 201


@bp.route('/shopping/items/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    data = request.get_json()
    db = get_db()
    allowed = {'name', 'quantity', 'unit', 'description', 'notes', 'photo_path', 'is_recurring'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE shopping_items SET {set_clause} WHERE id = ?",
                   list(updates.values()) + [item_id])
        db.commit()
    row = db.execute("SELECT * FROM shopping_items WHERE id = ?", (item_id,)).fetchone()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))


@bp.route('/shopping/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    db = get_db()
    db.execute("DELETE FROM shopping_items WHERE id = ?", (item_id,))
    db.commit()
    return '', 204


@bp.route('/shopping/items/<int:item_id>/check', methods=['PATCH'])
def check_item(item_id):
    data = request.get_json()
    db = get_db()
    row = db.execute("SELECT * FROM shopping_items WHERE id = ?", (item_id,)).fetchone()
    if not row:
        return jsonify({'error': 'Not found'}), 404

    checked = data.get('is_checked', not row['is_checked'])
    if checked:
        db.execute(
            """UPDATE shopping_items
               SET is_checked = 1, checked_by = ?, checked_at = datetime('now')
               WHERE id = ?""",
            (data.get('checked_by'), item_id)
        )
    else:
        db.execute(
            "UPDATE shopping_items SET is_checked = 0, checked_by = NULL, checked_at = NULL WHERE id = ?",
            (item_id,)
        )
    db.commit()
    return jsonify(dict(db.execute("SELECT * FROM shopping_items WHERE id = ?", (item_id,)).fetchone()))


# ─── Store item library ───────────────────────────────────────────────────────

@bp.route('/shopping/library', methods=['GET'])
def list_library():
    db = get_db()
    store = request.args.get('store')
    if store:
        rows = db.execute(
            "SELECT * FROM store_item_library WHERE store_name = ? ORDER BY item_name",
            (store,)
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM store_item_library ORDER BY store_name, item_name"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route('/shopping/library', methods=['POST'])
def add_library_item():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO store_item_library (store_name, item_name, default_quantity, default_unit, notes) VALUES (?, ?, ?, ?, ?)",
        (data.get('store_name'), data.get('item_name'),
         data.get('default_quantity', 1), data.get('default_unit'), data.get('notes'))
    )
    db.commit()
    return jsonify(dict(db.execute("SELECT * FROM store_item_library WHERE id = ?", (cur.lastrowid,)).fetchone())), 201


@bp.route('/shopping/library/<int:lib_id>', methods=['PUT'])
def update_library_item(lib_id):
    data = request.get_json()
    db = get_db()
    allowed = {'store_name', 'item_name', 'default_quantity', 'default_unit', 'notes'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE store_item_library SET {set_clause} WHERE id = ?",
                   list(updates.values()) + [lib_id])
        db.commit()
    row = db.execute("SELECT * FROM store_item_library WHERE id = ?", (lib_id,)).fetchone()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))


@bp.route('/shopping/library/<int:lib_id>', methods=['DELETE'])
def delete_library_item(lib_id):
    db = get_db()
    db.execute("DELETE FROM store_item_library WHERE id = ?", (lib_id,))
    db.commit()
    return '', 204
