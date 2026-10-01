# FireSight (SCDF × Dell) monorepo

Local development monorepo for the Fire Report web app, inference coordinator, and inference worker.

```
apps/
  web/           Vite/React Fire Report Generation App (:5173)
  coordinator/   FastAPI BFF / job orchestrator (:8080)
  worker/        FastAPI inference worker — Whisper + Ollama (:8000)
scripts/dev.sh   One-command local stack runner
Makefile         make up | down | status | logs
```

## Prerequisites

- Node.js (for `apps/web`)
- Python **3.12** venvs already under `apps/coordinator/.venv` and `apps/worker/.venv`
- `ffmpeg`
- [Ollama](https://ollama.com) on `PATH` (this machine uses `~/.local/bin/ollama`)
- Models: `ollama pull llama3.1:8b` and `ollama pull llava`

## First-time setup (if venvs / node_modules are missing)

```bash
cd apps/coordinator && python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cp -n .env.example .env
cd ../worker && python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cp -n .env.example .env
cd ../web && npm install && cp -n .env.example .env
```

Local defaults (already in each app `.env` for this machine):

- Coordinator: `USE_FAKE_STORAGE=true`, CORS `http://localhost:5173`, keys `dev-web-key` / `dev-worker-key`
- Worker: real Whisper on CPU (`WHISPER_DEVICE=cpu`, `WHISPER_COMPUTE_TYPE=int8`), Ollama extraction, `WORKER_ENABLED=true`
- Web: `VITE_COORDINATOR_URL=http://localhost:8080`, `VITE_WEB_API_KEY=dev-web-key`

## Run everything (Docker Compose — default)

Requires Docker + Compose plugin.

```bash
make up              # build + start ollama, coordinator, worker, web
make models          # first time: pull llama3.1:8b + llava into the ollama volume
make status
make logs            # or: make logs SERVICE=worker
make down
```

| Service      | URL                     |
|--------------|-------------------------|
| Web          | http://localhost:5173   |
| Coordinator  | http://localhost:8080   |
| Worker       | http://localhost:8000   |
| Ollama       | http://localhost:11434  |

Compose file: [`docker-compose.yml`](docker-compose.yml). Worker talks to coordinator/Ollama on the internal Docker network; the browser still calls `http://localhost:8080`.

### Native (no Docker)

```bash
make native-up
make native-status
make native-logs
make native-down
```

Native logs/PIDs: `.logs/` and `.pids/`.

## Notes

- Coordinator storage is **in-memory** when `USE_FAKE_STORAGE=true` — jobs clear on coordinator restart.
- After transcription, the web app (or `POST /v1/jobs/{id}/extract`) must request extraction before the worker completes the job.
- Old separate GitHub remotes remain archives; this monorepo starts as a fresh local snapshot (no remote until you add one).
