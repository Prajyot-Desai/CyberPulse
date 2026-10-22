"""Router aggregating all version 1 endpoints."""

from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.radar import router as radar_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(health_router)
api_v1_router.include_router(radar_router)
