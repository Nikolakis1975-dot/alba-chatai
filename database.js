const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Krijo drejtorinë data nëse nuk ekziston
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ U krijua drejtoria data/');
}

// Përdor /tmp/ për Render.com, data/ për development
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/tmp/chat.db'
    : path.join(__dirname, 'data', 'chat.db');

console.log(`🗄️  Rruga e databazës: ${dbPath}`);

// Krijo një instance të re të bazës së të dhënave
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('❌ Gabim gjatë lidhjes me databazën:', err.message);
        console.error('❌ Detajet e gabimit:', err);
        process.exit(1); // Ndalo aplikacionin nëse nuk lidhet me databazën
    } else {
        console.log('✅ U lidhë me sukses me databazën SQLite.');
        initializeDatabase();
    }
});

// ✅ FUNKSION I KORRIGJUAR PËR TË SHTUAR KOLONËN UPDATED_AT
function addUpdatedAtColumnToApiKeys() {
    console.log('🔍 Duke kontrolluar nëse tabela api_keys ka kolonën updated_at...');
    
    db.all("PRAGMA table_info(api_keys)", (err, columns) => {
        if (err) {
            console.error('❌ Gabim në kontrollimin e kolonave:', err);
            return;
        }
        
        // ✅ KORRIGJIMI KRYESOR - trajto si array
        const columnNames = Array.isArray(columns) 
            ? columns.map(col => col.name) 
            : [];
        
        console.log('📊 Kolonat ekzistuese në api_keys:', columnNames);
        
        if (!columnNames.includes('updated_at')) {
            console.log('🔄 Duke shtuar kolonën updated_at në tabelën ekzistuese...');
            
            // ✅ KORRIGJIM: Përdor DEFAULT NULL në vend të CURRENT_TIMESTAMP
            db.run('ALTER TABLE api_keys ADD COLUMN updated_at DATETIME DEFAULT NULL', (err) => {
                if (err) {
                    console.error('❌ Gabim në shtimin e kolonës updated_at:', err);
                } else {
                    console.log('✅ Kolona updated_at u shtua me sukses në tabelën ekzistuese');
                    
                    // ✅ PËRDITËSO REKORDET EKZISTUESE ME VLERËN E created_at
                    db.run('UPDATE api_keys SET updated_at = created_at WHERE updated_at IS NULL', (err) => {
                        if (err) {
                            console.error('❌ Gabim në përditësimin e vlerave:', err);
                        } else {
                            console.log('✅ Vlerat e updated_at u përditësuan me sukses');
                        }
                    });
                }
            });
        } else {
            console.log('✅ Kolona updated_at ekziston tashmë në api_keys');
        }
    });
}

// Funksioni për të inicializuar tabelat nëse nuk ekzistojnë
function initializeDatabase() {
    console.log('🔄 Duke inicializuar databazën...');
    
    // ✅ TABELA E PËRDORUESVE - VERSION I THJESHTUAR
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        verification_token TEXT,
        verification_token_expires DATETIME,
        is_verified BOOLEAN DEFAULT FALSE,
        profile_picture TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('❌ Gabim në tabelën users:', err);
        } else {
            console.log('✅ Tabela users u inicializua');
        }
    });

    // ✅ TABELA E API_KEYS PA KOLONËN UPDATED_AT (DO E SHTOJME ME VONE)
    db.run(`CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        api_key TEXT NOT NULL,
        service_name TEXT NOT NULL DEFAULT 'gemini',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Gabim në tabelën api_keys:', err);
        } else {
            console.log('✅ Tabela api_keys u inicializua');
        }
    });

    // Tabela e mesazheve
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        sender TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Gabim në tabelën messages:', err);
        } else {
            console.log('✅ Tabela messages u inicializua');
        }
    });

    // Tabela e njohurive
    db.run(`CREATE TABLE IF NOT EXISTS knowledge_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Gabim në tabelën knowledge_base:', err);
        } else {
            console.log('✅ Tabela knowledge_base u inicializua');
        }
    });

    // Tabela e feedback-ut
    db.run(`CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message_id TEXT NOT NULL,
        feedback_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Gabim në tabelën feedback:', err);
        } else {
            console.log('✅ Tabela feedback u inicializua');
        }
    });

    console.log('✅ Inicializimi i databazës përfundoi!');
    
    // ✅ THIRRE FUNKSIONIN PËR SHTIMIN E KOLONËS PAS INICIALIZIMIT
    setTimeout(addUpdatedAtColumnToApiKeys, 2000);
}

// Eksporto db object
module.exports = db;
