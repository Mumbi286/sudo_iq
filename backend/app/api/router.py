from fastapi import APIRouter

from app.api.routes import (
    alerts_router, auth_router, events_router, households_router, meta_router, users_router,
    webhooks_router, zones_router,
)


api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(meta_router)
api_router.include_router(zones_router)
api_router.include_router(households_router)
api_router.include_router(alerts_router)
api_router.include_router(events_router)
api_router.include_router(webhooks_router)
