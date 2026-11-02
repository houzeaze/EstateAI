"""PostgreSQL connection handling."""
import psycopg
from psycopg.rows import dict_row

from config import DATABASE_URL


def get_db():
    """FastAPI dependency: one read-only connection per request.

    Rows come back as plain dicts, and every transaction is READ ONLY.
    """
    connection = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    connection.read_only = True
    try:
        yield connection
    finally:
        connection.close()
