import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
// for serving frontend
import path from 'path';
import { fileURLToPath } from 'url';

// Open sqlite with promise API
async function initDb(dbFile) {
    const db = await open({ filename: dbFile, driver: sqlite3.Database });
    await db.exec(`CREATE TABLE IF NOT EXISTS data_store (
        api_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )`);
    return db;
}

function buildCorsOptions() {
    const allowed = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || ['*'];
    if (allowed.includes('*')) {
        return { origin: true, credentials: false };
    }
    return {
        origin: function(origin, callback) {
            if (!origin) return callback(null, true);
            if (allowed.includes(origin)) return callback(null, true);
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: false
    };
}

const allowedKeys =
  process.env.ALLOWED_API_KEYS?.split(',').map(s => s.trim()).filter(Boolean) || [];

function requireApiKey(req, res, next) {
    const apiKey = req.header('x-api-key');
    if (!apiKey) return res.status(401).json({ error: 'Missing x-api-key header' });
    if (allowedKeys.length > 0 && !allowedKeys.includes(apiKey)) {
        return res.status(403).json({ error: 'Invalid API key' });
    }
    req.apiKey = apiKey;
    next();
}

// basic auth for frontend
function basicAuth(req, res, next) {
    if (!process.env.ERP_AUTH_USER || !process.env.ERP_AUTH_PASS) return next(); // désactivé si non configuré
  
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [user, pass] = Buffer.from(b64auth, 'base64').toString().split(':');
  
    if (user === process.env.ERP_AUTH_USER && pass === process.env.ERP_AUTH_PASS) return next();
  
    res.set('WWW-Authenticate', 'Basic realm="FreelanceERP"');
    return res.status(401).send('Authentication required.');
  }

  
async function main() {
    const app = express();
    const port = process.env.PORT || 3001;
    const dbFile = process.env.DB_FILE || './data.sqlite';
    const db = await initDb(dbFile);

    app.disable('x-powered-by');
    app.use(cors(buildCorsOptions())); // security
    app.use(basicAuth); // security basic auth
    app.use(express.json({ limit: '4mb' }));

    app.get('/health', (req, res) => {
        res.json({ ok: true, now: new Date().toISOString() });
    });

    // Fetch current dataset
    app.get('/api/data', requireApiKey, async (req, res) => {
        try {
            const row = await db.get('SELECT payload, updated_at FROM data_store WHERE api_key = ?', req.apiKey);
            if (!row) return res.json({ data: { clients: [], missions: [], invoices: [], cras: [], operations: [], company: {} }, updatedAt: null });
            let payload;
            try {
                payload = JSON.parse(row.payload);
                // CORRECTION: S'assurer que company existe dans les données chargées
                if (!payload.company) {
                    payload.company = {};
                }
            } catch (_) {
                payload = { clients: [], missions: [], invoices: [], cras: [], operations: [], company: {} };
            }
            res.json({ data: payload, updatedAt: row.updated_at });
        } catch (e) {
            res.status(500).json({ error: 'Database error' });
        }
    });

    // Replace dataset
    app.put('/api/data', requireApiKey, async (req, res) => {
        try {
            const payload = req.body?.data;
            if (!payload || typeof payload !== 'object') {
                return res.status(400).json({ error: 'Body must be { data: {...} }' });
            }
            // Server-side validation: ensure referential integrity before saving
            const validation = validatePayload(payload);
            if (!validation.valid) {
                return res.status(400).json({ error: 'Invalid data', details: validation.errors });
            }
            const json = JSON.stringify(payload);
            const now = new Date().toISOString();
            await db.run(
                'INSERT INTO data_store(api_key, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(api_key) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at',
                req.apiKey,
                json,
                now
            );
            res.json({ ok: true, updatedAt: now });
        } catch (e) {
            res.status(500).json({ error: 'Database error' });
        }
    });

    // Validate payload structure and referential integrity
    function validatePayload(payload) {
        const errors = [];

        const clients = Array.isArray(payload.clients) ? payload.clients : [];
        const missions = Array.isArray(payload.missions) ? payload.missions : [];
        const invoices = Array.isArray(payload.invoices) ? payload.invoices : [];
        const cras = Array.isArray(payload.cras) ? payload.cras : [];

        // Helper: collect ids
        const clientIds = new Set(clients.map(c => c.id).filter(id => id !== undefined && id !== null));
        const missionIds = new Set(missions.map(m => m.id).filter(id => id !== undefined && id !== null));
        const invoiceIds = new Set(invoices.map(i => i.id).filter(id => id !== undefined && id !== null));
        const craIds = new Set(cras.map(c => c.id).filter(id => id !== undefined && id !== null));

        // Check for duplicate IDs within each collection
        function findDuplicates(arr) {
            const seen = new Set();
            const dupes = new Set();
            for (const x of arr) {
                if (x === undefined || x === null) continue;
                if (seen.has(x)) dupes.add(x);
                seen.add(x);
            }
            return [...dupes];
        }

        const dupClients = findDuplicates(clients.map(c => c.id));
        if (dupClients.length) errors.push(`Duplicate client ids: ${dupClients.join(', ')}`);
        const dupMissions = findDuplicates(missions.map(m => m.id));
        if (dupMissions.length) errors.push(`Duplicate mission ids: ${dupMissions.join(', ')}`);
        const dupInvoices = findDuplicates(invoices.map(i => i.id));
        if (dupInvoices.length) errors.push(`Duplicate invoice ids: ${dupInvoices.join(', ')}`);
        const dupCras = findDuplicates(cras.map(c => c.id));
        if (dupCras.length) errors.push(`Duplicate CRA ids: ${dupCras.join(', ')}`);

        // Referential checks
        // Missions must reference an existing clientId
        missions.forEach(m => {
            if (m.clientId == null) {
                errors.push(`Mission ${m.id ?? '<no-id>'} missing clientId`);
            } else if (!clientIds.has(m.clientId)) {
                errors.push(`Mission ${m.id ?? '<no-id>'} references unknown clientId ${m.clientId}`);
            }
        });

        // Invoices must reference existing clientId and missionId if present
        invoices.forEach(i => {
            if (i.clientId == null) {
                errors.push(`Invoice ${i.id ?? '<no-id>'} missing clientId`);
            } else if (!clientIds.has(i.clientId)) {
                errors.push(`Invoice ${i.id ?? '<no-id>'} references unknown clientId ${i.clientId}`);
            }
            if (i.missionId != null && !missionIds.has(i.missionId)) {
                errors.push(`Invoice ${i.id ?? '<no-id>'} references unknown missionId ${i.missionId}`);
            }
        });

        // CRAs must reference existing missionId
        cras.forEach(c => {
            if (c.missionId == null) {
                errors.push(`CRA ${c.id ?? '<no-id>'} missing missionId`);
            } else if (!missionIds.has(c.missionId)) {
                errors.push(`CRA ${c.id ?? '<no-id>'} references unknown missionId ${c.missionId}`);
            }
        });

        // Optional: Basic shape checks
        if (!Array.isArray(payload.clients)) errors.push('clients must be an array');
        if (!Array.isArray(payload.missions)) errors.push('missions must be an array');
        if (!Array.isArray(payload.invoices)) errors.push('invoices must be an array');
        if (!Array.isArray(payload.cras)) errors.push('cras must be an array');

        return { valid: errors.length === 0, errors };
    }

     // serve frontend files
     const __filename = fileURLToPath(import.meta.url);
     const __dirname = path.dirname(__filename);

     app.use(express.static(path.join(__dirname, 'frontend')));
   
    // fallback to index.html (pour single-page app)
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
    });

    app.listen(port, () => {
        console.log(`FreelanceERP backend listening on http://localhost:${port}`);
    });
}

main().catch(err => {
    console.error('Fatal error during startup', err);
    process.exit(1);
});


