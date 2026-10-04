from .alerts import router as alerts_router
from .auth import router as auth_router
from .events import router as events_router
from .households import router as households_router
from .meta import router as meta_router
from .users import router as users_router
from .webhooks import router as webhooks_router
from .zones import router as zones_router

__all__ = [
    "auth_router", "users_router", "meta_router", "zones_router", "households_router",
    "alerts_router", "events_router", "webhooks_router",
]
