const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const EmailService = require('../utils/emailService');

// ✅ 1. REGJISTRIM ME EMAIL
router.post('/register-with-email', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        console.log('📥 Request regjistrimi:', { username, email });

        if (!username || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Plotëso të gjitha fushat' 
            });
        }

        // Validimi i email-it
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email-i nuk është valid' 
            });
        }

        // Kontrollo nëse ekziston përdoruesi
        const userExists = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ? OR email = ?', 
                  [username, email], (err, row) => {
                if (err) {
                    console.error('❌ Gabim në databazë:', err);
                    reject(err);
                }
                resolve(row);
            });
        });

        if (userExists) {
            if (userExists.username === username) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Përdoruesi ekziston tashmë' 
                });
            }
            if (userExists.email === email) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Email-i ekziston tashmë' 
                });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Gjenero token verifikimi
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 orë

        // Ruaj në databazë
        const userId = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (username, email, password, verification_token, verification_token_expires, is_verified) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [username, email, hashedPassword, verificationToken, tokenExpires, false],
                function(err) {
                    if (err) {
                        console.error('❌ Gabim në insert:', err);
                        reject(err);
                    }
                    console.log('✅ Përdoruesi u regjistrua me ID:', this.lastID);
                    resolve(this.lastID);
                }
            );
        });

        // ✅ DËRGO EMAIL VERIFIKIMI ME SHËRBIMIN E VËRTETË
        console.log('🔄 Duke dërguar email verifikimi...');
        const emailSent = await EmailService.sendVerificationEmail(email, verificationToken);

        if (emailSent) {
            console.log('✅ Email verifikimi u dërgua me sukses për:', email);
            res.json({ 
                success: true, 
                message: 'Regjistrimi u krye me sukses! Kontrollo email-in për linkun e verifikimit.' 
            });
        } else {
            console.log('⚠️ Email verifikimi dështoi për:', email);
            res.status(500).json({ 
                success: false, 
                message: 'Regjistrimi u krye, por dërgimi i email-it dështoi. Provo përsëri më vonë ose kontakto support.' 
            });
        }

    } catch (error) {
        console.error('❌ Gabim në regjistrim:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gabim i brendshëm i serverit' 
        });
    }
});

// ✅ 2. VERIFIKIM EMAIL-I
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;

        console.log('📥 Request verifikimi me token:', token ? `${token.substring(0, 10)}...` : 'NULL');

        if (!token) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html lang="sq">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Token i Pavlefshëm - ChatAI ALBA</title>
                    <style>
                        body { 
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh;
                        }
                        .container { 
                            background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
                            text-align: center; max-width: 500px; width: 90%;
                        }
                        .error-icon { font-size: 64px; color: #e53e3e; margin-bottom: 20px; }
                        h1 { color: #e53e3e; margin-bottom: 15px; }
                        p { color: #4a5568; margin-bottom: 25px; line-height: 1.6; }
                        .button { 
                            background: #667eea; color: white; padding: 12px 24px; text-decoration: none; 
                            border-radius: 8px; display: inline-block; font-weight: bold; transition: transform 0.2s;
                        }
                        .button:hover { transform: translateY(-2px); }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="error-icon">❌</div>
                        <h1>Token i Pavlefshëm</h1>
                        <p>Token-i i verifikimit është i pavlefshëm ose mungon. Ju lutem përdorni linkun e dërguar në email-in tuaj.</p>
                        <a href="/" class="button">Kthehu në Faqen Kryesore</a>
                    </div>
                </body>
                </html>
            `);
        }

        // Gjej përdoruesin me token
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
            return res.status(400).send(`
                <!DOCTYPE html>
                <html lang="sq">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Token i Skaduar - ChatAI ALBA</title>
                    <style>
                        body { 
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh;
                        }
                        .container { 
                            background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
                            text-align: center; max-width: 500px; width: 90%;
                        }
                        .warning-icon { font-size: 64px; color: #ed8936; margin-bottom: 20px; }
                        h1 { color: #ed8936; margin-bottom: 15px; }
                        p { color: #4a5568; margin-bottom: 25px; line-height: 1.6; }
                        .button { 
                            background: #667eea; color: white; padding: 12px 24px; text-decoration: none; 
                            border-radius: 8px; display: inline-block; font-weight: bold; transition: transform 0.2s;
                        }
                        .button:hover { transform: translateY(-2px); }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="warning-icon">⚠️</div>
                        <h1>Token i Skaduar</h1>
                        <p>Token-i i verifikimit ka skaduar ose është i pavlefshëm. Ju lutem kërkoni një email të ri verifikimi.</p>
                        <a href="/" class="button">Kthehu në Faqen Kryesore</a>
                    </div>
                </body>
                </html>
            `);
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

        console.log('✅ Email u verifikua për përdoruesin:', user.username);

        res.send(`
            <!DOCTYPE html>
            <html lang="sq">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email i Verifikuar - ChatAI ALBA</title>
                <style>
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh;
                    }
                    .container { 
                        background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
                        text-align: center; max-width: 500px; width: 90%;
                    }
                    .success-icon { font-size: 64px; color: #38a169; margin-bottom: 20px; }
                    h1 { color: #38a169; margin-bottom: 15px; }
                    p { color: #4a5568; margin-bottom: 25px; line-height: 1.6; }
                    .button { 
                        background: #667eea; color: white; padding: 12px 24px; text-decoration: none; 
                        border-radius: 8px; display: inline-block; font-weight: bold; transition: transform 0.2s;
                        margin: 5px;
                    }
                    .button:hover { transform: translateY(-2px); }
                    .button-secondary { 
                        background: #e2e8f0; color: #4a5568; padding: 12px 24px; text-decoration: none; 
                        border-radius: 8px; display: inline-block; font-weight: bold; transition: transform 0.2s;
                        margin: 5px;
                    }
                    .button-secondary:hover { background: #cbd5e0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success-icon">✅</div>
                    <h1>Email i Verifikuar!</h1>
                    <p><strong>Urime!</strong> Llogaria juaj është aktivizuar me sukses. Tani mund të hyni në ChatAI ALBA dhe të përfitoni nga të gjitha veçoritë e platformës.</p>
                    <div style="margin-top: 30px;">
                        <a href="/" class="button">Shko në Faqen Kryesore</a>
                        <a href="/" class="button-secondary">Hyr në Llogari</a>
                    </div>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('❌ Gabim në verifikim:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html lang="sq">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Gabim në Verifikim - ChatAI ALBA</title>
                <style>
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh;
                    }
                    .container { 
                        background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
                        text-align: center; max-width: 500px; width: 90%;
                    }
                    .error-icon { font-size: 64px; color: #e53e3e; margin-bottom: 20px; }
                    h1 { color: #e53e3e; margin-bottom: 15px; }
                    p { color: #4a5568; margin-bottom: 25px; line-height: 1.6; }
                    .button { 
                        background: #667eea; color: white; padding: 12px 24px; text-decoration: none; 
                        border-radius: 8px; display: inline-block; font-weight: bold; transition: transform 0.2s;
                    }
                    .button:hover { transform: translateY(-2px); }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="error-icon">❌</div>
                    <h1>Gabim në Verifikim</h1>
                    <p>Ndodhi një gabim në verifikimin e email-it. Ju lutem provoni përsëri ose kontaktoni support.</p>
                    <a href="/" class="button">Kthehu në Faqen Kryesore</a>
                </div>
            </body>
            </html>
        `);
    }
});

// ✅ 3. RIDËRGIM EMAIL-I
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        console.log('📥 Request ridërgimi për:', email);

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email-i është i detyrueshëm' 
            });
        }

        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email-i nuk u gjet në sistem' 
            });
        }

        if (user.is_verified) {
            return res.json({ 
                success: true, 
                message: 'Email-i është tashmë i verifikuar!' 
            });
        }

        // Gjenero token të ri
        const newToken = crypto.randomBytes(32).toString('hex');
        const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
                [newToken, newExpires, user.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        // ✅ DËRGO EMAIL ME SHËRBIMIN E VËRTETË
        console.log('🔄 Duke ridërguar email verifikimi...');
        const emailSent = await EmailService.sendVerificationEmail(email, newToken);

        if (emailSent) {
            console.log('✅ Email ridërgimi u dërgua me sukses për:', email);
            res.json({ 
                success: true, 
                message: 'Email-i i verifikimit u dërgua përsëri! Kontrollo email-in tuaj.' 
            });
        } else {
            console.log('⚠️ Email ridërgimi dështoi për:', email);
            res.status(500).json({ 
                success: false, 
                message: 'Dërgimi i email-it dështoi. Provo përsëri më vonë.' 
            });
        }

    } catch (error) {
        console.error('❌ Gabim në ridërgim:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gabim i brendshëm i serverit' 
        });
    }
});

// ✅ 4. KONTROLLO STATUSIN E VERIFIKIMIT
router.get('/verification-status/:email', async (req, res) => {
    try {
        const { email } = req.params;

        const user = await new Promise((resolve, reject) => {
            db.get('SELECT is_verified FROM users WHERE email = ?', [email], (err, row) => {
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

        res.json({
            success: true,
            is_verified: user.is_verified
        });

    } catch (error) {
        console.error('❌ Gabim në kontrollimin e statusit:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gabim i brendshëm i serverit' 
        });
    }
});

module.exports = router;
