# Server Task Manager

A web-based task manager for your home server, running as a Docker container. Monitor system resources, manage Docker services, and configure startup items — all from your browser.

![Python](https://img.shields.io/badge/Python-3.12-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

---

## Features

- **Overview** — Live CPU usage with 60-second sparkline, RAM/swap bars, per-disk usage, and network upload/download speed chart. Refreshes every 2 seconds.
- **Processes** — Sortable and searchable table of all host processes (PID, name, user, CPU%, memory%, status). Refreshes every 3 seconds while active.
- **Services** — Two sections: all Docker containers (start/stop/restart) and all systemd services on the host (start/stop/restart), with a live search filter.
- **Startup** — Add named commands (e.g. `docker run -d nginx`) that you want to remember to run on startup. Enable/disable or delete entries at any time. Entries are persisted across container restarts.

---

## Requirements

- Docker + Docker Compose

---

## Getting Started

```bash
# Clone or copy the project to your server
cd pythonTaskMngr

# Build and start
docker compose up -d --build

# Open in your browser
http://<server-ip>:8080
```

To stop:

```bash
docker compose down
```

---

## Project Structure

```
pythonTaskMngr/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── requirements.txt
├── data/                     # Persisted startup items (auto-created)
└── app/
    ├── main.py               # FastAPI app entry point
    ├── routers/
    │   ├── system.py         # GET /api/system  — CPU, RAM, disk, network
    │   ├── processes.py      # GET /api/processes
    │   ├── containers.py     # GET/POST /api/containers
    │   ├── systemd.py        # GET/POST /api/systemd
    │   └── startup.py        # CRUD /api/startup
    └── static/
        ├── index.html
        ├── style.css
        └── app.js
```

---

## Configuration

The default port is **8080**. To change it, edit `docker-compose.yml`:

```yaml
ports:
  - "9000:8080"   # host port : container port
```

The timezone defaults to `Europe/Berlin`. Change the `TZ` environment variable in `docker-compose.yml` to match your server.

---

## How it works

| Mechanism | Purpose |
|-----------|---------|
| `pid: host` | Makes `psutil` read from the host's `/proc` so CPU, RAM, and process stats reflect the real host, not just the container. |
| `privileged: true` | Required so `nsenter` can enter the host's mount namespace to run `systemctl` commands. |
| `nsenter --target 1 --mount` | Enters PID 1's mount namespace inside the container, making `systemctl` talk to the host's systemd. |
| Docker socket mount | Mounts `/var/run/docker.sock` so the Services tab can list and control other containers. |
| `./data` volume | Persists `startup.json` so your startup items survive container rebuilds. |

> **Note for macOS users:** Docker runs inside a Linux VM on macOS, so systemd services and host process stats reflect the VM, not macOS itself. On a native Linux home server everything works as expected.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/system` | CPU, memory, swap, disk, network stats |
| `GET` | `/api/processes` | All running host processes |
| `GET` | `/api/containers` | All Docker containers |
| `POST` | `/api/containers/{id}/{action}` | `start`, `stop`, or `restart` a container |
| `GET` | `/api/systemd` | All systemd services on the host |
| `POST` | `/api/systemd/{unit}/{action}` | `start`, `stop`, or `restart` a systemd unit |
| `GET` | `/api/startup` | List startup items |
| `POST` | `/api/startup` | Add a startup item |
| `PUT` | `/api/startup/{id}/toggle` | Enable / disable a startup item |
| `DELETE` | `/api/startup/{id}` | Delete a startup item |
