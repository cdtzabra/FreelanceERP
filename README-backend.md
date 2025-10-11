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


## docker-compose

```yaml
---
networks:
  zabra:
    external: true

services:
  vitrine:
    image: "erp:latest"
    container_name: vitrine
    hostname: "erp.enoks.fr"
    restart: always
    networks:
      - zabra
    # volumes:
    #   - ./vitrine-data/:/usr/share/nginx/html:ro
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.vitrine.rule=Host(`erp.enoks.fr`)"
      - "traefik.http.routers.vitrine.entrypoints=websecure"
      - "traefik.http.routers.vitrine.tls=true"
      # Use mTLS only for this router (file provider target)
      - "traefik.http.routers.vitrine.tls.options=mtls-required@file"
      # optionally add ForwardAuth middleware if you want app-level mapping
      - "traefik.http.routers.vitrine.middlewares=traefik-forward-auth@file"
```


## mTLS

1. Create CA key and self-signed cert (secure ca.key)

```shell
# CA private key (4096 bits)
openssl genpkey -algorithm RSA -out ca.key -pkeyopt rsa_keygen_bits:4096

# Self-signed CA cert (10 years)
openssl req -x509 -new -key ca.key -sha256 -days 3650 -out ca.crt \
  -subj "/C=FR/O=Enoks/CN=FreelanceERP-CA"
```

2. Create client key + CSR

```shell
openssl genpkey -algorithm RSA -out client1.key -pkeyopt rsa_keygen_bits:2048
openssl req -new -key client1.key -out client1.csr -subj "/CN=samsung-s24/O=Enoks"
```

3. Sign CSR with CA (enable clientAuth EKU)

```shell
printf "extendedKeyUsage = clientAuth\n" > client-ext.cnf

openssl x509 -req -in client1.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out client1.crt -days 365 -sha256 -extfile client-ext.cnf
```

Store ca.key offline and securely. Copy ca.crt to Traefik host for trust.

4. Export to PKCS#12 for mobile import (.p12)
   
```shell
openssl pkcs12 -export -out client1.p12 -inkey client1.key -in client1.crt -certfile ca.crt \
  -name "FreelanceERP device-iphone-01"
# choose a strong export password
```

> Traefik settings

1. Traefik dynamic TLS options — traefik/dynamic/tls-options.yaml

```yaml
tls
tls:
  options:
    default:
      # copy existing data from traefik.yaml
    mtls-required:
      clientAuth:
        caFiles:
          - /etc/traefik/ssl/ca.crt   # mount this in Traefik container
        clientAuthType: RequireAndVerifyClientCert
      minVersion: TLS12
      sniStrict: true
```

2. Traefik dynamic ForwardAuth middleware — traefik/dynamic/middlewares.yaml

```yaml
http:
  middlewares:
    traefik-forward-auth:
      forwardAuth:
        address: "http://vitrine-auth:3002/traefik-auth"  # internal auth service (separate container)
        trustForwardHeader: true
        authResponseHeaders:
          - "x-api-key"
```
Notes:

- authResponseHeaders tells Traefik to inject the x-api-key header returned by the auth service into the proxied request to the app.
- We use x-api-key directly so your app needs no code chan


> Label for ERP docker-compose.yml

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.vitrine.rule=Host(`erp.enoks.fr`)"
  - "traefik.http.routers.vitrine.entrypoints=websecure"
  - "traefik.http.routers.vitrine.tls=true"
  - "traefik.http.routers.vitrine.tls.options=mtls-required@file"
  - "traefik.http.routers.vitrine.middlewares=traefik-forward-auth@file"
```

Add a small ForwardAuth service (separate container) — minimal Express example Create a tiny service (image vitrine-auth) that Traefik calls to authorize certs and return an x-api-key. This avoids changing the app.



```js
import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function initDb(dbFile = './data.sqlite') {
  const db = await open({ filename: dbFile, driver: sqlite3.Database });
  // device_certs table: cn, serial, api_key, revoked
  await db.exec(`
    CREATE TABLE IF NOT EXISTS device_certs (
      id INTEGER PRIMARY KEY,
      cn TEXT UNIQUE,
      serial TEXT UNIQUE,
      api_key TEXT,
      revoked INTEGER DEFAULT 0
    );
  `);
  return db;
}

function normalizeSerial(s) {
  if (!s) return null;
  return String(s).replace(/^0x/i, '').replace(/[^0-9a-f]/gi, '').toLowerCase();
}

function extractCNFromXfcc(xfcc) {
  if (!xfcc) return null;
  // XFCC formats vary; attempt common patterns
  const subj = /Subject="?([^"]+)"?/.exec(xfcc) || /subject="?([^"]+)"?/.exec(xfcc);
  if (subj && subj[1]) {
    const cn = /CN=([^,\/]+)/i.exec(subj[1]);
    if (cn) return cn[1];
  }
  const cn2 = /CN=([^,\/\s]+)/i.exec(xfcc);
  return cn2 ? cn2[1] : null;
}

(async () => {
  const db = await initDb(process.env.DB_FILE || './data.sqlite');
  const app = express();

  app.all('/traefik-auth', async (req, res) => {
    try {
      // Traefik may forward the client cert in headers like X-Forwarded-Client-Cert or x-ssl-client-cert
      const xfcc = req.headers['x-forwarded-client-cert'] || req.headers['x-ssl-client-cert'] || '';
      const cn = extractCNFromXfcc(xfcc);
      // Also try header-provided serials
      const serialHeader = req.headers['x-ssl-client-serial'] || req.headers['x-client-serial'] || '';
      const serial = normalizeSerial(serialHeader) || null;

      // Prefer lookup by serial if present
      let row = null;
      if (serial) row = await db.get('SELECT * FROM device_certs WHERE serial = ?', serial);
      if (!row && cn) row = await db.get('SELECT * FROM device_certs WHERE cn = ?', cn);

      if (!row || row.revoked) {
        return res.status(401).send('unauthorized');
      }

      // OK: return 200 and set x-api-key in response headers so Traefik injects it
      res.set('x-api-key', row.api_key);
      return res.status(200).send('ok');
    } catch (err) {
      console.error('auth error', err);
      return res.status(500).send('error');
    }
  });

  const port = process.env.PORT || 3002;
  app.listen(port, () => console.log('vitrine-auth listening on', port));
})();
```

Compose service snippet for the auth service:

```yaml
services:
  vitrine-auth:
    build: ./vitrine-auth
    container_name: vitrine-auth
    networks:
      - zabra
    environment:
      - DB_FILE=/data/data.sqlite
    volumes:
      - ./data/:/data/:rw   # ensure same DB used or replicate mapping to central DB

```

You can either point this service at the same SQLite DB file (mounted), or maintain a separate device mapping DB and sync as needed.



Mount CA + dynamic files into Traefik container Traefik service (fragment):

```yaml
services:
  traefik:
    image: traefik:v3
    # ... existing static config ...
    volumes:
      - ./traefik/dynamic/:/etc/traefik/dynamic/:ro
      - ./traefik/ssl/ca.crt:/etc/traefik/ssl/ca.crt:ro
      - ./acme.json:/acme.json
    networks:
      - zabra

```

And ensure Traefik static config enables the file provider and maps the dynamic directory.

Important: do not publish backend/auth ports
In your vitrine service do NOT include ports: mapping for 3001. Let it be reachable only via the zabra network.
vitrine-auth similarly should not be published to host.
Test (local) — use curl with client cert Assuming you have client1.crt and client1.key:

curl -v --cert client1.crt --key client1.key https://erp.enoks.fr/
Watch Traefik logs: you should see Traefik calling /traefik-auth, the auth service returning 200 and Traefik forwarding the request to vitrine with header x-api-key set to the mapped value.

Security notes & caveats

Traefik will inject the x-api-key header based on the ForwardAuth response. In most setups Traefik will overwrite existing header values with those produced by the auth response, but you must verify for your Traefik version. Because the backend is not publicly reachable, a client cannot bypass Traefik to set the header directly.
If you ever expose the backend port, an attacker could send their own x-api-key. So do not publish backend ports.
Keep vitrine-auth and vitrine on the same internal network only.
Implement revocation by setting revoked = 1 in device_certs. ForwardAuth will deny revoked certs immediately.
Keep CA private key offline. Only distribute signed client certs (.p12) securely.
Why this keeps your app unchanged

The app continues to expect x-api-key header and JSON payload exactly as before.
Traefik + ForwardAuth together ensure only clients with valid certs get a valid x-api-key added to requests before they reach your app — the app needs no code changes.
If anything goes wrong / follow-ups

If you want me to generate the actual dynamic files and a minimal vitrine-auth service in your repo, say so and I will add them as files (or provide copy-paste contents).
If Traefik in your environment does not overwrite the same header name, we can use a unique header like X-TRAEFIK-APIKEY and either:
Make a tiny one-line config change in the app to accept that header, or
Add a Traefik middleware (plugin) to copy that header to x-api-key before forwarding (more complex).
If you want me to implement the DB migration SQL and a small script to provision a test device record, I can add that too.
Would you like me to:

(A) create the two dynamic YAML files and a Docker Compose fragment you can paste, plus a ready-to-build vitrine-auth service in the repo, or
(B) just provide full copy-paste files here and you’ll add them manually?
Pick A or B. If A, I will create files in the repository (small edits / additions) and update the todo list.


### Revocation
Good question — revocation is critical. There are two practical levels you can use with the setup we discussed:

Immediate, reliable, app-level revocation (recommended): mark the device cert as revoked in your device_certs DB and rely on the ForwardAuth check that Traefik calls. This takes effect instantly and requires no Traefik changes.
Standard PKI revocation (CRL / OCSP): generate a CRL or run an OCSP responder from your CA and make the TLS terminator (Traefik or another proxy) consult it. This is standard PKI but needs more setup and depends on whether Traefik (or your chosen proxy) supports CRL/OCSP checks for client certs in your version.
I recommend using both if you want full PKI semantics, but at minimum implement the app-level revocation because it’s simple and works with the ForwardAuth pattern we used.

Below are step‑by‑step instructions and helpful commands.

Immediate revocation (app-level) — Recommended for your stack Why: Fast, easy, no change to Traefik, and works with the ForwardAuth endpoint that we already use.
Steps:

1. Find the cert identity (CN or serial) you want to revoke. If you have the cert file:

Get serial: openssl x509 -in client1.crt -noout -serial
Get CN: openssl x509 -in client1.crt -noout -subject

2. Mark it revoked in the DB table device_certs (SQLite example):

```sql
UPDATE device_certs
SET revoked = 1
WHERE serial = '<normalized-serial>' OR cn = 'device-iphone-01';
```
(Use the serial normalized exactly like your ForwardAuth code stores it: lowercase hex without 0x and without separators.)

3. ForwardAuth will immediately deny the cert (it looks up device_certs.revoked), so Traefik will return 401 and the client can’t access the app any more.

Notes:

This requires no Traefik configuration change and no restart.
Keep an audit log of revocations (who revoked, when, reason).
If you want to re-enable the device: set revoked = 0.





## Data Model

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