"""Environment variables and app-wide constants live here."""
import os

from dotenv import load_dotenv

load_dotenv()

# ---------- Database ----------
DATABASE_URL = os.environ["DATABASE_URL"]
QUERY_TIMEOUT = "10s"
MAX_RESULT_ROWS = 200

# ---------- Gemini ----------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

# ---------- CORS ----------
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
]

# ---------- Uploads ----------
ALLOWED_EXTENSIONS = {".pdf", ".csv", ".xlsx"}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_CSV_ROWS = 500
MAX_CSV_CHARACTERS = 100_000
