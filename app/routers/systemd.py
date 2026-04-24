import json
import re
import subprocess

from fastapi import APIRouter, HTTPException

router = APIRouter()

# Allow only valid systemd unit name characters to prevent injection
_UNIT_RE = re.compile(r'^[\w@:.\-]+$')


def _nsenter(cmd: list[str]) -> subprocess.CompletedProcess:
    """Run a command inside the host's mount namespace via nsenter."""
    return subprocess.run(
        ['nsenter', '--target', '1', '--mount', '--'] + cmd,
        capture_output=True,
        text=True,
        timeout=15,
    )


@router.get("/systemd")
async def list_services():
    try:
        result = _nsenter([
            'systemctl', 'list-units',
            '--type=service',
            '--all',
            '--output=json',
            '--no-pager',
        ])
    except FileNotFoundError:
        return {"error": "nsenter not found — rebuild the container", "services": []}
    except subprocess.TimeoutExpired:
        return {"error": "systemctl timed out", "services": []}
    except Exception as exc:
        return {"error": str(exc), "services": []}

    if result.returncode != 0:
        err = result.stderr.strip() or "systemctl exited with code " + str(result.returncode)
        # Likely not a systemd host (e.g. macOS Docker VM)
        return {"error": err, "services": []}

    try:
        units = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"error": "Could not parse systemctl output", "services": []}

    services = [
        {
            "unit":        u.get("unit", ""),
            "load":        u.get("load", ""),
            "active":      u.get("active", ""),
            "sub":         u.get("sub", ""),
            "description": u.get("description", ""),
        }
        for u in units
    ]
    return {"error": None, "services": services}


@router.post("/systemd/{unit}/{action}")
async def service_action(unit: str, action: str):
    if action not in ("start", "stop", "restart", "enable", "disable"):
        raise HTTPException(status_code=400, detail="Action must be start, stop, restart, enable, or disable")

    if not _UNIT_RE.match(unit):
        raise HTTPException(status_code=400, detail="Invalid unit name")

    try:
        result = _nsenter(['systemctl', action, unit])
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="nsenter not available — is privileged: true set?")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="systemctl timed out")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr.strip() or "systemctl failed")

    return {"ok": True, "action": action, "unit": unit}
