PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

INSERT OR IGNORE INTO users (id, name) VALUES
    (1, 'Darrell'),
    (2, 'Shannon'),
    (3, 'Emily'),
    (4, 'Caitlyn');

-- ─── TASKS ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    title                TEXT NOT NULL,
    description          TEXT,
    category             TEXT DEFAULT 'Home',
    priority             TEXT DEFAULT 'Medium',
    recurrence_type      TEXT DEFAULT 'One-time',  -- 'One-time' | 'Recurring' | 'Seasonal'
    recurrence_unit      TEXT,                      -- 'days' | 'weeks' | 'months' | 'years'
    recurrence_interval  INTEGER,                   -- every N units
    recurrence_months    TEXT,                      -- JSON [1..12] for Seasonal
    recurrence_days      TEXT,                      -- JSON [0..6] (0=Mon) for weeks
    recurrence_anchor    TEXT,                      -- "MM-DD" for years, "DD" for months
    is_active            INTEGER DEFAULT 1,
    photo_path           TEXT,
    created_at           TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_completions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    completed_at TEXT    DEFAULT (datetime('now')),
    completed_by INTEGER REFERENCES users(id),
    notes        TEXT,
    photo_path   TEXT
);

-- ─── MEALS ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meals (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT NOT NULL,
    description        TEXT,
    photo_path         TEXT,
    category           TEXT,
    recipe             TEXT,
    min_frequency_days INTEGER DEFAULT 0,
    created_at         TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meal_ingredients (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id    INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    quantity   TEXT,
    unit       TEXT,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meal_ratings (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id   INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id),
    rating    INTEGER NOT NULL,
    rated_at  TEXT    DEFAULT (datetime('now')),
    UNIQUE (meal_id, user_id)
);

CREATE TABLE IF NOT EXISTS meal_history (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id  INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    made_at  TEXT    DEFAULT (datetime('now')),
    notes    TEXT
);

CREATE TABLE IF NOT EXISTS meals_to_try (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    description      TEXT,
    photo_path       TEXT,
    proposed_by      INTEGER REFERENCES users(id),
    proposed_at      TEXT    DEFAULT (datetime('now')),
    promoted_meal_id INTEGER REFERENCES meals(id)
);

CREATE TABLE IF NOT EXISTS meal_try_votes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_try_id  INTEGER NOT NULL REFERENCES meals_to_try(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    vote         TEXT    NOT NULL,   -- 'thumbs_up' or 'thumbs_down'
    voted_at     TEXT    DEFAULT (datetime('now')),
    UNIQUE (meal_try_id, user_id)
);

CREATE TABLE IF NOT EXISTS restaurants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    cuisine    TEXT,
    dine_in    INTEGER DEFAULT 1,
    takeout    INTEGER DEFAULT 1,
    notes      TEXT,
    created_at TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurant_ratings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    rating        INTEGER NOT NULL,
    rated_at      TEXT    DEFAULT (datetime('now')),
    UNIQUE (restaurant_id, user_id)
);

CREATE TABLE IF NOT EXISTS restaurant_visits (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    visited_at    TEXT    DEFAULT (datetime('now')),
    visit_type    TEXT,   -- 'dine_in' or 'takeout'
    notes         TEXT
);

CREATE TABLE IF NOT EXISTS restaurant_visit_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id   INTEGER NOT NULL REFERENCES restaurant_visits(id) ON DELETE CASCADE,
    item_name  TEXT NOT NULL,
    rating     INTEGER,
    photo_path TEXT,
    notes      TEXT
);

-- Each row is one day/meal-type cell in a week. week_start is the Monday ISO date.
CREATE TABLE IF NOT EXISTS meal_plan_slots (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start     TEXT    NOT NULL,
    day_of_week    INTEGER NOT NULL,   -- 0=Mon … 6=Sun
    meal_type      TEXT    NOT NULL,   -- 'breakfast' | 'lunch' | 'dinner'
    slot_type      TEXT    DEFAULT 'empty',  -- 'meal'|'restaurant'|'leftovers'|'out'|'empty'
    meal_id        INTEGER REFERENCES meals(id),
    restaurant_id  INTEGER REFERENCES restaurants(id),
    leftovers_note TEXT,
    cook_id        INTEGER REFERENCES users(id),
    reminder_time  TEXT,   -- HH:MM
    UNIQUE (week_start, day_of_week, meal_type)
);

CREATE TABLE IF NOT EXISTS meal_plan_slot_attendees (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER NOT NULL REFERENCES meal_plan_slots(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    UNIQUE (slot_id, user_id)
);

-- ─── SHOPPING ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shopping_lists (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    store_name   TEXT,
    created_by   INTEGER REFERENCES users(id),
    created_at   TEXT    DEFAULT (datetime('now')),
    completed_at TEXT,
    is_archived  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shopping_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id     INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    quantity    REAL    DEFAULT 1,
    unit        TEXT,
    description TEXT,
    notes       TEXT,
    photo_path  TEXT,
    is_checked  INTEGER DEFAULT 0,
    added_by    INTEGER REFERENCES users(id),
    added_at    TEXT    DEFAULT (datetime('now')),
    checked_by  INTEGER REFERENCES users(id),
    checked_at  TEXT
);

CREATE TABLE IF NOT EXISTS store_item_library (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    store_name       TEXT NOT NULL,
    item_name        TEXT NOT NULL,
    default_quantity REAL DEFAULT 1,
    default_unit     TEXT,
    notes            TEXT
);

-- ─── PURCHASES ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchases (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    store        TEXT,
    purchased_at TEXT    DEFAULT (datetime('now')),
    notes        TEXT,
    created_by   INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    quantity    REAL    DEFAULT 1,
    unit_price  REAL,
    photo_path  TEXT,
    notes       TEXT
);

-- ─── INVENTORY ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    description      TEXT,
    category         TEXT,
    location         TEXT,
    quantity         REAL DEFAULT 1,
    unit             TEXT,
    best_before_date TEXT,
    purchase_date    TEXT,
    purchase_price   REAL,
    store            TEXT,
    serial_number    TEXT,
    model_number     TEXT,
    estimated_value  REAL,
    notes            TEXT,
    status           TEXT DEFAULT 'active',   -- 'active' | 'consumed' | 'disposed'
    removed_at       TEXT,
    removal_notes    TEXT,
    created_at       TEXT DEFAULT (datetime('now')),
    updated_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_photos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id    INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    photo_path TEXT    NOT NULL,
    sort_order INTEGER DEFAULT 1
);

-- ─── ADVENTURES ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cities (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL,
    province TEXT,
    country  TEXT DEFAULT 'Canada'
);

CREATE TABLE IF NOT EXISTS escape_room_venues (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT    NOT NULL,
    city_id INTEGER NOT NULL REFERENCES cities(id),
    address TEXT,
    website TEXT,
    notes   TEXT
);

CREATE TABLE IF NOT EXISTS escape_rooms (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id         INTEGER NOT NULL REFERENCES escape_room_venues(id) ON DELETE CASCADE,
    name             TEXT    NOT NULL,
    min_participants INTEGER,
    max_participants INTEGER,
    difficulty       TEXT,
    description      TEXT,
    is_active        INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS friends (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name  TEXT,
    email      TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escape_room_completions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id         INTEGER NOT NULL REFERENCES escape_rooms(id) ON DELETE CASCADE,
    played_at       TEXT,
    escaped         INTEGER,   -- NULL=unknown, 0=no, 1=yes
    time_taken_mins INTEGER,
    rating          INTEGER,   -- 1-5
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escape_room_completion_users (
    completion_id INTEGER NOT NULL REFERENCES escape_room_completions(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (completion_id, user_id)
);

CREATE TABLE IF NOT EXISTS escape_room_completion_friends (
    completion_id INTEGER NOT NULL REFERENCES escape_room_completions(id) ON DELETE CASCADE,
    friend_id     INTEGER NOT NULL REFERENCES friends(id),
    PRIMARY KEY (completion_id, friend_id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id         INTEGER PRIMARY KEY REFERENCES users(id),
    default_city_id INTEGER REFERENCES cities(id)
);

CREATE TABLE IF NOT EXISTS escape_room_completion_ratings (
    completion_id INTEGER NOT NULL REFERENCES escape_room_completions(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    rating        INTEGER NOT NULL,
    PRIMARY KEY (completion_id, user_id)
);

-- ─── MINI GOLF ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mini_golf_venues (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    city_id INTEGER NOT NULL REFERENCES cities(id),
    name    TEXT NOT NULL,
    address TEXT,
    website TEXT,
    notes   TEXT
);

CREATE TABLE IF NOT EXISTS mini_golf_courses (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id  INTEGER NOT NULL REFERENCES mini_golf_venues(id) ON DELETE CASCADE,
    name      TEXT    NOT NULL,
    holes     INTEGER DEFAULT 18,
    par       INTEGER,
    notes     TEXT,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mini_golf_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id  INTEGER NOT NULL REFERENCES mini_golf_courses(id) ON DELETE CASCADE,
    played_at  TEXT,
    notes      TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mini_golf_session_users (
    session_id INTEGER NOT NULL REFERENCES mini_golf_sessions(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS mini_golf_session_friends (
    session_id INTEGER NOT NULL REFERENCES mini_golf_sessions(id) ON DELETE CASCADE,
    friend_id  INTEGER NOT NULL REFERENCES friends(id),
    PRIMARY KEY (session_id, friend_id)
);

CREATE TABLE IF NOT EXISTS mini_golf_scores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL REFERENCES mini_golf_sessions(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    total_score INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mini_golf_ratings (
    session_id INTEGER NOT NULL REFERENCES mini_golf_sessions(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    rating     INTEGER NOT NULL,
    PRIMARY KEY (session_id, user_id)
);

-- ─── BOWLING ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bowling_venues (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    city_id INTEGER NOT NULL REFERENCES cities(id),
    name    TEXT NOT NULL,
    address TEXT,
    website TEXT,
    notes   TEXT
);

CREATE TABLE IF NOT EXISTS bowling_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id   INTEGER NOT NULL REFERENCES bowling_venues(id) ON DELETE CASCADE,
    played_at  TEXT,
    notes      TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bowling_session_users (
    session_id INTEGER NOT NULL REFERENCES bowling_sessions(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS bowling_session_friends (
    session_id INTEGER NOT NULL REFERENCES bowling_sessions(id) ON DELETE CASCADE,
    friend_id  INTEGER NOT NULL REFERENCES friends(id),
    PRIMARY KEY (session_id, friend_id)
);

CREATE TABLE IF NOT EXISTS bowling_scores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL REFERENCES bowling_sessions(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    game_number INTEGER NOT NULL DEFAULT 1,
    score       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bowling_ratings (
    session_id INTEGER NOT NULL REFERENCES bowling_sessions(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    rating     INTEGER NOT NULL,
    PRIMARY KEY (session_id, user_id)
);

-- ─── MOVIES ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS movies (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    year       INTEGER,
    genre      TEXT,
    notes      TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS movie_viewings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id     INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    viewed_at    TEXT,
    venue_type   TEXT DEFAULT 'home',  -- 'theater' or 'home'
    theater_name TEXT,
    notes        TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS movie_viewing_users (
    viewing_id INTEGER NOT NULL REFERENCES movie_viewings(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (viewing_id, user_id)
);

CREATE TABLE IF NOT EXISTS movie_viewing_friends (
    viewing_id INTEGER NOT NULL REFERENCES movie_viewings(id) ON DELETE CASCADE,
    friend_id  INTEGER NOT NULL REFERENCES friends(id),
    PRIMARY KEY (viewing_id, friend_id)
);

CREATE TABLE IF NOT EXISTS movie_viewing_ratings (
    viewing_id INTEGER NOT NULL REFERENCES movie_viewings(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    rating     INTEGER NOT NULL,
    PRIMARY KEY (viewing_id, user_id)
);
