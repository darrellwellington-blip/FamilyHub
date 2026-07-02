"""
Run once to migrate the DB and seed Ottawa escape room data.
Safe to re-run — checks for existing data before inserting.
"""
import sqlite3, os

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'familyhub.db')
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA foreign_keys = ON")

# ── Migrate: create new tables ────────────────────────────────────────────────
conn.executescript("""
CREATE TABLE IF NOT EXISTS cities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, province TEXT, country TEXT DEFAULT 'Canada'
);
CREATE TABLE IF NOT EXISTS escape_room_venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, city_id INTEGER NOT NULL REFERENCES cities(id),
    address TEXT, website TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS escape_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id INTEGER NOT NULL REFERENCES escape_room_venues(id) ON DELETE CASCADE,
    name TEXT NOT NULL, min_participants INTEGER, max_participants INTEGER,
    difficulty TEXT, description TEXT, is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL, last_name TEXT, email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS escape_room_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES escape_rooms(id) ON DELETE CASCADE,
    played_at TEXT, escaped INTEGER, time_taken_mins INTEGER,
    rating INTEGER, notes TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS escape_room_completion_users (
    completion_id INTEGER NOT NULL REFERENCES escape_room_completions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (completion_id, user_id)
);
CREATE TABLE IF NOT EXISTS escape_room_completion_friends (
    completion_id INTEGER NOT NULL REFERENCES escape_room_completions(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES friends(id),
    PRIMARY KEY (completion_id, friend_id)
);
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    default_city_id INTEGER REFERENCES cities(id)
);
""")
conn.commit()

# ── Skip if already seeded ────────────────────────────────────────────────────
if conn.execute("SELECT COUNT(*) FROM cities").fetchone()[0] > 0:
    print("Already seeded — exiting.")
    conn.close()
    exit()

# ── Cities ────────────────────────────────────────────────────────────────────
conn.execute("INSERT INTO cities (id, name, province) VALUES (1, 'Ottawa', 'Ontario')")
conn.commit()
OTTAWA = 1

# ── Venues ────────────────────────────────────────────────────────────────────
venues = [
    (1, 'Trapped Centrum',            OTTAWA),
    (2, 'Unlocked Kanata',            OTTAWA),
    (3, 'Room Escape',                OTTAWA),
    (4, 'Escape Manor Hintonburg',    OTTAWA),
    (5, 'Escape Manor Junior',        OTTAWA),
    (6, 'Escape Manor Diefenbunker',  OTTAWA),
    (7, 'Escape Manor Elgin',         OTTAWA),
    (8, 'Jigsaw Downtown',            OTTAWA),
    (9, 'Lockdown Ogilvie',           OTTAWA),
]
conn.executemany("INSERT INTO escape_room_venues (id, name, city_id) VALUES (?,?,?)", venues)
conn.commit()

# ── Rooms ─────────────────────────────────────────────────────────────────────
# (id, venue_id, name, min_p, max_p)
rooms = [
    # Trapped Centrum
    (1,  1, 'Hotel Dystopia',              4, 8),
    (2,  1, 'Death Note',                  2, 6),
    (3,  1, '7734 Hound Lane',             4, 8),
    (4,  1, 'Room 057',                    3, 7),
    (5,  1, 'Ancient Pyramid',             3, 8),
    # Unlocked Kanata
    (6,  2, 'Shipwrecked',                 2, 8),
    (7,  2, 'Twisted Tales',               2, 6),
    (8,  2, 'Victorian Vampire Mystery',   2, 8),
    (9,  2, 'Ye Olde Toy Factory',         2, 6),
    (10, 2, 'Superheist',                  3, 6),
    # Room Escape
    (11, 3, 'Inkquest',                    2, 8),
    (12, 3, 'Warlocked',                   2, 8),
    (13, 3, 'Undermined',                  2, 8),
    (14, 3, 'Outbreak',                    2, 8),
    (15, 3, 'Serial Killer Charade',       2, 8),
    (16, 3, 'Boom Room',                   2, 8),
    (17, 3, 'Deliverance',                 2, 8),
    # Escape Manor Hintonburg
    (18, 4, 'Carnival',                    2, 6),
    (19, 4, 'Apothecary',                  2, 6),
    (20, 4, 'The Recruit',                 2, 6),
    (21, 4, 'Final Viewing',               2, 6),
    (22, 4, 'Hooked',                      2, 5),
    (23, 4, 'Alice in Wonderland',         2, 6),
    # Escape Manor Junior
    (24, 5, 'Forbidden Forest',            2, 5),
    (25, 5, 'Spy Mission',                 2, 5),
    (26, 5, 'Candy Conspiracy',            2, 5),
    (27, 5, 'The Tomb',                    2, 5),
    (28, 5, 'Atlantis',                    2, 5),
    # Escape Manor Diefenbunker
    (29, 6, 'Covert Ops Original Mission', 6, 12),
    (30, 6, 'Radioactive',                 6, 12),
    # Escape Manor Elgin
    (31, 7, 'Death Row',                   4, 6),
    (32, 7, 'Flight 69',                   4, 6),
    (33, 7, 'Prohibited',                  2, 6),
    (34, 7, 'Sherlock',                    4, 6),
    (35, 7, 'The Illusionist',             2, 6),
    (36, 7, 'The Winemaker',               4, 6),
    # Jigsaw Downtown
    (37, 8, 'Cabin in the Woods',          2, 7),
    (38, 8, 'CSI The Study',               2, 7),
    (39, 8, 'The Diamond Heist',           2, 8),
    (40, 8, 'The Castle',                  4, 9),
    (41, 8, 'The Byward Market Butcher',   6, 12),
    (42, 8, 'The Wild West',               4, 7),
    (43, 8, "The Pirates Code",            3, 6),
    (44, 8, 'The Haunting of Noriko',      4, 8),
]
conn.executemany(
    "INSERT INTO escape_rooms (id, venue_id, name, min_participants, max_participants) VALUES (?,?,?,?,?)",
    rooms
)
conn.commit()

# ── Friends ───────────────────────────────────────────────────────────────────
# (id, first_name)
friends = [
    (1,  'Rob'),     (2,  'Sharon'),  (3,  'Josh'),
    (4,  'Jenna'),   (5,  'Olivia'),  (6,  'Colton'),
    (7,  'Anabelle'),(8,  'Emilie'),  (9,  'Malcom'),
    (10, 'Bruce'),   (11, 'Dave'),    (12, 'Paul'),
    (13, 'Al'),
]
conn.executemany("INSERT INTO friends (id, first_name) VALUES (?,?)", friends)
conn.commit()

# ── User IDs ──────────────────────────────────────────────────────────────────
D, S, E, C = 1, 2, 3, 4  # Darrell, Shannon, Emily, Caitlyn
ROB, SHARON, JOSH, JENNA, OLIVIA, COLTON = 1, 2, 3, 4, 5, 6
ANABELLE, EMILIE, MALCOM, BRUCE, DAVE, PAUL, AL = 7, 8, 9, 10, 11, 12, 13

def add_completion(room_id, played_at, escaped, time_mins, user_ids, friend_ids):
    cur = conn.execute(
        "INSERT INTO escape_room_completions (room_id, played_at, escaped, time_taken_mins) VALUES (?,?,?,?)",
        (room_id, played_at, escaped, time_mins)
    )
    cid = cur.lastrowid
    for uid in user_ids:
        conn.execute("INSERT INTO escape_room_completion_users VALUES (?,?)", (cid, uid))
    for fid in friend_ids:
        conn.execute("INSERT INTO escape_room_completion_friends VALUES (?,?)", (cid, fid))

# ── Completions ───────────────────────────────────────────────────────────────
# Trapped Centrum
add_completion(1, '2025-02-03', 0,    None, [D,S,C,E],     [ROB])
add_completion(2, '2024-10-20', 1,    50,   [D,S,C,E],     [])
add_completion(3, '2025-04-20', None, None, [D,S,C,E],     [SHARON,JOSH,JENNA])
add_completion(5, '2025-07-10', 1,    55,   [D,S,E,C],     [COLTON,ROB])

# Unlocked Kanata
add_completion(6,  '2024-12-10', 1,    40,   [D,S,C,E],    [])
add_completion(7,  '2024-08-10', 1,    50,   [D,S,C,E],    [OLIVIA])
add_completion(8,  None,         None, None, [C],           [])
add_completion(9,  None,         1,    40,   [E],           [])   # separately
add_completion(9,  None,         1,    40,   [C],           [])   # separately
add_completion(10, None,         None, None, [C],           [])

# Room Escape
add_completion(11, '2025-02-10', 1,    55,   [D,S,C,E],    [SHARON,JOSH,JENNA])
add_completion(12, '2024-10-01', 1,    59,   [D,E],         [])
add_completion(13, None,         1,    59,   [D,E],         [])           # separately
add_completion(13, None,         1,    59,   [S,C],         [SHARON,JOSH,JENNA])  # separately
add_completion(14, None,         1,    55,   [D,S,C,E],    [SHARON,JOSH,JENNA])
add_completion(15, None,         1,    55,   [D,S,C,E],    [SHARON,JOSH,JENNA])
add_completion(16, None,         1,    55,   [S,C,E],       [SHARON,JOSH,JENNA])
add_completion(17, None,         1,    58,   [D,S,C,E],    [SHARON,JOSH,JENNA])

# Escape Manor Hintonburg
add_completion(19, None,         1,    50,   [D,S,C,E],    [ROB])
add_completion(20, None,         1,    50,   [D,S,C,E],    [ROB])
add_completion(21, '2025-08-29', 1,    48,   [D,S,C,E],    [ROB,COLTON])
add_completion(22, None,         1,    50,   [D,S,C,E],    [ROB])
add_completion(23, None,         1,    35,   [D,S,C,E],    [ROB])

# Escape Manor Junior
add_completion(24, None,         1,    40,   [D,S,C,E],    [])
add_completion(25, None,         1,    25,   [D,S,C,E],    [])
add_completion(26, None,         None, None, [E,C],         [ANABELLE,EMILIE,OLIVIA])
add_completion(27, '2026-05-08', 1,    30,   [D,S,C,E],    [])
add_completion(28, None,         None, None, [E,C],         [MALCOM,OLIVIA])

# Escape Manor Diefenbunker
add_completion(29, None,         1,    None, [E],           [])
add_completion(30, None,         1,    None, [E],           [])

# Escape Manor Elgin
add_completion(32, None,         1,    None, [D],           [ROB,BRUCE,DAVE,PAUL,AL])
add_completion(33, None,         None, None, [D],           [ROB,BRUCE,DAVE,PAUL,AL])

# Jigsaw Downtown
add_completion(37, None,         1,    None, [D,S,C,E],    [SHARON,JOSH,JENNA])
add_completion(42, None,         0,    None, [D,S,C,E],    [ROB])
add_completion(43, None,         1,    None, [S,C,E],       [SHARON,JOSH,JENNA])

conn.commit()

# ── Default city for all users ────────────────────────────────────────────────
for uid in [D, S, E, C]:
    conn.execute(
        "INSERT OR IGNORE INTO user_preferences (user_id, default_city_id) VALUES (?,?)",
        (uid, OTTAWA)
    )
conn.commit()

conn.close()
print("Seeded successfully!")
