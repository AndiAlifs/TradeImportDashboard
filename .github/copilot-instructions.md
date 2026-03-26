# Project Guidelines

## Code Style
- Keep changes scoped and consistent with existing patterns in each area:
  - Backend uses Go with Gin + GORM and lightweight handler-oriented organization.
  - Frontend uses Angular standalone components, services, and signals.
- Prefer small, behavior-preserving edits over broad refactors unless explicitly requested.

## Architecture
- Monorepo with two active apps:
  - `backend/`: Go API server (`cmd/server/main.go`) with route wiring in `internal/router/router.go`, handlers in `internal/handlers`, models in `internal/models`, and DB setup in `internal/database`.
  - `frontend/`: Angular app with routes in `src/app/app.routes.ts`, state and API integration in `src/app/services/data-store.service.ts`, and page-level features in `src/app/pages`.
- Core domain centers on L/C lifecycle tracking and SLA timing.
- Real-time UI refresh depends on backend SSE endpoint `GET /api/events/stream`.

## Build and Test
- Root quick start (Windows): `start.bat`
- Backend:
  - `cd backend`
  - `go mod tidy`
  - `go run ./cmd/server`
- Frontend:
  - `cd frontend`
  - `npm install`
  - `npm start`
  - `npm run build`
  - `npm test`

## Conventions
- Keep transaction type support intact: L/C creation and filtering rely on `Import` and `Export` transaction types.
- Preserve mock RBAC flow in development:
  - Frontend sends `X-Mock-Role`, `X-Mock-Scope`, `X-Mock-User` headers.
  - Backend enforces role/scope checks in handlers.
- Coordinate API base URL and backend port when changing config:
  - Frontend defaults to `window.SHILA_API_BASE` or `http://localhost:8081/api`.
  - Backend default port is `8080` unless `APP_PORT` is set.
- Do not remove localStorage fallback behavior unless explicitly asked; it is used when backend connectivity fails.

## Reference Docs
- Root overview: `README.md`
- Backend API details: `backend/README.md`
- Frontend Angular scripts: `frontend/README.md`
- Product requirements: `references/prd.md`