"""
WINDLENS — UK Wind Forecast Intelligence Portal

FastAPI application entry point.
Configures CORS, logging, routes, and lifespan events.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.clients.elexon import elexon_client
from app.config import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("windlens")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("WINDLENS API starting up")
    logger.info(f"Analysis period: {settings.ANALYSIS_START_DATE} to {settings.ANALYSIS_END_DATE}")
    logger.info(f"Decision cutoff policy: {settings.DECISION_CUTOFF_POLICY}")
    yield
    logger.info("WINDLENS API shutting down")
    await elexon_client.close()


app = FastAPI(
    title="WINDLENS API",
    description="UK Wind Forecast Intelligence — Backend API for wind generation forecast analysis.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(router)
