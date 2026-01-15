.PHONY: dev run build test docker-up docker-down migrate-up migrate-down sqlc tidy

# Default database URL for local development
DATABASE_URL ?= postgres://postgres:postgres@localhost:5432/tracely?sslmode=disable

# Development
dev:
	go run ./cmd/server

run: dev

build:
	go build -o bin/server ./cmd/server

test:
	go test -v ./...

tidy:
	go mod tidy

# Docker
docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

# Database - Local (requires migrate CLI installed)
migrate-up:
	migrate -path db/migrations -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path db/migrations -database "$(DATABASE_URL)" down

migrate-create:
	migrate create -ext sql -dir db/migrations -seq $(name)

migrate-version:
	migrate -path db/migrations -database "$(DATABASE_URL)" version

migrate-force:
	migrate -path db/migrations -database "$(DATABASE_URL)" force $(version)

# Database - Docker (no local install required)
db-up:
	@docker run --rm -v $(PWD)/db/migrations:/migrations --network=host migrate/migrate \
		-path=/migrations -database "$(DATABASE_URL)" up

db-down:
	@docker run --rm -v $(PWD)/db/migrations:/migrations --network=host migrate/migrate \
		-path=/migrations -database "$(DATABASE_URL)" down 1

db-down-all:
	@docker run --rm -v $(PWD)/db/migrations:/migrations --network=host migrate/migrate \
		-path=/migrations -database "$(DATABASE_URL)" down -all

db-version:
	@docker run --rm -v $(PWD)/db/migrations:/migrations --network=host migrate/migrate \
		-path=/migrations -database "$(DATABASE_URL)" version

db-force:
	@docker run --rm -v $(PWD)/db/migrations:/migrations --network=host migrate/migrate \
		-path=/migrations -database "$(DATABASE_URL)" force $(version)

db-reset: db-down-all db-up
	@echo "Database reset complete"

# Setup - Full development environment setup
setup: docker-up
	@echo "Waiting for postgres to be ready..."
	@sleep 5
	@$(MAKE) db-up
	@echo "Setup complete! Run 'make dev' to start the server."

# sqlc
sqlc:
	sqlc generate

# Seed (SQL)
seed:
	psql "$(DATABASE_URL)" -f db/seed.sql

db-seed:
	@docker run --rm -v $(PWD)/db:/db --network=host postgres:16-alpine \
		psql "$(DATABASE_URL)" -f /db/seed.sql

# Seed (API-based scripts)
API_URL ?= http://localhost:8080

seed-quick:
	@cd scripts && npx ts-node seed-once.ts quick

seed-medium:
	@cd scripts && npx ts-node seed-once.ts medium

seed-large:
	@cd scripts && npx ts-node seed-once.ts large

seed-timeseries:
	@cd scripts && npx ts-node seed-once.ts timeseries

seed-continuous:
	@cd scripts && npx ts-node seed-continuous.ts

# Bun alternatives (faster)
seed-quick-bun:
	@bun scripts/seed-once.ts quick

seed-continuous-bun:
	@bun scripts/seed-continuous.ts

# Help
help:
	@echo "Tracely Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup          - Start Docker services and run migrations"
	@echo ""
	@echo "Development:"
	@echo "  make dev            - Run the Go server"
	@echo "  make build          - Build the Go binary"
	@echo "  make test           - Run tests"
	@echo "  make sqlc           - Generate sqlc code"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up      - Start all Docker services"
	@echo "  make docker-down    - Stop all Docker services"
	@echo "  make docker-logs    - Follow Docker logs"
	@echo ""
	@echo "Database (via Docker - recommended):"
	@echo "  make db-up          - Run all pending migrations"
	@echo "  make db-down        - Rollback last migration"
	@echo "  make db-down-all    - Rollback all migrations"
	@echo "  make db-version     - Show current migration version"
	@echo "  make db-force version=N - Force migration version to N"
	@echo "  make db-reset       - Reset database (down all + up)"
	@echo "  make db-seed        - Run SQL seed data"
	@echo ""
	@echo "Database (local migrate CLI):"
	@echo "  make migrate-up     - Run all pending migrations"
	@echo "  make migrate-down   - Rollback last migration"
	@echo "  make migrate-create name=NAME - Create new migration"
	@echo ""
	@echo "Seed (API-based):"
	@echo "  make seed-quick     - Seed 100 random metrics"
	@echo "  make seed-medium    - Seed 500 random metrics"
	@echo "  make seed-large     - Seed 2000 random metrics"
	@echo "  make seed-timeseries - Seed 7 days of historical data"
	@echo "  make seed-continuous - Continuous seeding (Ctrl+C to stop)"
	@echo ""
	@echo "Environment:"
	@echo "  DATABASE_URL        - Database connection string"
	@echo "  API_URL             - API base URL (default: http://localhost:8080)"
