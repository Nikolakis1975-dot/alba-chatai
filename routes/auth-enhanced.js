const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const EmailService = require('../utils/emailService');
const crypto = require('crypto');

// Gjenero token verifikimi
function generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ✅ 1. LOGIN ME HTTP-ONLY COOKIE
router.post('/login-with-verification', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validimi i të dhënave
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ju lutem plotësoni të gjitha fushat' 
            });
        }

        // Gjej përdoruesin
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Përdoruesi ose fjalëkalimi është i gabuar' 
            });
        }

        // Kontrollo nëse email-i është i verifikuar (nëse ka email)
        if (user.email && !user.is_verified) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email-i nuk është verifikuar. Kontrollo email-in për linkun e verifikimit.' 
            });
        }

        // Kontrollo fjalëkalimin
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'Përdoruesi ose fjalëkalimi është i gabuar' 
            });
        }

        // Krijo JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username,
                email: user.email 
            }, 
            process.env.JWT_SECRET || 'fallback_secret_2024', 
            { expiresIn: '24h' }
        );

        // ✅ DËRGO TOKEN SI HTTP-ONLY COOKIE (MË E SIGURTA)
        res.cookie('auth_token', token, {
            httpOnly: true,      // I padepërtueshëm nga JavaScript
            secure: process.env.NODE_ENV === 'production', // HTTPS në production
            sameSite: 'strict',  // Parandalon CSRF attacks
            maxAge: 24 * 60 * 60 * 1000, // 24 orë
            path: '/'            // Disponueshëm në të gjitha rrugët
        });

        // ✅ Kthe vetëm të dhënat e nevojshme (JO token)
        res.json({
            success: true,
            message: 'Hyrja u krye me sukses!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email || '',
                is_verified: user.is_verified || false,
                profile_picture: user.profile_picture || ''
            }
        });

    } catch (error) {
        console.error('Gabim në login:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gabim i brendshëm i serverit' 
        });
    }
});

// ✅ 2. REGJISTRIM ME VERIFIKIM EMAIL
router.post('/register-with-verification', async (req, res) => {
    try {
        const { username, password, email } = req.body;

        // Validimi i të dhënave
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ju lutem plotësoni të gjitha fushat' 
            });
        }

        // Kontrollo nëse ekziston përdoruesi
        const userExists = await new Promise((resolve, reject) => {
            const query = email 
                ? 'SELECT * FROM users WHERE username = ? OR email = ?'
                : 'SELECT * FROM users WHERE username = ?';
            
            const params = email ? [username, email] : [username];
            
            db.get(query, params, (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (userExists) {
            return res.status(400).json({ 
                success: false, 
                message: 'Përdoruesi ose email-i ekziston tashmë' 
            });
        }

        // Hash password-in
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Përgatit parametrat për databazë
        let query, params;
        
        if (email) {
            // Regjistrim me email dhe verifikim
            const verificationToken = generateVerificationToken();
            const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

            query = `INSERT INTO users (username, password, email, verification_token, verification_token_expires, is_verified) 
                     VALUES (?, ?, ?, ?, ?, ?)`;
            params = [username, hashedPassword, email, verificationToken, verificationTokenExpires, false];
        } else {
            // Regjistrim pa email (përputhshmëri me versionin e vjetër)
            query = `INSERT INTO users (username, password) VALUES (?, ?)`;
            params = [username, hashedPassword];
        }

        // Krijo përdoruesin
        const userId = await new Promise((resolve, reject) => {
            db.run(query, params, function(err) {
                if (err) reject(err);
                resolve(this.lastID);
            });
        });

        // Nëse ka email, dërgo email verifikimi
        if (email) {
            const emailSent = await EmailService.sendVerificationEmail(email, verificationToken);

            if (emailSent) {
                res.json({ 
                    success: true, 
                    message: 'Regjistrimi u krye! Kontrollo email-in për linkun e verifikimit.' 
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    message: 'Regjistrimi u krye, por dërgimi i email-it dështoi. Kontakto support.' 
                });
            }
        } else {
            res.json({ 
                success: true, 
                message: 'Regjistrimi u krye me sukses!' 
            });
        }

    } catch (error) {
        console.error('Gabim në regjistrim:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gabim i brendshëm i serverit' 
        });
    }
});

// ✅ 3. ENDPOINT PËR TË MARRË TË DHËNAT E PËRDORUESIT AKTUAL
router.get('/me', async (req, res) => {
    try {
        // ✅ MER TOKEN-IN NGA HTTP-ONLY COOKIE
        const token = req.cookies.auth_token;
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Nuk jeni i loguar' 
            });
        }
        
        // Verifiko token-in
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_2024');
        
        // Merr të dhënat nga databaza
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id, username, email, is_verified, profile_picture, created_at FROM users WHERE id = ?', 
                  [decoded.userId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
        
        if (!user) {
            // ✅ FSHI COOKIE-N NËSE PËRDORUESI NUK EKZISTON
            res.clearCookie('auth_token');
            return res.status(404).json({ 
                success: false, 
                message: 'Përdoruesi nuk u gjet' 
            });
        }
        
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email || '',
                is_verified: user.is_verified || false,
                profile_picture: user.profile_picture || '',
                created_at: user.created_at
            }
        });
        
    } catch (error) {
        console.error('Gabim në /me endpoint:', error);
        
        // ✅ FSHI COOKIE-N NËSE TOKEN-I ËSHTË I PAVLEFSHËM
        res.clearCookie('auth_token');
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Session i pavlefshëm' 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Gabim i brendshëm i serverit' 
        });
    }
});

// ✅ 4. VERIFIKIM EMAIL-I
router.post('/request-email-verification', async (req, res) => {
    try {
        // ✅ MER TOKEN-IN NGA COOKIE
        const token = req.cookies.auth_token;
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Nuk jeni i loguar' 
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_2024');
        
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Përdoruesi nuk u gjet' 
            });
        }
        
        // Nëse përdoruesi nuk ka email
        if (!user.email) {
            return res.json({ 
                success: true, 
                message: 'Përdoruesit aktual nuk ka email të regjistruar. Për të përdorur këtë veçori, ju lutem regjistrohuni përsëri me email.' 
            });
        }
        
        // Nëse email-i është i verifikuar
        if (user.is_verified) {
            return res.json({ 
                success: true, 
                message: 'Email-i është tashmë i verifikuar!' 
            });
        }
        
        // Gjenero token të ri dhe dërgo email
        const verificationToken = generateVerificationToken();
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
                [verificationToken, expires, user.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });
        
        const emailSent = await EmailService.sendVerificationEmail(user.email, verificationToken);
        
        if (emailSent) {
            res.json({ 
                success: true, 
                message: 'Email-i i verifikimit u dërgua! Kontrollo email-in tuaj.' 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Dërgimi i email-it dështoi. Provo përsëri më vonë.' 
            });
        }
        
    } catch (error) {
        console.error('Gabim në verifikim email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gabim i brendshëm i serverit' 
        });
    }
});

// ✅ 5. LOGOUT (FSHI COOKIE-N)
router.post('/logout', (req, res) => {
    // ✅ FSHI HTTP-ONLY COOKIE
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    
    res.json({
        success: true,
        message: 'Jeni dale me sukses nga sistemi'
    });
});

// ✅ 6. VERIFIKIM EMAIL-I NGA LINKU
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).send('Token i pavlefshëm');
        }

        // Gjej përdoruesin me token-in
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE verification_token = ? AND verification_token_expires > ?',
                [token, new Date()],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!user) {
            return res.status(400).send('Token i pavlefshëm ose i skaduar');
        }

        // Verifiko përdoruesin
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET is_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = ?',
                [user.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Email i Verifikuar - ChatAI ALBA</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                    .container { background: white; color: #333; padding: 40px; border-radius: 10px; margin: 0 auto; max-width: 500px; }
                    .success { color: #28a745; font-size: 48px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success">✅</div>
                    <h1>Email-i u Verifikua me Sukses!</h1>
                    <p>Llogaria juaj është aktivizuar. Tani mund të hyni në ChatAI ALBA.</p>
                    <a href="/" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px;">
                        Shko në Faqen Kryesore
                    </a>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Gabim në verifikim:', error);
        res.status(500).send('Gabim në verifikimin e email-it');
    }
});

module.exports = router;
