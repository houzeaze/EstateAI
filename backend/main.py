from datetime import date, timedelta
from pathlib import Path
import re
import sqlite3
import traceback

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import csv
import io
import pandas as pd

from ai import generate_sql, answer_pdf_question, answer_csv_question


# --------------------------------------------------
# APP CONFIGURATION
# --------------------------------------------------

app = FastAPI(title="Real Estate AI Analytics")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# DATABASE CONFIGURATION
# --------------------------------------------------

DB_PATH = (
    Path(__file__).resolve().parent.parent
    / "database"
    / "real_estate.db"
)


def get_database_connection():
    if not DB_PATH.exists():
        raise RuntimeError(f"Database not found: {DB_PATH}")

    connection = sqlite3.connect(str(DB_PATH))
    connection.row_factory = sqlite3.Row
    return connection


# --------------------------------------------------
# REQUEST MODEL
# --------------------------------------------------

class QuestionRequest(BaseModel):
    question: str


# --------------------------------------------------
# DATABASE SCHEMA FOR GEMINI
# --------------------------------------------------

def get_database_schema(connection):
    # Discover all user-created tables.
    tables = connection.execute("""
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    """).fetchall()

    allowed_tables = {
        row["name"] for row in tables
    }

    schema_parts = []
    discovered_relationships = set()

    for table_name in sorted(allowed_tables):
        safe_name = table_name.replace('"', '""')

        columns = connection.execute(
            f'PRAGMA table_info("{safe_name}")'
        ).fetchall()

        column_details = []

        for column in columns:
            details = f"{column['name']} ({column['type'] or 'UNKNOWN'})"

            if column["pk"]:
                details += ", PRIMARY KEY"

            column_details.append(details)

        schema_parts.append(
            f"Table {table_name}: "
            + ", ".join(column_details)
        )

        foreign_keys = connection.execute(
            f'PRAGMA foreign_key_list("{safe_name}")'
        ).fetchall()

        for fk in foreign_keys:
            relationship = (
                f"{table_name}.{fk['from']} = "
                f"{fk['table']}.{fk['to']}"
            )
            discovered_relationships.add(relationship)

    legacy_relationships = {
        "bookings.lead_id = leads.id",
        "bookings.property_id = properties.id",
        "leads.telecaller_id = telecallers.id",
        "leads.property_id = properties.id",
    }

    for relationship in sorted(legacy_relationships):
        left, right = relationship.split(" = ")

        left_table = left.split(".", 1)[0]
        right_table = right.split(".", 1)[0]

        if (
            left_table in allowed_tables
            and right_table in allowed_tables
            and relationship not in discovered_relationships
        ):
            discovered_relationships.add(relationship)

    schema_parts.append("Relationships:")

    if discovered_relationships:
        schema_parts.extend(
            f"- {relationship}"
            for relationship in sorted(discovered_relationships)
        )
    else:
        schema_parts.append("- No declared relationships discovered.")

    return "\n".join(schema_parts), allowed_tables


# --------------------------------------------------
# READ-ONLY SQL VALIDATION AND EXECUTION
# --------------------------------------------------

def execute_read_only_query(connection, sql, allowed_tables):
    if not isinstance(sql, str) or not sql.strip():
        raise HTTPException(
            status_code=400,
            detail="Gemini did not generate a valid SQL query.",
        )

    sql = sql.strip()

    sql = re.sub(
        r"\A```(?:sql)?\s*|\s*```\Z",
        "",
        sql,
        flags=re.IGNORECASE,
    ).strip()

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

    allowed_tables = {
        table.lower() for table in allowed_tables
    }

    connection.execute("PRAGMA query_only = ON")

    def authorize(action, arg1, arg2, database, trigger):
        allowed_actions = {
            sqlite3.SQLITE_SELECT,
            sqlite3.SQLITE_READ,
            sqlite3.SQLITE_FUNCTION,
        }

        if hasattr(sqlite3, "SQLITE_RECURSIVE"):
            allowed_actions.add(sqlite3.SQLITE_RECURSIVE)

        if action not in allowed_actions:
            return sqlite3.SQLITE_DENY

        if action == sqlite3.SQLITE_READ:
            table_name = (arg1 or "").lower()

            if table_name not in allowed_tables:
                print(
                    f"Blocked table access: {table_name}, "
                    f"column: {arg2}"
                )
                return sqlite3.SQLITE_DENY

        if action == sqlite3.SQLITE_FUNCTION:
            function_name = (arg2 or arg1 or "").lower()

            if function_name == "load_extension":
                return sqlite3.SQLITE_DENY

        return sqlite3.SQLITE_OK

    connection.set_authorizer(authorize)

    try:
        cursor = connection.execute(sql)

        rows = cursor.fetchmany(201)
        truncated = len(rows) > 200
        rows = rows[:200]

        return {
            "data": [dict(row) for row in rows],
            "truncated": truncated,
        }

    finally:
        connection.set_authorizer(None)


# --------------------------------------------------
# HOME
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Real Estate AI Backend is running!"
    }


# --------------------------------------------------
# GET ALL TELECALLERS
# --------------------------------------------------

@app.get("/telecallers")
def get_telecallers():
    connection = get_database_connection()

    try:
        rows = connection.execute(
            "SELECT * FROM telecallers"
        ).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()


# --------------------------------------------------
# OVERALL SALES ANALYTICS
# --------------------------------------------------

@app.get("/analytics/sales")
def get_sales_analytics():
    connection = get_database_connection()

    try:
        row = connection.execute("""
            SELECT
                COALESCE(SUM(booking_amount), 0) AS total_sales,
                COUNT(*) AS total_bookings,
                COALESCE(AVG(booking_amount), 0)
                    AS average_booking_value
            FROM bookings
        """).fetchone()

        return dict(row)

    finally:
        connection.close()


# --------------------------------------------------
# TELECALLER PERFORMANCE
# --------------------------------------------------

@app.get("/analytics/telecallers")
def get_telecaller_performance():
    connection = get_database_connection()

    try:
        rows = connection.execute("""
            SELECT
                t.name AS telecaller,
                COUNT(DISTINCT l.id) AS total_leads,
                COUNT(DISTINCT b.id) AS total_bookings,
                COALESCE(SUM(b.booking_amount), 0) AS total_sales
            FROM telecallers t
            LEFT JOIN leads l
                ON t.id = l.telecaller_id
            LEFT JOIN bookings b
                ON l.id = b.lead_id
            GROUP BY t.id, t.name
            ORDER BY total_sales DESC
        """).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()


# --------------------------------------------------
# LEAD ANALYTICS
# --------------------------------------------------

@app.get("/analytics/leads")
def get_lead_analytics():
    connection = get_database_connection()

    try:
        rows = connection.execute("""
            SELECT
                status,
                COUNT(*) AS total
            FROM leads
            GROUP BY status
            ORDER BY total DESC
        """).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()


# --------------------------------------------------
# TELECALLER ANALYTICS
# --------------------------------------------------

@app.get("/analytics/telecallers/monthly")
def get_monthly_telecaller_performance():
    connection = get_database_connection()

    try:
        rows = connection.execute("""
            SELECT
                t.name AS telecaller,
                COUNT(DISTINCT l.id) AS total_leads,
                COUNT(DISTINCT CASE
                    WHEN l.status = 'Qualified' THEN l.id
                END) AS qualified_leads,
                COUNT(DISTINCT b.id) AS total_bookings,
                COALESCE(SUM(b.booking_amount), 0) AS total_sales
            FROM telecallers t
            LEFT JOIN leads l
                ON t.id = l.telecaller_id
            LEFT JOIN bookings b
                ON l.id = b.lead_id
            GROUP BY t.id, t.name
            ORDER BY total_sales DESC
        """).fetchall()

        data = []

        for row in rows:
            item = dict(row)

            leads = item["total_leads"]
            bookings = item["total_bookings"]

            item["conversion_rate"] = round(
                (bookings / leads) * 100 if leads else 0,
                2,
            )

            data.append(item)

        return data

    finally:
        connection.close()


# --------------------------------------------------
# MONTHLY SALES
# --------------------------------------------------

@app.get("/analytics/monthly-sales")
def get_monthly_sales():
    connection = get_database_connection()

    try:
        rows = connection.execute("""
            SELECT
                substr(booking_date, 1, 7) AS month,
                COALESCE(SUM(booking_amount), 0) AS total_sales,
                COUNT(*) AS total_bookings
            FROM bookings
            GROUP BY substr(booking_date, 1, 7)
            ORDER BY month
        """).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()


# --------------------------------------------------
# CURRENT MONTH SALES (DYNAMIC DATES)
# --------------------------------------------------

@app.get("/analytics/current-month")
def get_current_month_sales():
    today = date.today()
    month_start = today.replace(day=1)

    if month_start.month == 12:
        next_month = date(month_start.year + 1, 1, 1)
    else:
        next_month = date(
            month_start.year,
            month_start.month + 1,
            1,
        )

    connection = get_database_connection()

    try:
        row = connection.execute("""
            SELECT
                COALESCE(SUM(booking_amount), 0) AS total_sales,
                COUNT(*) AS total_bookings,
                COALESCE(AVG(booking_amount), 0)
                    AS average_booking_value
            FROM bookings
            WHERE date(booking_date) >= date(?)
              AND date(booking_date) < date(?)
        """, (
            month_start.isoformat(),
            next_month.isoformat(),
        )).fetchone()

        return {
            "month": month_start.strftime("%B %Y"),
            **dict(row),
        }

    finally:
        connection.close()


# --------------------------------------------------
# NATURAL-LANGUAGE ANALYTICS WITH GEMINI
# --------------------------------------------------

@app.post("/ask")
def ask_question(request: QuestionRequest):
    connection = get_database_connection()

    try:
        schema, allowed_tables = get_database_schema(connection)

        result = generate_sql(request.question, schema)

        if result.get("needs_clarification"):
            return {
                "answer": result.get("clarification")
                    or "Please clarify your question.",
                "metrics": {},
                "data": [],
            }

        query_result = execute_read_only_query(
            connection,
            result.get("sql"),
            allowed_tables,
        )

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

    finally:
        connection.close()


# --------------------------------------------------
# PDF, CSV, AND EXCEL QUESTION ANSWERING
# --------------------------------------------------

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_CSV_ROWS = 500
MAX_CSV_CHARACTERS = 100_000


@app.post("/ask-pdf")
async def ask_pdf_question(
    file: UploadFile = File(...),
    question: str = Form(...),
):
    if not question or not question.strip():
        raise HTTPException(
            status_code=400,
            detail="Please enter a question about your file.",
        )

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Please select a file.",
        )

    extension = Path(file.filename).suffix.lower()

    if extension not in {".pdf", ".csv", ".xlsx"}:
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF, CSV, or Excel (.xlsx) file.",
        )

    try:
        file_bytes = await file.read(MAX_UPLOAD_SIZE + 1)

        if not file_bytes:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        if len(file_bytes) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail="The file must be 10 MB or smaller.",
            )

        # ---------------- PDF ----------------
        if extension == ".pdf":
            if (
                file.content_type
                and file.content_type != "application/pdf"
            ):
                raise HTTPException(
                    status_code=400,
                    detail="The uploaded PDF has an invalid content type.",
                )

            if not file_bytes.startswith(b"%PDF-"):
                raise HTTPException(
                    status_code=400,
                    detail="The uploaded file is not a valid PDF.",
                )

            result = answer_pdf_question(
                pdf_bytes=file_bytes,
                question=question,
            )

        # ---------------- CSV & EXCEL ----------------
        else:
            if extension == ".csv":
                try:
                    csv_text = file_bytes.decode("utf-8-sig")
                except UnicodeDecodeError:
                    try:
                        csv_text = file_bytes.decode("cp1252")
                    except UnicodeDecodeError as error:
                        raise HTTPException(
                            status_code=400,
                            detail="Unable to read this CSV. Please save it as UTF-8.",
                        ) from error

            elif extension == ".xlsx":
                try:
                    dataframe = pd.read_excel(
                        io.BytesIO(file_bytes),
                        engine="openpyxl",
                    )

                    dataframe = dataframe.astype(object).where(
                        pd.notna(dataframe),
                        "",
                    )

                    csv_text = dataframe.to_csv(index=False)

                except Exception as error:
                    print("EXCEL READ ERROR:", repr(error))

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Unable to read this Excel file. "
                            "Please check that it is a valid .xlsx workbook."
                        ),
                    ) from error

            if len(csv_text) > MAX_CSV_CHARACTERS:
                raise HTTPException(
                    status_code=413,
                    detail="The spreadsheet is too large for the current assistant limit.",
                )

            try:
                rows = [
                    row
                    for row in csv.reader(io.StringIO(csv_text))
                    if any(cell.strip() for cell in row)
                ]
            except csv.Error as error:
                raise HTTPException(
                    status_code=400,
                    detail="Unable to parse the spreadsheet data.",
                ) from error

            if len(rows) < 2:
                raise HTTPException(
                    status_code=400,
                    detail="The file needs a header row and at least one data row.",
                )

            if len(rows) - 1 > MAX_CSV_ROWS:
                raise HTTPException(
                    status_code=413,
                    detail=f"The current limit is {MAX_CSV_ROWS} data rows.",
                )

            headers = rows[0]

            if not any(header.strip() for header in headers):
                raise HTTPException(
                    status_code=400,
                    detail="The file must contain column names.",
                )

            if any(len(row) != len(headers) for row in rows[1:]):
                raise HTTPException(
                    status_code=400,
                    detail="Some rows contain a different number of columns than the header.",
                )

            result = answer_csv_question(
                csv_text=csv_text,
                question=question,
            )

        # ---------------- RESPONSE ----------------
        if isinstance(result, str):
            return {
                "answer": result,
                "filename": file.filename,
                "chart_data": None,
                "chart_title": None,
                "chart_type": None,
            }

        if not isinstance(result, dict):
            raise ValueError(
                "The document assistant returned an unexpected response."
            )

        return {
            "answer": result.get("answer", "No answer returned."),
            "filename": file.filename,
            "chart_data": result.get("chart_data"),
            "chart_title": result.get("chart_title"),
            "chart_type": result.get("chart_type"),
        }

    except HTTPException:
        raise

    except Exception as error:
        print("\n========== DOCUMENT QUESTION ERROR ==========")
        print("Error:", repr(error))
        traceback.print_exc()
        print("=============================================\n")

        raise HTTPException(
            status_code=500,
            detail="Unable to answer the question from this file. Please try again.",
        )

    finally:
        await file.close()