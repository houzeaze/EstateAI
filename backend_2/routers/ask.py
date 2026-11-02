"""POST /ask : natural-language question -> SQL -> rows."""
from fastapi import APIRouter, Depends, HTTPException

from ai.sql_generator import generate_sql
from database import get_db
from schemas import QuestionRequest
from services.db_schema import get_database_schema
from services.sql_executor import execute_read_only_query

router = APIRouter(tags=["ask"])


@router.post("/ask")
def ask_question(request: QuestionRequest, db=Depends(get_db)):
    try:
        schema = get_database_schema(db)
        result = generate_sql(request.question, schema)

        if result.get("needs_clarification"):
            return {
                "answer": result.get("clarification")
                or "Please clarify your question.",
                "metrics": {},
                "data": [],
            }

        query_result = execute_read_only_query(db, result.get("sql"))
        data = query_result["data"]

        return {
            "answer": (
                f"Found {len(data)} matching records."
                if data
                else "No matching records were found."
            ),
            "metrics": {
                "records_returned": len(data),
                "truncated": query_result["truncated"],
            },
            "data": data,
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Analytics error:", repr(error))
        raise HTTPException(
            status_code=500,
            detail="Unable to process the analytics question.",
        )
