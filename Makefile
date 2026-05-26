SHELL := /bin/bash

.PHONY: help install dev up down logs test test-backend test-frontend lint build clean seed terraform-init terraform-plan

help:
	@echo "Sportivox - Common commands"
	@echo "  make install         Install backend + frontend dependencies"
	@echo "  make dev             Start backend + frontend (with emulators) via docker compose"
	@echo "  make up              docker compose up -d"
	@echo "  make down            docker compose down"
	@echo "  make logs            tail docker compose logs"
	@echo "  make test            Run backend + frontend test suites"
	@echo "  make lint            Lint backend + frontend"
	@echo "  make build           Build backend + frontend images"
	@echo "  make seed            Seed the dev Firestore with demo data"
	@echo "  make terraform-init  Initialise Terraform for GCP infra"
	@echo "  make terraform-plan  Show Terraform plan against your GCP project"

install:
	cd backend && npm install
	cd frontend && npm install

dev:
	docker compose up --build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

test: test-backend test-frontend

test-backend:
	cd backend && npm test

test-frontend:
	cd frontend && npm test --silent

lint:
	cd backend && npm run lint
	cd frontend && npm run lint

build:
	cd backend && npm run build
	cd frontend && npm run build

seed:
	cd backend && npm run seed

terraform-init:
	cd infra/terraform && terraform init

terraform-plan:
	cd infra/terraform && terraform plan

clean:
	rm -rf backend/node_modules backend/dist frontend/node_modules frontend/dist
