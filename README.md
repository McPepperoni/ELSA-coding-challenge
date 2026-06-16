# Elsa Quiz

Real-time multiple-choice quiz app with a React frontend, Hono backend, PostgreSQL, and Redis.

## Production Docker Setup

Docker is required for the production-style Compose stack. From the repository root, start the full stack with one of the helper scripts:

```powershell
.\scripts\start-prod.ps1
```

If local PowerShell script execution is blocked, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-prod.ps1
```

```sh
sh scripts/start-prod.sh
```

The startup scripts create a missing root `.env` with editable production defaults without overwriting an existing file, then run:

```sh
docker compose up --build
```

Edit `.env` before running this stack in a real production environment.

Once running, use these local URLs:

- Frontend: http://localhost:5173
- Backend root check: http://localhost:3000/

Stop the stack without deleting volumes:

```sh
docker compose down
```

Reset containers and volumes only as an explicit manual destructive action. This deletes local PostgreSQL and Redis data volumes:

```sh
docker compose down --volumes --remove-orphans
```
