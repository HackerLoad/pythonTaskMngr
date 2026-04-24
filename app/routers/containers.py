import docker
import docker.errors
from fastapi import APIRouter, HTTPException

router = APIRouter()


def _client():
    try:
        return docker.from_env()
    except Exception:
        return None


@router.get("/containers")
async def get_containers():
    client = _client()
    if not client:
        return {"error": "Docker socket not available", "containers": []}

    try:
        result = []
        for c in client.containers.list(all=True):
            ports_list = []
            for cport, bindings in (c.ports or {}).items():
                if bindings:
                    for b in bindings:
                        ports_list.append(f"{b['HostIp']}:{b['HostPort']}->{cport}")
                else:
                    ports_list.append(cport)

            tags = c.image.tags
            result.append({
                "id": c.short_id,
                "name": c.name,
                "status": c.status,
                "image": tags[0] if tags else c.image.short_id,
                "ports": ", ".join(ports_list) or "—",
                "created": str(c.attrs.get("Created", ""))[:10],
            })
        return {"error": None, "containers": result}
    except Exception as exc:
        return {"error": str(exc), "containers": []}


@router.post("/containers/{container_id}/{action}")
async def container_action(container_id: str, action: str):
    if action not in ("start", "stop", "restart"):
        raise HTTPException(status_code=400, detail="Action must be start, stop, or restart")

    client = _client()
    if not client:
        raise HTTPException(status_code=503, detail="Docker socket not available")

    try:
        c = client.containers.get(container_id)
        getattr(c, action)()
        return {"ok": True, "action": action, "container": container_id}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="Container not found")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
