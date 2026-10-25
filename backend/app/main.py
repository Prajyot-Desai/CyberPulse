"""CyberPulse FastAPI Application Entrypoint."""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.api.v1.health import router as root_health_router
from app.api.v1.router import api_v1_router
from app.core.config import Settings, get_settings
from app.core.logging import logger, setup_logging
from app.services.radar_service import close_radar_service


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and shutdown lifecycle."""
    settings = get_settings()
    setup_logging(settings.LOG_LEVEL)

    configured_msg = "Configured" if settings.is_cloudflare_configured else "Unconfigured (Running in standalone/test mode)"
    logger.info(
        f"Starting {settings.APP_NAME} v{settings.APP_VERSION} "
        f"[Env: {settings.ENVIRONMENT}, Cloudflare: {configured_msg}]"
    )

    yield

    logger.info("Shutting down CyberPulse backend...")
    # Clean up active singleton service and its HTTP client
    await close_radar_service()


def resolve_frontend_dist(settings: Optional[Settings] = None) -> Optional[Path]:
    """
    Resolve frontend static distribution directory reliably.
    Checks explicit setting first, then standard filesystem locations relative to project root.
    """
    cfg = settings or get_settings()
    if cfg.FRONTEND_DIST_DIR is not None:
        val = cfg.FRONTEND_DIST_DIR.strip()
        if not val or val.lower() in ("none", "disabled", "false"):
            return None
        custom_path = Path(val).resolve()
        return custom_path if (custom_path.is_dir() and (custom_path / "index.html").is_file()) else None

    # Candidate 1: Standard monorepo layout relative to main.py
    # Path(__file__) is <root>/backend/app/main.py -> parent.parent.parent is <root>
    root_dir = Path(__file__).resolve().parent.parent.parent
    monorepo_dist = root_dir / "frontend" / "dist"
    if monorepo_dist.is_dir() and (monorepo_dist / "index.html").is_file():
        return monorepo_dist

    # Candidate 2: In-container static distribution at /app/frontend/dist or /app/static
    for container_candidate in (Path("/app/frontend/dist"), Path("/app/static")):
        if container_candidate.is_dir() and (container_candidate / "index.html").is_file():
            return container_candidate

    return None


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    """Application factory configuring middleware, routes, and lifespan."""
    app_settings = settings or get_settings()

    app = FastAPI(
        title="CyberPulse — Global DDoS Intelligence API",
        version=app_settings.APP_VERSION,
        description=(
            "Production-quality backend service normalizing aggregated Cloudflare Radar "
            "DDoS intelligence for the CyberPulse 3D visualization dashboard."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Root health endpoint (standard for Kubernetes/load-balancers)
    app.include_router(root_health_router)

    # API v1 routes
    app.include_router(api_v1_router)

    # Production Frontend Static & SPA Serving
    dist_dir = resolve_frontend_dist(settings=app_settings)
    if dist_dir:
        logger.info(f"Serving unified frontend distribution from: {dist_dir}")
        index_file = dist_dir / "index.html"
        assets_dir = dist_dir / "assets"

        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa_or_static(full_path: str):
            clean_path = full_path.strip().lstrip("/")

            # 1. Never intercept API, health, or documentation endpoints
            if (
                clean_path == "health"
                or clean_path.startswith("health/")
                or clean_path == "api"
                or clean_path.startswith("api/")
                or clean_path in ("docs", "redoc", "openapi.json")
            ):
                raise HTTPException(status_code=404, detail="Not Found")

            # 2. Missing static assets must return 404 rather than SPA fallback
            if clean_path.startswith("assets/"):
                raise HTTPException(status_code=404, detail="Asset not found")

            # 3. Serve direct static files present in dist (e.g. favicon.ico, robots.txt)
            if clean_path:
                candidate = (dist_dir / clean_path).resolve()
                try:
                    candidate.relative_to(dist_dir)
                    if candidate.is_file():
                        return FileResponse(candidate)
                except ValueError:
                    raise HTTPException(status_code=404, detail="Not Found")

            # 4. Fallback to index.html for root and client-side SPA navigation routes
            return FileResponse(index_file)
    else:
        logger.info("Frontend distribution not found; running in API-only mode.")

    return app


app = create_app()
