from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.routers import system, processes, containers, startup

app = FastAPI(title="Server Task Manager", docs_url=None, redoc_url=None)

app.include_router(system.router, prefix="/api")
app.include_router(processes.router, prefix="/api")
app.include_router(containers.router, prefix="/api")
app.include_router(startup.router, prefix="/api")

app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/")
async def root():
    return FileResponse("app/static/index.html")
