# FreelanceERP (ferp)

**FreelanceERP (ferp)** is a minimalist ERP for freelancers.  
A lightweight Node.js application with an Express backend and a plain JavaScript frontend.  
It manages clients, invoices, and payments with an embedded SQLite database — no external dependencies required.

**Docker image:** `zabradocker/ferp:1.0.0`  
**Goal:** simplicity, portability, autonomy.

Designed as a **lightweight alternative** to tools like *Akaunting* or *InvoiceShelf* — ideal for independent IT freelancers who prefer control and speed over complexity.

---

## 🐳 Run

You can quickly test the app using the published Docker image:

```bash
docker run --name ferp -dit -p 3001:3001 zabradocker/ferp:1.0.0
```

Or Or use the provided `docker-compose.yaml`: 

```bash
docker-compose up -d
``````

Then access the app at [http://localhost:3001](http://localhost:3001)


## Environment Variables

Optional environment variables (with defaults):

```bash
PORT=3001
DB_DIR=/opt/data
JSON_SIZE_LIMIT=16mb
#
ERP_AUTH_USER=admin
ERP_AUTH_PASSWORD=admin123
ERP_AUTH_EMAIL=admin@freelance-erp.local
#
SESSION_SECRET=change-this-secret-key-in-production
NODE_ENV= # production or dev
```

## 🔐 Security - mTLS

If you expose the app over the internet, consider using **certificate-based authentication (mTLS)** to restrict access to trusted clients only.

If you’re using Traefik as a reverse proxy, enable it easily with: [clientAuthType: RequireAndVerifyClientCert](https://doc.enoks.fr/freelanceERP/#mtls-certificate-based-authentication)


## Development

Run the app locally from the src directory.

1. Install Node.js >= 18

2. From the project directory:
```bash
# for development
npm install

# for production
npm install --omit=dev
```

3. (Optional) Create a .env file (defaults shown):
```
PORT=3001
DB_DIR=./
JSON_SIZE_LIMIT=16mb
#
ERP_AUTH_USER=admin
ERP_AUTH_PASSWORD=admin123
ERP_AUTH_EMAIL=admin@freelance-erp.local
#
SESSION_SECRET=change-this-secret-key-in-production
NODE_ENV= # production or dev
```

4. Run the app

```bash
npm run start
```