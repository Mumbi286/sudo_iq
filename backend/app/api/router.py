from fastapi import APIRouter

from app.api.routes import households_router, zones_router


api_router = APIRouter()
api_router.include_router(zones_router)
api_router.include_router(households_router)
