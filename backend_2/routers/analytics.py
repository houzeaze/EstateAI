"""Plain dashboard endpoints (no AI involved)."""
from datetime import date

from fastapi import APIRouter, Depends

from database import get_db

router = APIRouter(tags=["analytics"])


@router.get("/telecallers")
def get_telecallers(db=Depends(get_db)):
    return db.execute("SELECT * FROM telecallers").fetchall()


@router.get("/analytics/sales")
def get_sales_analytics(db=Depends(get_db)):
    return db.execute("""
        SELECT
            COALESCE(SUM(booking_amount), 0) AS total_sales,
            COUNT(*) AS total_bookings,
            COALESCE(AVG(booking_amount), 0) AS average_booking_value
        FROM bookings
    """).fetchone()


@router.get("/analytics/telecallers")
def get_telecaller_performance(db=Depends(get_db)):
    return db.execute("""
        SELECT
            t.name AS telecaller,
            COUNT(DISTINCT l.id) AS total_leads,
            COUNT(DISTINCT b.id) AS total_bookings,
            COALESCE(SUM(b.booking_amount), 0) AS total_sales
        FROM telecallers t
        LEFT JOIN leads l ON t.id = l.telecaller_id
        LEFT JOIN bookings b ON l.id = b.lead_id
        GROUP BY t.id, t.name
        ORDER BY total_sales DESC
    """).fetchall()


@router.get("/analytics/leads")
def get_lead_analytics(db=Depends(get_db)):
    return db.execute("""
        SELECT status, COUNT(*) AS total
        FROM leads
        GROUP BY status
        ORDER BY total DESC
    """).fetchall()


@router.get("/analytics/telecallers/monthly")
def get_monthly_telecaller_performance(db=Depends(get_db)):
    rows = db.execute("""
        SELECT
            t.name AS telecaller,
            COUNT(DISTINCT l.id) AS total_leads,
            COUNT(DISTINCT CASE
                WHEN l.status = 'Qualified' THEN l.id
            END) AS qualified_leads,
            COUNT(DISTINCT b.id) AS total_bookings,
            COALESCE(SUM(b.booking_amount), 0) AS total_sales
        FROM telecallers t
        LEFT JOIN leads l ON t.id = l.telecaller_id
        LEFT JOIN bookings b ON l.id = b.lead_id
        GROUP BY t.id, t.name
        ORDER BY total_sales DESC
    """).fetchall()

    for row in rows:
        leads = row["total_leads"]
        bookings = row["total_bookings"]
        row["conversion_rate"] = round(
            (bookings / leads) * 100 if leads else 0,
            2,
        )

    return rows


@router.get("/analytics/monthly-sales")
def get_monthly_sales(db=Depends(get_db)):
    return db.execute("""
        SELECT
            to_char(booking_date::date, 'YYYY-MM') AS month,
            COALESCE(SUM(booking_amount), 0) AS total_sales,
            COUNT(*) AS total_bookings
        FROM bookings
        GROUP BY to_char(booking_date::date, 'YYYY-MM')
        ORDER BY month
    """).fetchall()


@router.get("/analytics/current-month")
def get_current_month_sales(db=Depends(get_db)):
    today = date.today()
    month_start = today.replace(day=1)

    if month_start.month == 12:
        next_month = date(month_start.year + 1, 1, 1)
    else:
        next_month = date(month_start.year, month_start.month + 1, 1)

    row = db.execute("""
        SELECT
            COALESCE(SUM(booking_amount), 0) AS total_sales,
            COUNT(*) AS total_bookings,
            COALESCE(AVG(booking_amount), 0) AS average_booking_value
        FROM bookings
        WHERE booking_date::date >= %s
          AND booking_date::date < %s
    """, (month_start, next_month)).fetchone()

    return {"month": month_start.strftime("%B %Y"), **row}
