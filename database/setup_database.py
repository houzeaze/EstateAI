import sqlite3

connection = sqlite3.connect("real_estate.db")

cursor = connection.cursor()


# -------------------------
# 1. CREATE TABLES
# -------------------------

cursor.execute("""
CREATE TABLE IF NOT EXISTS telecallers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    team TEXT NOT NULL
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    price INTEGER NOT NULL,
    property_type TEXT NOT NULL
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY,
    telecaller_id INTEGER,
    property_id INTEGER,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (telecaller_id) REFERENCES telecallers(id),
    FOREIGN KEY (property_id) REFERENCES properties(id)
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY,
    lead_id INTEGER,
    property_id INTEGER,
    booking_amount INTEGER NOT NULL,
    booking_date TEXT NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (property_id) REFERENCES properties(id)
)
""")


# -------------------------
# 2. INSERT TELECALLERS
# -------------------------

telecallers = [
    (1, "Priya Sharma", "Mumbai Team"),
    (2, "Rahul Mehta", "Mumbai Team"),
    (3, "Neha Shah", "Western Team"),
    (4, "Aman Patil", "Western Team")
]

cursor.executemany("""
INSERT OR IGNORE INTO telecallers
(id, name, team)
VALUES (?, ?, ?)
""", telecallers)


# -------------------------
# 3. INSERT PROPERTIES
# -------------------------

properties = [
    (1, "Skyline Heights", "Andheri", 8500000, "2 BHK"),
    (2, "Green Residency", "Borivali", 6500000, "2 BHK"),
    (3, "Urban Nest", "Malad", 7200000, "2 BHK"),
    (4, "Lakeview Towers", "Powai", 11000000, "3 BHK"),
    (5, "Palm Gardens", "Kandivali", 5800000, "1 BHK")
]

cursor.executemany("""
INSERT OR IGNORE INTO properties
(id, name, location, price, property_type)
VALUES (?, ?, ?, ?, ?)
""", properties)


# -------------------------
# 4. INSERT LEADS
# -------------------------

leads = [
    # August
    (1, 1, 1, "Converted", "Website", "2026-08-03"),
    (2, 1, 2, "Qualified", "Instagram", "2026-08-05"),
    (3, 2, 3, "Converted", "Website", "2026-08-06"),
    (4, 3, 4, "Qualified", "Facebook", "2026-08-10"),
    (5, 4, 5, "New", "Website", "2026-08-12"),

    # September
    (6, 1, 3, "Converted", "Website", "2026-09-02"),
    (7, 1, 4, "Converted", "Instagram", "2026-09-05"),
    (8, 2, 1, "Qualified", "Website", "2026-09-07"),
    (9, 2, 5, "Converted", "Facebook", "2026-09-10"),
    (10, 3, 2, "Qualified", "Instagram", "2026-09-12"),
    (11, 3, 3, "New", "Website", "2026-09-15"),
    (12, 4, 4, "Qualified", "Facebook", "2026-09-18"),

    # October
    (13, 1, 1, "Qualified", "Website", "2026-10-01"),
    (14, 1, 2, "Converted", "Instagram", "2026-10-02"),
    (15, 1, 3, "Qualified", "Website", "2026-10-03"),
    (16, 1, 4, "Converted", "Facebook", "2026-10-04"),

    (17, 2, 1, "Qualified", "Website", "2026-10-01"),
    (18, 2, 3, "New", "Instagram", "2026-10-03"),
    (19, 2, 5, "Converted", "Website", "2026-10-05"),

    (20, 3, 2, "Qualified", "Facebook", "2026-10-01"),
    (21, 3, 3, "New", "Website", "2026-10-02"),
    (22, 3, 4, "Converted", "Instagram", "2026-10-06"),

    (23, 4, 1, "New", "Website", "2026-10-02"),
    (24, 4, 5, "Qualified", "Facebook", "2026-10-04")
]

cursor.executemany("""
INSERT OR IGNORE INTO leads
(id, telecaller_id, property_id, status, source, created_at)
VALUES (?, ?, ?, ?, ?, ?)
""", leads)


# -------------------------
# 5. INSERT BOOKINGS
# -------------------------

bookings = [
    # August
    (1, 1, 1, 8500000, "2026-08-08"),
    (2, 3, 3, 7200000, "2026-08-15"),

    # September
    (3, 6, 3, 7200000, "2026-09-08"),
    (4, 7, 4, 11000000, "2026-09-12"),
    (5, 9, 5, 5800000, "2026-09-15"),

    # October
    (6, 14, 2, 6500000, "2026-10-05"),
    (7, 16, 4, 11000000, "2026-10-06"),
    (8, 19, 5, 5800000, "2026-10-07"),
    (9, 22, 4, 11000000, "2026-10-07")
]

cursor.executemany("""
INSERT OR IGNORE INTO bookings
(id, lead_id, property_id, booking_amount, booking_date)
VALUES (?, ?, ?, ?, ?)
""", bookings)


connection.commit()

connection.close()

print("Database created and sample data inserted successfully!")