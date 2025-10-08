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

// function requireApiKey(req, res, next) {
//     const apiKey = req.header('x-api-key');
//     if (!apiKey) return res.status(401).json({ error: 'Missing x-api-key header' });
//     req.apiKey = apiKey;
//     next();
// }
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

    // basic auth for frontend
    app.use(basicAuth);

    app.use(cors(buildCorsOptions()));
    app.use(express.json({ limit: '2mb' }));

    app.get('/health', (req, res) => {
        res.json({ ok: true, now: new Date().toISOString() });
    });

    // Fetch current dataset
    app.get('/api/data', requireApiKey, async (req, res) => {
        try {
            const row = await db.get('SELECT payload, updated_at FROM data_store WHERE api_key = ?', req.apiKey);
            if (!row) return res.json({ data: { clients: [], missions: [], invoices: [], cras: [], company: {} }, updatedAt: null });
            let payload;
            try {
                payload = JSON.parse(row.payload);
                // CORRECTION: S'assurer que company existe dans les données chargées
                if (!payload.company) {
                    payload.company = {};
                }
            } catch (_) {
                payload = { clients: [], missions: [], invoices: [], cras: [], company: {} };
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


