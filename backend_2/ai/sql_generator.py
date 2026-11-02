"""Natural language -> SQL."""
import json
from datetime import datetime, timedelta, timezone

from ai.client import generate
from ai.prompts import sql_prompt

IST = timezone(timedelta(hours=5, minutes=30))


def generate_sql(question: str, schema: str) -> dict:
    today = datetime.now(IST).date()

    text = generate(
        sql_prompt(question, schema, today),
        response_mime_type="application/json",
        temperature=0,
    )

    if not text:
        raise ValueError("Gemini returned an empty response.")

    result = json.loads(text)

    if not isinstance(result, dict):
        raise ValueError("Gemini returned an invalid response.")

    if result.get("needs_clarification") is True:
        return {
            "needs_clarification": True,
            "clarification": str(
                result.get("clarification")
                or "Could you clarify what you want to see?"
            ),
            "sql": None,
        }

    sql = result.get("sql")

    if not isinstance(sql, str) or not sql.strip():
        raise ValueError("Gemini did not generate a SQL query.")

    return {
        "needs_clarification": False,
        "clarification": None,
        "sql": sql.strip(),
    }
