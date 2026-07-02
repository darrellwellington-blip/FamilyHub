from flask import Blueprint, request, jsonify
from database import get_db

bp = Blueprint('tasks', __name__)

ALLOWED_FIELDS = {
    'title', 'description', 'category', 'priority', 'is_active', 'photo_path',
    'assigned_to', 'parent_task_id', 'due_date', 'due_time',
    'recurrence_type', 'recurrence_unit', 'recurrence_interval', 'recurrence_months',
    'recurrence_days', 'recurrence_start',
    'recurrence_end_type', 'recurrence_end_date', 'recurrence_end_count',
}


@bp.route('/tasks', methods=['GET'])
def list_tasks():
    db = get_db()
    query = """SELECT t.id, t.title, t.description, t.category, t.priority,
                      t.is_active, t.photo_path, t.assigned_to, t.parent_task_id,
                      t.due_date, t.due_time, t.recurrence_type, t.recurrence_unit,
                      t.recurrence_interval, t.recurrence_months, t.recurrence_days,
                      t.recurrence_start, t.recurrence_end_type, t.recurrence_end_date,
                      t.recurrence_end_count, t.created_at,
                      u.name AS assigned_to_name, p.title AS parent_title
               FROM tasks t
               LEFT JOIN users u ON t.assigned_to = u.id
               LEFT JOIN tasks p ON t.parent_task_id = p.id
               WHERE 1=1"""
    params = []

    for col in ('category', 'priority', 'recurrence_type'):
        val = request.args.get(col)
        if val:
            query += f" AND t.{col} = ?"
            params.append(val)

    is_active = request.args.get('is_active')
    if is_active is not None:
        query += " AND t.is_active = ?"
        params.append(1 if is_active.lower() == 'true' else 0)

    query += " ORDER BY CASE t.priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END, t.title"
    tasks = [dict(row) for row in db.execute(query, params).fetchall()]

    for task in tasks:
        last = db.execute(
            "SELECT completed_at FROM task_completions WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1",
            (task['id'],)
        ).fetchone()
        task['last_completed_at'] = last['completed_at'] if last else None
        count = db.execute(
            "SELECT COUNT(*) FROM task_completions WHERE task_id = ?", (task['id'],)
        ).fetchone()
        task['completion_count'] = count[0]
        sub = db.execute(
            "SELECT COUNT(*) as total, SUM(CASE WHEN last_done.completed_at IS NOT NULL THEN 1 ELSE 0 END) as done "
            "FROM tasks s LEFT JOIN ("
            "  SELECT task_id, MAX(completed_at) as completed_at FROM task_completions GROUP BY task_id"
            ") last_done ON s.id = last_done.task_id "
            "WHERE s.parent_task_id = ?", (task['id'],)
        ).fetchone()
        task['subtask_count'] = sub['total'] or 0
        task['subtasks_done'] = sub['done']  or 0
        req = db.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE
                     WHEN r.type='inventory' AND inv.status='active' THEN 1
                     WHEN r.type='shopping'  AND si.is_checked=1     THEN 1
                     ELSE 0 END) as ready
            FROM task_requirements r
            LEFT JOIN inventory_items inv ON r.inventory_item_id = inv.id
            LEFT JOIN shopping_items  si  ON r.shopping_item_id  = si.id
            WHERE r.task_id = ?
        """, (task['id'],)).fetchone()
        task['req_count'] = req['total'] or 0
        task['req_ready'] = int(req['ready'] or 0)

    return jsonify(tasks)


@bp.route('/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        """INSERT INTO tasks
               (title, description, category, priority, is_active, photo_path,
                assigned_to, parent_task_id, due_date, due_time,
                recurrence_type, recurrence_unit, recurrence_interval, recurrence_months,
                recurrence_days, recurrence_start,
                recurrence_end_type, recurrence_end_date, recurrence_end_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (data.get('title'), data.get('description'),
         data.get('category', 'Home'), data.get('priority', 'Medium'),
         data.get('is_active', 1), data.get('photo_path'),
         data.get('assigned_to'), data.get('parent_task_id'), data.get('due_date'), data.get('due_time'),
         data.get('recurrence_type', 'One-time'), data.get('recurrence_unit'),
         data.get('recurrence_interval'), data.get('recurrence_months'),
         data.get('recurrence_days'), data.get('recurrence_start'),
         data.get('recurrence_end_type', 'never'), data.get('recurrence_end_date'),
         data.get('recurrence_end_count'))
    )
    db.commit()
    task = dict(db.execute("SELECT * FROM tasks WHERE id = ?", (cur.lastrowid,)).fetchone())
    return jsonify(task), 201


@bp.route('/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    db = get_db()
    task = db.execute(
        "SELECT t.*, u.name AS assigned_to_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.id = ?",
        (task_id,)).fetchone()
    if not task:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(task))


@bp.route('/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM tasks WHERE id = ?", (task_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404

    updates = {k: v for k, v in data.items() if k in ALLOWED_FIELDS}
    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE tasks SET {set_clause} WHERE id = ?",
                   list(updates.values()) + [task_id])
        db.commit()

    return jsonify(dict(db.execute(
        "SELECT t.*, u.name AS assigned_to_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.id = ?",
        (task_id,)).fetchone()))


@bp.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    db = get_db()
    db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    db.commit()
    return '', 204


# ─── Completions ─────────────────────────────────────────────────────────────

@bp.route('/tasks/<int:task_id>/completions', methods=['GET'])
def list_completions(task_id):
    db = get_db()
    rows = db.execute(
        """SELECT tc.*, u.name AS user_name
           FROM task_completions tc
           LEFT JOIN users u ON tc.completed_by = u.id
           WHERE tc.task_id = ?
           ORDER BY tc.completed_at DESC""",
        (task_id,)
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route('/tasks/<int:task_id>/completions', methods=['POST'])
def add_completion(task_id):
    data = request.get_json()
    db = get_db()
    if not db.execute("SELECT id FROM tasks WHERE id = ?", (task_id,)).fetchone():
        return jsonify({'error': 'Not found'}), 404

    cur = db.execute(
        """INSERT INTO task_completions (task_id, completed_at, completed_by, notes, photo_path)
           VALUES (?, ?, ?, ?, ?)""",
        (task_id, data.get('completed_at'), data.get('completed_by'),
         data.get('notes'), data.get('photo_path'))
    )
    db.commit()
    row = db.execute(
        """SELECT tc.*, u.name AS user_name
           FROM task_completions tc
           LEFT JOIN users u ON tc.completed_by = u.id
           WHERE tc.id = ?""",
        (cur.lastrowid,)
    ).fetchone()
    return jsonify(dict(row)), 201


@bp.route('/tasks/completions/<int:completion_id>', methods=['PUT'])
def update_completion(completion_id):
    data = request.get_json()
    db = get_db()
    allowed = {'completed_at', 'completed_by', 'notes', 'photo_path'}
    updates = {k: v for k, v in data.items() if k in allowed}
    if updates:
        set_clause = ', '.join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE task_completions SET {set_clause} WHERE id = ?",
                   list(updates.values()) + [completion_id])
        db.commit()
    row = db.execute(
        """SELECT tc.*, u.name AS user_name
           FROM task_completions tc
           LEFT JOIN users u ON tc.completed_by = u.id
           WHERE tc.id = ?""",
        (completion_id,)
    ).fetchone()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))


@bp.route('/tasks/completions/<int:completion_id>', methods=['DELETE'])
def delete_completion(completion_id):
    db = get_db()
    db.execute("DELETE FROM task_completions WHERE id = ?", (completion_id,))
    db.commit()
    return '', 204
