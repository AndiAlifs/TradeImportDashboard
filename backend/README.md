# Trade Import Dashboard Backend (Go)

Core CRUD backend starter for the L/C dashboard using Gin + GORM + MySQL.

## Implemented Endpoints

- `GET /health`
- `POST /api/lc`
- `GET /api/lc`
- `GET /api/lc/:id`
- `PATCH /api/lc/:id/status`
- `GET /api/events`
- `GET /api/sla`
- `PATCH /api/sla`

## Request Examples

### Create L/C

```http
POST /api/lc
Content-Type: application/json

{
  "senderEmail": "trade@clientbank.com",
  "subject": "Import L/C Application - PO#8821",
  "transactionType": "Import",
  "assignedTo": "Rina Hartono"
}
```

### List L/C

```http
GET /api/lc?status=Drafting&transactionType=Import&limit=50&offset=0
```

### Update Status

```http
PATCH /api/lc/1/status
Content-Type: application/json

{
  "newStatus": "Checking Underlying",
  "notes": "Started checking underlying docs",
  "userId": "Rina Hartono"
}
```

### Mark Exception

```http
PATCH /api/lc/1/status
Content-Type: application/json

{
  "newStatus": "Exception",
  "exceptionReason": "Waiting for beneficiary confirmation",
  "userId": "Rina Hartono"
}
```

### Resolve Exception

```http
PATCH /api/lc/1/status
Content-Type: application/json

{
  "newStatus": "Drafting",
  "exceptionMinutes": 15,
  "userId": "Rina Hartono"
}
```

## Run

```bash
cd backend
go mod tidy
go run ./cmd/server
```

Server default: `http://localhost:8080`

## Notes

- The app runs auto-migration on startup for: `lcs`, `events`, `sla_config`.
- It seeds one default SLA row (90/120) if not present.
- Credentials are loaded from `.env` only.
