require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');

// Importo rutat
const authRoutes = require('./routes/auth');
const authEnhanced = require('./routes/auth-enhanced');
const chatRoutes = require('./routes/chat');
const userRoutes = require('./routes/users');
const emailVerification = require('./routes/email-verification');
const apiRoutes = require('./routes/api');
const geminiRoutes = require('./routes/gemini');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ 1. CORS CONFIGURATION - DUHET TË JETË E PARË
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? 'https://chatai-alba.onrender.com' 
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true // ✅ Kjo lejon cookies
}));

// ✅ 2. COOKIE PARSER - DUHET TË JETË PARA BODY PARSER
app.use(cookieParser());

// ✅ 3. BODY PARSER ME LIMIT TË SHTUAR (10mb)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ✅ 4. STATIC FILES
app.use(express.static(path.join(__dirname, 'public')));

// ✅ 5. ROUTES - TË GJITHA PAS CORS DHE COOKIE PARSER
app.use('/api/auth', authRoutes);
app.use('/api/auth', authEnhanced);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/email', emailVerification);
app.use('/api/api-keys', apiRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/admin', adminRoutes);

// ✅ 6. RUTA DEFAULT
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ 7. ERROR HANDLING MIDDLEWARE
app.use((err, req, res, next) => {
    console.error('❌ Gabim në server:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Gabim i brendshëm i serverit' 
    });
});

// ✅ 8. 404 HANDLER
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Ruta nuk u gjet' 
    });
});

// ✅ 9. NIS SERVERIN
app.listen(PORT, () => {
    console.log(`🚀 Serveri është duke u drejtuar në portin ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🔐 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🍪 CORS Origin: ${process.env.NODE_ENV === 'production' ? 'https://chatai-alba.onrender.com' : 'http://localhost:3000'}`);
});

// ✅ 10. TESTO ENKRIPTIMIN
const encryption = require('./utils/encryption');
setTimeout(() => {
    console.log('🛡️ Testi i enkriptimit AES-256-CBC:');
    encryption.testEncryption();
}, 2000);
