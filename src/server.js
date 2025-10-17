import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';
// for serving frontend
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize SQLite session store
const SQLiteStoreSession = SQLiteStore(session);

// Open sqlite with promise API
async function initDb(dbFile) {
    const db = await open({ filename: dbFile, driver: sqlite3.Database });
    
    // Create data store table
    await db.exec(`CREATE TABLE IF NOT EXISTS data_store (
        api_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )`);
    
    // Create users table for authentication
    await db.exec(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'user',
        created_at TEXT NOT NULL
    )`);
    
    // Create default admin user if no users exist
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    if (userCount.count === 0) {
        const defaultPassword = process.env.ERP_AUTH_PASSWORD || 'admin123';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        await db.run(
            'INSERT INTO users (username, password, email, role, created_at) VALUES (?, ?, ?, ?, ?)',
            process.env.ERP_AUTH_USER || 'admin',
            hashedPassword,
            process.env.ERP_AUTH_EMAIL || 'admin@freelance-erp.local',
            'admin',
            new Date().toISOString()
        );
        console.log('If you do not set these ENV variables:  ERP_AUTH_USER, ERP_AUTH_PASSWORD, use admin and admin123 for login');
        console.log('⚠️  Please change the default password immediately!');
    }
    
    return db;
}

function buildCorsOptions() {
    const allowed = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || ['*'];
    if (allowed.includes('*')) {
        return { origin: true, credentials: true }; // Enable credentials for sessions
    }
    return {
        origin: function(origin, callback) {
            if (!origin) return callback(null, true);
            if (allowed.includes(origin)) return callback(null, true);
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true // Enable credentials for sessions
    };
}

// Middleware to check if user is authenticated (for web interface)
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        return res.redirect('/login');
    }
    next();
}

async function main() {
    const app = express();
    const port = process.env.PORT || 3001;
    const jsonSizeLimit = process.env.JSON_SIZE_LIMIT || '16mb'
    const dbDirRaw = process.env.DB_DIR || './'
    const dbDir = dbDirRaw.endsWith('/') ? dbDirRaw : dbDirRaw + '/';
    const dbFile = dbDir + 'erp-data.db';
    const db = await initDb(dbFile);

    app.disable('x-powered-by');
    // Session configuration
    app.use(session({
        store: new SQLiteStoreSession({
            db: 'sessions.db',
            dir: dbDir
        }),
        secret: process.env.SESSION_SECRET || 'change-this-secret-key-in-production',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            httpOnly: true,
            maxAge: 2 * 24 * 60 * 60 * 1000 // 3 days
        }
    }));
    
    app.use(cors(buildCorsOptions()));
    app.use(express.json({ limit: jsonSizeLimit }));
    app.use(express.urlencoded({ extended: true }));

    // Get current user info
    app.get('/api/auth/me', (req, res) => {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        res.json({
            id: req.session.userId,
            username: req.session.username,
            role: req.session.role
        });
    });

    // Login endpoint
    app.post('/api/auth/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password required' });
            }
            
            const user = await db.get('SELECT * FROM users WHERE username = ?', username);
            
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            const validPassword = await bcrypt.compare(password, user.password);
            
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            // Create session
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role;
            
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    });

    // Logout endpoint
    app.post('/api/auth/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Logout failed' });
            }
            res.clearCookie('connect.sid');
            res.json({ success: true });
        });
    });

    // Change password endpoint
    app.post('/api/auth/change-password', requireAuth, async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ error: 'Current and new password required' });
            }
            
            if (newPassword.length < 8) {
                return res.status(400).json({ error: 'New password must be at least 8 characters' });
            }
            
            const user = await db.get('SELECT * FROM users WHERE id = ?', req.session.userId);
            const validPassword = await bcrypt.compare(currentPassword, user.password);
            
            if (!validPassword) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
            
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await db.run('UPDATE users SET password = ? WHERE id = ?', hashedPassword, req.session.userId);
            
            res.json({ success: true, message: 'Password changed successfully' });
        } catch (error) {
            console.error('Password change error:', error);
            res.status(500).json({ error: 'Failed to change password' });
        }
    });

    // Health check (public)
    app.get('/health', (req, res) => {
        res.json({ ok: true, now: new Date().toISOString() });
    });

    // Web interface endpoints (require session auth)
    app.get('/api/web/data', requireAuth, async (req, res) => {
        try {
            // For web interface, use a default API key or user-specific key
            const apiKey = `user_${req.session.userId}`;
            const row = await db.get('SELECT payload, updated_at FROM data_store WHERE api_key = ?', apiKey);
            if (!row) return res.json({ data: { clients: [], missions: [], invoices: [], cras: [], operations: [], company: {} }, updatedAt: null });
            let payload;
            try {
                payload = JSON.parse(row.payload);
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
    app.put('/api/web/data', requireAuth, async (req, res) => {
        try {
            const payload = req.body?.data;
            if (!payload || typeof payload !== 'object') {
                return res.status(400).json({ error: 'Body must be { data: {...} }' });
            }

            const validation = validatePayload(payload);
            if (!validation.valid) {
                return res.status(400).json({ error: 'Invalid data', details: validation.errors });
            }
            
            const apiKey = `user_${req.session.userId}`;
            const json = JSON.stringify(payload);
            const now = new Date().toISOString();
            await db.run(
                'INSERT INTO data_store(api_key, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(api_key) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at',
                apiKey,
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
        // Check for duplicate IDs within each collection
        const dupClients = findDuplicates(clients.map(c => c.id));
        if (dupClients.length) errors.push(`Duplicate client ids: ${dupClients.join(', ')}`);
        const dupMissions = findDuplicates(missions.map(m => m.id));
        if (dupMissions.length) errors.push(`Duplicate mission ids: ${dupMissions.join(', ')}`);
        const dupInvoices = findDuplicates(invoices.map(i => i.id));
        if (dupInvoices.length) errors.push(`Duplicate invoice ids: ${dupInvoices.join(', ')}`);
        const dupCras = findDuplicates(cras.map(c => c.id));
        if (dupCras.length) errors.push(`Duplicate CRA ids: ${dupCras.join(', ')}`);

        // Missions must reference an existing clientId
        missions.forEach(m => {
            if (m.clientId == null) {
                errors.push(`Mission ${m.id ?? '<no-id>'} missing clientId`);
            } else if (!clientIds.has(m.clientId)) {
                errors.push(`Mission ${m.id ?? '<no-id>'} references unknown clientId ${m.clientId}`);
            }
        });

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

        cras.forEach(c => {
            if (c.missionId == null) {
                errors.push(`CRA ${c.id ?? '<no-id>'} missing missionId`);
            } else if (!missionIds.has(c.missionId)) {
                errors.push(`CRA ${c.id ?? '<no-id>'} references unknown missionId ${c.missionId}`);
            }
        });

        if (!Array.isArray(payload.clients)) errors.push('clients must be an array');
        if (!Array.isArray(payload.missions)) errors.push('missions must be an array');
        if (!Array.isArray(payload.invoices)) errors.push('invoices must be an array');
        if (!Array.isArray(payload.cras)) errors.push('cras must be an array');

        return { valid: errors.length === 0, errors };
    }

    // Serve frontend files
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Serve login page (no auth required)
    app.get('/login', (req, res) => {
        res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
    });

    // Serve static files (CSS, JS - no auth required for these)
    app.use('/style.css', express.static(path.join(__dirname, 'frontend', 'style.css')));
    // app.use('/js', express.static(path.join(__dirname, 'frontend', 'js')));

    // Protected routes - require authentication
    app.use('/', requireAuth, express.static(path.join(__dirname, 'frontend')));

    // Fallback to index.html for single-page app (protected)
    app.get('*', requireAuth, (req, res) => {
        res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
    });

    app.listen(port, () => {
        console.log(`FreelanceERP backend listening on http://localhost:${port}`);
        console.log(`Login at http://localhost:${port}/login`);
    });
}

main().catch(err => {
    console.error('Fatal error during startup', err);
    process.exit(1);
});
