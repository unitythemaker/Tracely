.PHONY: dev run build test docker-up docker-down migrate-up migrate-down sqlc tidy

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
	docker-compose up -d --build

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Database
migrate-up:
	migrate -path db/migrations -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path db/migrations -database "$(DATABASE_URL)" down

migrate-create:
	migrate create -ext sql -dir db/migrations -seq $(name)

# sqlc
sqlc:
	sqlc generate

# Seed
seed:
	psql "$(DATABASE_URL)" -f db/seed.sql
