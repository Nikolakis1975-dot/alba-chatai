const express = require('express');
const db = require('../database');
const encryption = require('../utils/encryption');
const jwt = require('jsonwebtoken');
const router = express.Router();

// ✅ MIDDLEWARE PËR AUTHENTICATION ME HTTP-ONLY COOKIE
const authenticateToken = async (req, res, next) => {
    try {
        const token = req.cookies.auth_token;
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Nuk jeni i loguar' 
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_2024');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Session i pavlefshëm' 
        });
    }
};

// ✅ 1. RUAJ API KEY (ENDPOINT I RI)
router.post('/save', authenticateToken, async (req, res) => {
    try {
        const { apiKey, serviceName = 'gemini' } = req.body;
        const userId = req.user.userId;

        if (!apiKey) {
            return res.status(400).json({ 
                success: false, 
                message: 'API Key është i zbrazët' 
            });
        }

        console.log(`📥 Ruajtje API Key për user ${userId}, shërbim: ${serviceName}`);

        // Enkripto API Key
        const encryptedApiKey = encryption.encrypt(apiKey);

        // Kontrollo nëse ekziston duke përdorur Promise
        new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM api_keys WHERE user_id = ? AND service_name = ?',
                [userId, serviceName],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        })
        .then(row => {
            if (row) {
                // UPDATE ekzistues
                db.run(
                    'UPDATE api_keys SET api_key = ? WHERE user_id = ? AND service_name = ?',
                    [encryptedApiKey, userId, serviceName],
                    function(err) {
                        if (err) {
                            console.error('❌ Gabim gjatë update:', err);
                            return res.status(500).json({ 
                                success: false, 
                                message: 'Gabim gjatë përditësimit të API Key' 
                            });
                        }
                        res.json({ 
                            success: true,
                            message: '✅ API Key u përditësua me sukses!' 
                        });
                    }
                );
            } else {
                // INSERT i ri
                db.run(
                    'INSERT INTO api_keys (user_id, api_key, service_name) VALUES (?, ?, ?)',
                    [userId, encryptedApiKey, serviceName],
                    function(err) {
                        if (err) {
                            console.error('❌ Gabim gjatë insert:', err);
                            return res.status(500).json({ 
                                success: false, 
                                message: 'Gabim gjatë ruajtjes së API Key' 
                            });
                        }
                        res.json({ 
                            success: true,
                            message: '✅ API Key u ruajt me sukses!' 
                        });
                    }
                );
            }
        })
        .catch(err => {
            console.error('❌ Gabim në database:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Gabim në server' 
            });
        });

    } catch (error) {
        console.error('❌ Gabim gjatë enkriptimit:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gabim në server gjatë enkriptimit' 
        });
    }
});

// ✅ 2. FSHI API KEY (ENDPOINT I RI)
router.delete('/delete', authenticateToken, async (req, res) => {
    try {
        const { serviceName = 'gemini' } = req.body;
        const userId = req.user.userId;

        console.log(`🗑️ Fshirje API Key për user ${userId}, shërbim: ${serviceName}`);

        db.run(
            'DELETE FROM api_keys WHERE user_id = ? AND service_name = ?',
            [userId, serviceName],
            function(err) {
                if (err) {
                    console.error('❌ Gabim gjatë fshirjes:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Gabim gjatë fshirjes së API Key' 
                    });
                }
                res.json({ 
                    success: true,
                    message: '✅ API Key u fshi me sukses!' 
                });
            }
        );
    } catch (error) {
        console.error('❌ Gabim në fshirje:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gabim i brendshëm i serverit' 
        });
    }
});

// ✅ 3. STATUS I API KEY (ENDPOINT I RI) - ME AUTHENTICATION
router.get('/status/:serviceName', authenticateToken, async (req, res) => {
    try {
        const { serviceName } = req.params;
        const userId = req.user.userId;

        console.log(`🔍 Kontrollo status API Key për user ${userId}, shërbim: ${serviceName}`);

        db.get(
            'SELECT id, created_at FROM api_keys WHERE user_id = ? AND service_name = ?',
            [userId, serviceName],
            (err, row) => {
                if (err) {
                    console.error('❌ Gabim në database:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Gabim në server' 
                    });
                }

                console.log(`📊 Rezultati i kërkimit:`, row);

                if (row) {
                    res.json({ 
                        success: true,
                        hasApiKey: true, 
                        createdAt: row.created_at 
                    });
                } else {
                    res.json({ 
                        success: true,
                        hasApiKey: false 
                    });
                }
            }
        );
    } catch (error) {
        console.error('❌ Gabim në status check:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gabim i brendshëm i serverit' 
        });
    }
});

// ✅ 4. MER API KEY (ENDPOINT I RI)
router.get('/get/:serviceName', authenticateToken, async (req, res) => {
    try {
        const { serviceName } = req.params;
        const userId = req.user.userId;

        console.log(`📥 Kërkesë për API Key: ${serviceName}, user: ${userId}`);

        db.get(
            'SELECT api_key FROM api_keys WHERE user_id = ? AND service_name = ?',
            [userId, serviceName],
            (err, row) => {
                if (err) {
                    console.error('❌ Gabim në database:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Gabim në server' 
                    });
                }

                if (row && row.api_key) {
                    try {
                        // Dekripto API Key
                        const decryptedApiKey = encryption.decrypt(row.api_key);
                        console.log(`✅ API Key u gjet dhe u dekriptua për user ${userId}`);
                        
                        res.json({ 
                            success: true, 
                            apiKey: decryptedApiKey 
                        });
                    } catch (decryptError) {
                        console.error('❌ Gabim në dekriptim:', decryptError);
                        res.json({ 
                            success: false, 
                            message: 'Gabim në dekriptimin e API Key' 
                        });
                    }
                } else {
                    console.log(`❌ Nuk u gjet API Key për user ${userId}`);
                    res.json({ 
                        success: false, 
                        message: 'Nuk u gjet API Key për këtë shërbim' 
                    });
                }
            }
        );
    } catch (error) {
        console.error('❌ Gabim në marrjen e API Key:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gabim i brendshëm i serverit' 
        });
    }
});

// ✅ 5. ENDPOINT-ET E VJETRA PËR KOMPATIBILITET
router.post('/save-old', async (req, res) => {
    try {
        const { userId, apiKey, serviceName } = req.body;

        if (!userId || !apiKey) {
            return res.status(400).json({ 
                success: false,
                message: 'Të dhëna të pamjaftueshme' 
            });
        }

        const encryptedApiKey = encryption.encrypt(apiKey);

        db.get(
            'SELECT id FROM api_keys WHERE user_id = ? AND service_name = ?',
            [userId, serviceName || 'gemini'],
            (err, row) => {
                if (err) {
                    return res.status(500).json({ 
                        success: false,
                        message: 'Gabim në server' 
                    });
                }

                if (row) {
                    // Update ekzistues
                    db.run(
                        'UPDATE api_keys SET api_key = ? WHERE user_id = ? AND service_name = ?',
                        [encryptedApiKey, userId, serviceName || 'gemini'],
                        function(err) {
                            if (err) {
                                console.error('❌ Gabim gjatë update:', err);
                                return res.status(500).json({ 
                                    success: false, 
                                    message: 'Gabim gjatë përditësimit të API Key' 
                                });
                            }
                            res.json({ 
                                success: true,
                                message: '✅ API Key u përditësua me sukses!' 
                            });
                        }
                    );
                } else {
                    // Krijo të ri
                    db.run(
                        'INSERT INTO api_keys (user_id, api_key, service_name) VALUES (?, ?, ?)',
                        [userId, encryptedApiKey, serviceName || 'gemini'],
                        function(err) {
                            if (err) {
                                console.error('❌ Gabim gjatë insert:', err);
                                return res.status(500).json({ 
                                    success: false, 
                                    message: 'Gabim gjatë ruajtjes së API Key' 
                                });
                            }
                            res.json({ 
                                success: true,
                                message: '✅ API Key u ruajt me sukses!' 
                            });
                        }
                    );
                }
            }
        );
    } catch (error) {
        console.error('❌ Gabim në save-old:', error);
        res.status(500).json({ 
            success: false,
            message: 'Gabim në server gjatë enkriptimit' 
        });
    }
});

// ✅ 6. STATUS I VJETËR PËR KOMPATIBILITET
router.get('/status-old/:userId/:serviceName?', (req, res) => {
    const { userId, serviceName } = req.params;

    db.get(
        'SELECT id, created_at FROM api_keys WHERE user_id = ? AND service_name = ?',
        [userId, serviceName || 'gemini'],
        (err, row) => {
            if (err) {
                console.error('❌ Gabim në database:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Gabim në server' 
                });
            }

            if (row) {
                res.json({ 
                    success: true,
                    hasApiKey: true, 
                    createdAt: row.created_at 
                });
            } else {
                res.json({ 
                    success: true,
                    hasApiKey: false 
                });
            }
        }
    );
});

module.exports = router;
