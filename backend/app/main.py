import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.api.routes import router as api_router
from backend.app.database.session import Base, engine, run_migrations

# Initialize database tables and run safe schema upgrades
Base.metadata.create_all(bind=engine)
run_migrations()

app = FastAPI(
    title="CROX — Website Audit & SEO Intelligence API",
    description="Production-grade website audit, crawler, technical SEO, and AI diagnostics platform.",
    version="1.0.0"
)

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
if settings.FRONTEND_ORIGIN and settings.FRONTEND_ORIGIN != "*":
    origins.append(settings.FRONTEND_ORIGIN)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.FRONTEND_ORIGIN == "*" else origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root():
    return {
        "brand": "CROX",
        "system": "Website Audit & SEO Intelligence Platform",
        "docs": "/docs",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
