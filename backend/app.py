import os
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from database import get_db, close_db, init_db
from routes.users import bp as users_bp
from routes.tasks import bp as tasks_bp
from routes.meals import bp as meals_bp
from routes.shopping import bp as shopping_bp
from routes.purchases import bp as purchases_bp
from routes.inventory import bp as inventory_bp
from routes.adventures import bp as adventures_bp
from routes.minigolf import bp as minigolf_bp
from routes.bowling import bp as bowling_bp
from routes.movies import bp as movies_bp
from routes.categories import bp as categories_bp
from routes.collections import bp as collections_bp
from routes.task_requirements import bp as task_requirements_bp

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
VALID_SECTIONS = {'tasks', 'meals', 'shopping', 'purchases', 'inventory'}

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB upload limit
CORS(app)

# Register blueprints — all routes live under /api
for bp in (users_bp, tasks_bp, meals_bp, shopping_bp, purchases_bp, inventory_bp,
           adventures_bp, minigolf_bp, bowling_bp, movies_bp, categories_bp,
           collections_bp, task_requirements_bp):
    app.register_blueprint(bp, url_prefix='/api')


# ─── File upload ──────────────────────────────────────────────────────────────

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/api/upload/<section>', methods=['POST'])
def upload_file(section):
    if section not in VALID_SECTIONS:
        return jsonify({'error': f"Invalid section '{section}'"}), 400

    if 'file' not in request.files:
        return jsonify({'error': 'No file field in request'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400

    safe_name = secure_filename(file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    unique_name = f"{timestamp}_{safe_name}"

    dest_dir = os.path.join(UPLOAD_FOLDER, section)
    os.makedirs(dest_dir, exist_ok=True)
    file.save(os.path.join(dest_dir, unique_name))

    return jsonify({'path': f"uploads/{section}/{unique_name}"}), 201


# ─── Static file serving for uploads ─────────────────────────────────────────

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# ─── Serve built React app ────────────────────────────────────────────────────

DIST_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'dist')

@app.route('/', defaults={'path': ''}, methods=['GET'])
@app.route('/<path:path>', methods=['GET'])
def serve_react(path):
    # Serve actual files (JS, CSS, images) from dist
    file_path = os.path.join(DIST_FOLDER, path)
    if path and os.path.isfile(file_path):
        return send_from_directory(DIST_FOLDER, path)
    # All other routes → index.html (React Router handles them)
    return send_from_directory(DIST_FOLDER, 'index.html')


# ─── Error handlers ───────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large (max 16 MB)'}), 413


@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error', 'detail': str(e)}), 500


# ─── Teardown ─────────────────────────────────────────────────────────────────

app.teardown_appcontext(close_db)


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == '__main__':
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    for section in VALID_SECTIONS:
        os.makedirs(os.path.join(UPLOAD_FOLDER, section), exist_ok=True)
    init_db(app)
    app.run(host='0.0.0.0', port=5000, debug=False)
