"""
Migrate: add per-person ratings tables + mini golf / bowling / movies tables.
Seed: Blackbird Marshes mini golf, migrate existing escape room ratings.
Safe to re-run.
"""
import sqlite3, os

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'familyhub.db')
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA foreign_keys = ON")

conn.executescript("""
CREATE TABLE IF NOT EXISTS escape_room_completion_ratings (
    completion_id INTEGER NOT NULL REFERENCES escape_room_completions(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    rating        INTEGER NOT NULL,
    PRIMARY KEY (completion_id, user_id)
);

CREATE TABLE IF NOT EXISTS mini_golf_venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_id INTEGER NOT NULL REFERENCES cities(id),
    name TEXT NOT NULL, address TEXT, website TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS mini_golf_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id INTEGER NOT NULL REFERENCES mini_golf_venues(id) ON DELETE CASCADE,
    name TEXT NOT NULL, holes INTEGER DEFAULT 18, par INTEGER, notes TEXT, is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS mini_golf_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES mini_golf_courses(id) ON DELETE CASCADE,
    played_at TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mini_golf_session_users (
    session_id INTEGER NOT NULL REFERENCES mini_golf_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (session_id, user_id)
);
CREATE TABLE IF NOT EXISTS mini_golf_session_friends (
    session_id INTEGER NOT NULL REFERENCES mini_golf_sessions(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES friends(id),
    PRIMARY KEY (session_id, friend_id)
);
CREATE TABLE IF NOT EXISTS mini_golf_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES mini_golf_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total_score INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mini_golf_ratings (
    session_id INTEGER NOT NULL REFERENCES mini_golf_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL,
    PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS bowling_venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_id INTEGER NOT NULL REFERENCES cities(id),
    name TEXT NOT NULL, address TEXT, website TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS bowling_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id INTEGER NOT NULL REFERENCES bowling_venues(id) ON DELETE CASCADE,
    played_at TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS bowling_session_users (
    session_id INTEGER NOT NULL REFERENCES bowling_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (session_id, user_id)
);
CREATE TABLE IF NOT EXISTS bowling_session_friends (
    session_id INTEGER NOT NULL REFERENCES bowling_sessions(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES friends(id),
    PRIMARY KEY (session_id, friend_id)
);
CREATE TABLE IF NOT EXISTS bowling_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES bowling_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    game_number INTEGER NOT NULL DEFAULT 1,
    score INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bowling_ratings (
    session_id INTEGER NOT NULL REFERENCES bowling_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL,
    PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, year INTEGER, genre TEXT, notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS movie_viewings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    viewed_at TEXT, venue_type TEXT DEFAULT 'home',
    theater_name TEXT, notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS movie_viewing_users (
    viewing_id INTEGER NOT NULL REFERENCES movie_viewings(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (viewing_id, user_id)
);
CREATE TABLE IF NOT EXISTS movie_viewing_friends (
    viewing_id INTEGER NOT NULL REFERENCES movie_viewings(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES friends(id),
    PRIMARY KEY (viewing_id, friend_id)
);
CREATE TABLE IF NOT EXISTS movie_viewing_ratings (
    viewing_id INTEGER NOT NULL REFERENCES movie_viewings(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL,
    PRIMARY KEY (viewing_id, user_id)
);
""")
conn.commit()

# ── Migrate escape room ratings → per-person ──────────────────────────────────
already = conn.execute("SELECT COUNT(*) FROM escape_room_completion_ratings").fetchone()[0]
if already == 0:
    completions = conn.execute(
        "SELECT id, rating FROM escape_room_completions WHERE rating IS NOT NULL"
    ).fetchall()
    for comp in completions:
        users = conn.execute(
            "SELECT user_id FROM escape_room_completion_users WHERE completion_id = ?",
            (comp['id'],)
        ).fetchall()
        for u in users:
            conn.execute(
                "INSERT OR IGNORE INTO escape_room_completion_ratings VALUES (?,?,?)",
                (comp['id'], u['user_id'], comp['rating'])
            )
    conn.commit()
    print(f"Migrated ratings for {len(completions)} completions")
else:
    print("Ratings already migrated")

# ── Seed: Blackbird Marshes mini golf (Ottawa) ────────────────────────────────
if conn.execute("SELECT COUNT(*) FROM mini_golf_venues").fetchone()[0] == 0:
    cur = conn.execute(
        "INSERT INTO mini_golf_venues (city_id, name, address) VALUES (1, 'Blackbird Marshes', 'Ottawa, ON')"
    )
    venue_id = cur.lastrowid
    conn.execute(
        "INSERT INTO mini_golf_courses (venue_id, name, holes) VALUES (?, '18-Hole Course', 18)",
        (venue_id,)
    )
    conn.commit()
    print("Seeded Blackbird Marshes mini golf")
else:
    print("Mini golf already seeded")

conn.close()
print("Done.")
