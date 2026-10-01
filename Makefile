.PHONY: up down status logs models native-up native-down native-status native-logs

# Docker Compose stack (default)
up:
	docker compose up -d --build
	@echo
	@echo "Waiting for health..."
	@./scripts/compose-wait.sh
	@echo
	@echo "FireSight Docker stack:"
	@echo "  Web          http://localhost:5173"
	@echo "  Coordinator  http://localhost:8080"
	@echo "  Worker       http://localhost:8000"
	@echo "  Ollama       http://localhost:11434"
	@echo
	@echo "First time? pull models: make models"

down:
	docker compose down

status:
	docker compose ps
	@echo
	@curl -sf http://127.0.0.1:11434/api/tags >/dev/null && echo "ollama: OK" || echo "ollama: DOWN"
	@curl -sf http://127.0.0.1:8080/health >/dev/null && echo "coordinator: OK" || echo "coordinator: DOWN"
	@curl -sf http://127.0.0.1:8000/health >/dev/null && echo "worker: OK" || echo "worker: DOWN"
	@curl -sf http://127.0.0.1:5173/ >/dev/null && echo "web: OK" || echo "web: DOWN"

logs:
	docker compose logs -f $(SERVICE)

models:
	docker compose --profile models run --rm ollama-pull

# Native (non-Docker) stack — scripts/dev.sh
native-up:
	./scripts/dev.sh up

native-down:
	./scripts/dev.sh down

native-status:
	./scripts/dev.sh status

native-logs:
	./scripts/dev.sh logs $(SERVICE)
