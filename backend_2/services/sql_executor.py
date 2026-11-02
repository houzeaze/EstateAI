"""Validates and runs the SQL that Gemini generates (read-only)."""
import re

import psycopg
from fastapi import HTTPException

from config import MAX_RESULT_ROWS, QUERY_TIMEOUT

# Second line of defence. The first is the read-only database user
# and the READ ONLY transaction set in database.py.
FORBIDDEN_SQL = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy"
    r"|vacuum|pg_sleep|pg_read_file|pg_ls_dir|lo_import|lo_export"
    r"|dblink|set_config)\b"
    r"|\bpg_\w+|\binformation_schema\b|--|/\*",
    re.IGNORECASE,
)


def _clean_sql(sql) -> str:
    if not isinstance(sql, str) or not sql.strip():
        raise HTTPException(
            status_code=400,
            detail="Gemini did not generate a valid SQL query.",
        )

    return re.sub(
        r"\A```(?:sql)?\s*|\s*```\Z",
        "",
        sql.strip(),
        flags=re.IGNORECASE,
    ).strip()


def _validate_sql(sql: str) -> None:
    if not re.match(r"^SELECT\b", sql, re.IGNORECASE):
        raise HTTPException(
            status_code=400,
            detail="Only SELECT queries are permitted.",
        )

    if ";" in sql:
        raise HTTPException(
            status_code=400,
            detail="Multiple SQL statements are not permitted.",
        )

    if FORBIDDEN_SQL.search(sql):
        raise HTTPException(
            status_code=400,
            detail="This query contains operations that are not permitted.",
        )


def execute_read_only_query(db, sql) -> dict:
    sql = _clean_sql(sql)
    _validate_sql(sql)

    db.execute(f"SET statement_timeout = '{QUERY_TIMEOUT}'")

    try:
        # No params argument, so LIKE '%text%' works without escaping.
        rows = db.execute(sql).fetchmany(MAX_RESULT_ROWS + 1)
    except psycopg.errors.QueryCanceled as error:
        raise HTTPException(
            status_code=400,
            detail="The query took too long. Try a more specific question.",
        ) from error

    return {
        "data": rows[:MAX_RESULT_ROWS],
        "truncated": len(rows) > MAX_RESULT_ROWS,
    }
