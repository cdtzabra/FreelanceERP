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


# Data Model

```json
{
  "exportDate": "2025-10-10T15:43:33.058Z",
  "version": "1.0",
  "data": {
    "clients": [
      {
        "id": 1,
        "company": "Societe-1",
        "siren": "123456789",
        "address": "Lille",
        "contact": {
          "name": "xx",
          "email": "toto@example.com",
          "phone": ""
        },
        "billingAddress": "",
        "billingEmail": "compta@example.com",
        "notes": "",
        "createdAt": "2025-10-08"
      }
    ],
    "missions": [
      {
        "id": 1,
        "title": "Expertise",
        "description": "session septembre",
        "clientId": 2,
        "startDate": "2025-09-25",
        "endDate": "2025-09-26",
        "dailyRate": 600,
        "status": "Terminée",
        "createdAt": "2025-10-08"
      }
    ],
    "invoices": [
      {
        "id": 1,
        "number": "FACT-2025-001",
        "date": "2025-09-30",
        "clientId": 1,
        "missionId": 3,
        "amount": 1800,
        "vatRate": 20,
        "status": "Envoyée",
        "dueDate": "2025-10-31",
        "paidDate": null,
        "createdAt": "2025-10-08"
      }
    ],
    "cras": [
      {
        "id": 1,
        "month": "2025-09",
        "workingDaysInMonth": 22,
        "missionId": 1,
        "daysWorked": 3,
        "notes": "",
        "createdAt": "2025-10-08"
      }
    ],
    "company": {
      "name": "xx",
      "address": "xx",
      "phone": "xx",
      "email": "xx",
      "siret": "xx",
      "tva_value": "xx",
      "nda": "xx",
      "iban": ""
    }
  }
}
```