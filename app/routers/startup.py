import json
import os
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

DATA_DIR = "/app/data"
STARTUP_FILE = os.path.join(DATA_DIR, "startup.json")


def _load() -> list:
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(STARTUP_FILE):
        return []
    with open(STARTUP_FILE) as f:
        return json.load(f)


def _save(items: list) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(STARTUP_FILE, "w") as f:
        json.dump(items, f, indent=2)


class StartupItem(BaseModel):
    name: str
    command: str
    description: Optional[str] = ""
    enabled: bool = True


@router.get("/startup")
async def list_startup():
    return _load()


@router.post("/startup")
async def add_startup(item: StartupItem):
    items = _load()
    entry = {
        "id": str(uuid.uuid4()),
        "name": item.name,
        "command": item.command,
        "description": item.description or "",
        "enabled": item.enabled,
    }
    items.append(entry)
    _save(items)
    return entry


@router.put("/startup/{item_id}/toggle")
async def toggle_startup(item_id: str):
    items = _load()
    for item in items:
        if item["id"] == item_id:
            item["enabled"] = not item["enabled"]
            _save(items)
            return item
    raise HTTPException(status_code=404, detail="Item not found")


@router.delete("/startup/{item_id}")
async def delete_startup(item_id: str):
    items = _load()
    new_items = [i for i in items if i["id"] != item_id]
    if len(new_items) == len(items):
        raise HTTPException(status_code=404, detail="Item not found")
    _save(new_items)
    return {"ok": True}
