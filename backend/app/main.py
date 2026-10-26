from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (registers Task with Base.metadata)
from .database import Base, engine
from .routers.tasks import router as tasks_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup if they do not exist."""
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Task Management System API",
    description="REST API for managing tasks.",
    version="1.0.0",
    lifespan=lifespan,
)

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


@app.get("/")
def root():
    return {
        "message": "Task Management System API is running",
        "status": "success",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


app.include_router(tasks_router)