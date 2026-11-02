import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]

with psycopg.connect(DATABASE_URL) as connection:
    # Extra safety: make the session itself read-only
    connection.read_only = True

    tables = connection.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """).fetchall()

    for (table_name,) in tables:
        print(f"\n--- Table: {table_name} ---")

        columns = connection.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
            ORDER BY ordinal_position
        """, (table_name,)).fetchall()

        for column_name, data_type in columns:
            print(f"Column: {column_name} | Type: {data_type}")