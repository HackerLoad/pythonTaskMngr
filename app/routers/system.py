import time
import socket
import psutil
from fastapi import APIRouter

router = APIRouter()

_last_net_io = None
_last_net_time = None


@router.get("/system")
async def get_system_stats():
    global _last_net_io, _last_net_time

    # CPU — interval=0.1 gives an accurate non-blocking sample
    cpu_percent = psutil.cpu_percent(interval=0.1)
    cpu_freq = psutil.cpu_freq()

    # Memory
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()

    # Disk
    disks = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": usage.percent,
            })
        except PermissionError:
            continue

    # Network speed (delta since last call)
    net_io = psutil.net_io_counters()
    now = time.time()
    speed_send = speed_recv = 0.0
    if _last_net_io and _last_net_time:
        elapsed = now - _last_net_time
        if elapsed > 0:
            speed_send = (net_io.bytes_sent - _last_net_io.bytes_sent) / elapsed
            speed_recv = (net_io.bytes_recv - _last_net_io.bytes_recv) / elapsed
    _last_net_io = net_io
    _last_net_time = now

    return {
        "hostname": socket.gethostname(),
        "uptime_seconds": now - psutil.boot_time(),
        "cpu": {
            "percent": cpu_percent,
            "cores_physical": psutil.cpu_count(logical=False),
            "cores_logical": psutil.cpu_count(logical=True),
            "frequency_mhz": cpu_freq.current if cpu_freq else None,
        },
        "memory": {
            "total": mem.total,
            "used": mem.used,
            "available": mem.available,
            "percent": mem.percent,
        },
        "swap": {
            "total": swap.total,
            "used": swap.used,
            "percent": swap.percent,
        },
        "disk": disks,
        "network": {
            "bytes_sent": net_io.bytes_sent,
            "bytes_recv": net_io.bytes_recv,
            "speed_send": max(speed_send, 0),
            "speed_recv": max(speed_recv, 0),
        },
    }
