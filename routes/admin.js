const express = require('express');
const db = require('../database');
const router = express.Router();

// ✅ Middleware për verifikimin e administratorit
const authenticateAdmin = (req, res, next) => {
    const adminToken = req.query.token || req.headers['admin-token'];
    
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({ error: 'E paautorizuar. Token i nevojshëm admin.' });
    }
    next();
};

// ✅ Rruga kryesore e admin dashboard
router.get('/dashboard', authenticateAdmin, async (req, res) => {
    try {
        // Merr të gjitha statistikat
        const stats = await getAdminStats();
        res.json({
            success: true,
            message: 'Admin dashboard u ngarkua me sukses',
            stats: stats
        });
    } catch (error) {
        console.error('Gabim në admin dashboard:', error);
        res.status(500).json({ error: 'Gabim i brendshëm server' });
    }
});

// ✅ Statistikat e sistemit
async function getAdminStats() {
    return new Promise((resolve, reject) => {
        // Merr numrin e përdoruesve
        db.get('SELECT COUNT(*) as totalUsers FROM users', (err, userRow) => {
            if (err) return reject(err);
            
            // Merr numrin e mesazheve
            db.get('SELECT COUNT(*) as totalMessages FROM messages', (err, msgRow) => {
                if (err) return reject(err);
                
                // Merr numrin e njohurive
                db.get('SELECT COUNT(*) as totalKnowledge FROM knowledge_base', (err, knowRow) => {
                    if (err) return reject(err);
                    
                    // Merr numrin e API keys
                    db.get('SELECT COUNT(*) as totalApiKeys FROM api_keys', (err, apiRow) => {
                        if (err) return reject(err);
                        
                        // Kthen të gjitha statistikat
                        resolve({
                            totalUsers: userRow.totalUsers,
                            totalMessages: msgRow.totalMessages,
                            totalKnowledge: knowRow.totalKnowledge,
                            totalApiKeys: apiRow.totalApiKeys,
                            lastUpdated: new Date().toISOString()
                        });
                    });
                });
            });
        });
    });
}

// ✅ Lista e përdoruesve (pa të dhëna të ndjeshme)
router.get('/users', authenticateAdmin, (req, res) => {
    db.all(
        `SELECT id, username, created_at FROM users ORDER BY created_at DESC`,
        (err, rows) => {
            if (err) {
                console.error('Gabim në marrjen e përdoruesve:', err);
                return res.status(500).json({ error: 'Gabim gjatë marrjes së përdoruesve' });
            }
            res.json({ users: rows });
        }
    );
});

// ✅ Shiko mesazhet e fundit (pa përmbajtje të ndjeshme)
router.get('/messages', authenticateAdmin, (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    
    db.all(
        `SELECT m.id, u.username, m.sender, m.timestamp 
         FROM messages m 
         JOIN users u ON m.user_id = u.id 
         ORDER BY m.timestamp DESC 
         LIMIT ?`,
        [limit],
        (err, rows) => {
            if (err) {
                console.error('Gabim në marrjen e mesazheve:', err);
                return res.status(500).json({ error: 'Gabim gjatë marrjes së mesazheve' });
            }
            res.json({ messages: rows });
        }
    );
});

// ✅ Backup i databazës (shkarkon skedarin .db)
router.get('/backup', authenticateAdmin, (req, res) => {
    const dbPath = process.env.NODE_ENV === 'production' 
        ? '/tmp/chat.db' 
        : './data/chat.db';
    
    res.download(dbPath, `chat-backup-${new Date().toISOString().split('T')[0]}.db`, (err) => {
        if (err) {
            console.error('Gabim në shkarkimin e backup:', err);
            res.status(500).json({ error: 'Gabim gjatë shkarkimit të backup' });
        }
    });
});

// ✅ Kontrollo statusin e sistemit
router.get('/status', authenticateAdmin, (req, res) => {
    db.get('SELECT 1 as status', (err) => {
        if (err) {
            return res.status(500).json({ 
                status: 'error', 
                message: 'Databaza nuk është e lidhur',
                error: err.message 
            });
        }
        res.json({ 
            status: 'success', 
            message: 'Sistemi është online dhe funksional',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    });
});

module.exports = router;
