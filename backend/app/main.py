from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.router import api_router
from app.core.config import settings
from app.db.session import engine

app = FastAPI(title="Mlinzi API")

_cors_origins = [o.strip() for o in settings.CORS_ALLOW_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root():
    return {
        "message": "Mlinzi API is running",
        "status": "healthy"
    }


# Health check: also proves the database is reachable, not just the API process
@app.get("/health")
def health_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "unhealthy", "database": "unreachable"})
    return {
        "status": "healthy",
        "database": "ok"
    }
