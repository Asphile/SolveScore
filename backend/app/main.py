from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import admin, ai_analysis, applications, auth, competitions, judging, reports, resources, schools


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="SolveScore API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(competitions.router)
app.include_router(schools.router)
app.include_router(applications.router)
app.include_router(resources.router)
app.include_router(resources.applications_router)
app.include_router(ai_analysis.router)
app.include_router(ai_analysis.applications_router)
app.include_router(judging.router)
app.include_router(judging.evaluations_router)
app.include_router(admin.router)
app.include_router(reports.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
