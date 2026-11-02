"""App entry point. Run with:  uvicorn main:app --reload"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from routers import analytics, ask, documents

app = FastAPI(title="Real Estate AI Analytics")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics.router)
app.include_router(ask.router)
app.include_router(documents.router)


@app.get("/")
def home():
    return {"message": "Real Estate AI Backend is running!"}
