.PHONY: up down status logs

up:
	./scripts/dev.sh up

down:
	./scripts/dev.sh down

status:
	./scripts/dev.sh status

logs:
	./scripts/dev.sh logs $(SERVICE)
