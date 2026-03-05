# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes import router
from db import check_connection
from pathlib import Path

app = FastAPI(title="Calorie Tracker API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)

frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    # Serve the built React app from the same origin in deployment environments.
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

@app.on_event("startup")
def verify_mongo_connection() -> None:
    try:
        check_connection()
        print("MongoDB connection OK")
    except Exception as exc:
        print(f"MongoDB connection failed: {exc}")
