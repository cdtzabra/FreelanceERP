# FreelanceERP Backend (Express + SQLite)

## Setup

1. Install Node.js >= 18
2. From the project directory:
```bash
npm install
```

3. Create an `.env` file (optional). Defaults are shown:
```
PORT=3001
DB_FILE=./data.sqlite
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

API keys are passed via `x-api-key` header. For a simple local setup, just send any string; rows are keyed by the provided string.

## Run
```bash
npm run dev
```
Server runs at http://localhost:3001

## Endpoints
- GET `/health` → `{ ok: true }`
- GET `/api/data` (headers: `x-api-key`) → `{ data, updatedAt }`
- PUT `/api/data` (headers: `x-api-key`, body: `{ data: {...} }`) → `{ ok: true, updatedAt }`

## Notes
- Data is stored as a JSON blob per API key in SQLite `data_store`.
- CORS is enabled with `ALLOWED_ORIGINS`.

