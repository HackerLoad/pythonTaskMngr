import psutil
from fastapi import APIRouter

router = APIRouter()


@router.get("/processes")
async def get_processes():
    procs = []
    attrs = ["pid", "name", "username", "cpu_percent", "memory_percent", "status"]
    for proc in psutil.process_iter(attrs):
        try:
            info = proc.info
            procs.append({
                "pid": info["pid"],
                "name": info["name"] or "",
                "username": info["username"] or "",
                "cpu_percent": round(info["cpu_percent"] or 0.0, 1),
                "memory_percent": round(info["memory_percent"] or 0.0, 1),
                "status": info["status"] or "",
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    procs.sort(key=lambda p: p["cpu_percent"], reverse=True)
    return procs
