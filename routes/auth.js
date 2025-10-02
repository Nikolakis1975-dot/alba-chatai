const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const router = express.Router();

// Regjistrimi i përdoruesit të ri
router.post('/register', async (req, res) => {
    const { username, password, profile_picture } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Emri i përdoruesit dhe fjalëkalimi janë të detyrueshëm' });
    }

    if (username.length < 3) {
        return res.status(400).json({ error: 'Emri i përdoruesit duhet të ketë të paktën 3 karaktere' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere' });
    }

    try {
        // Kontrollo nëse përdoruesi ekziston
        db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Gabim në server' });
            }

            if (row) {
                return res.status(400).json({ error: 'Përdoruesi ekziston tashmë' });
            }

            // Hasho fjalëkalimin
            const hashedPassword = await bcrypt.hash(password, 12);

            // Ruaj përdoruesin e ri në databazë
            db.run(
                'INSERT INTO users (username, password, profile_picture) VALUES (?, ?, ?)',
                [username, hashedPassword, profile_picture || null],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Gabim gjatë regjistrimit' });
                    }

                    // Kthe përgjigje me të dhënat e përdoruesit (pa fjalëkalim)
                    res.status(201).json({ 
                        message: 'Përdoruesi u regjistrua me sukses',
                        user: {
                            id: this.lastID,
                            username: username,
                            profile_picture: profile_picture || null
                        }
                    });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: 'Gabim në server' });
    }
});

// Login i përdoruesit
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Emri i përdoruesit dhe fjalëkalimi janë të detyrueshëm' });
    }

    // Gjej përdoruesin në databazë
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Gabim në server' });
        }

        if (!user) {
            return res.status(400).json({ error: 'Përdoruesi ose fjalëkalimi janë gabim' });
        }

        // Krahaso fjalëkalimin e hash-uar
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ error: 'Përdoruesi ose fjalëkalimi janë gabim' });
        }

        // Përgjigju me të dhënat e përdoruesit (pa fjalëkalim)
        res.json({
            message: 'Login i suksesshëm',
            user: {
                id: user.id,
                username: user.username,
                profile_picture: user.profile_picture
            }
        });
    });
});

// Kontrollo sesionin aktual (implementim i thjeshtë për demonstrim)
router.get('/check-session', (req, res) => {
    // NË PRACTICË: Kjo duhet të përdorë cookies ose JWT për menaxhimin e sesioneve
    // Për demonstrim, kthejmë null - në praktikë do të kontrolloje session/cookie
    // Ky është një shembull i thjeshtë, në prodhim duhet përdorur një sistem i plotë sesionesh
    res.json({ user: null });
});

// Logout
router.post('/logout', (req, res) => {
    // NË PRACTICË: Kjo duhet të fshijë session/cookie
    // Ky është një shembull i thjeshtë, në prodhim duhet përdorur një sistem i plotë sesionesh
    res.json({ message: 'Logged out successfully' });
});

// Fshi llogarinë e përdoruesit
router.delete('/delete-account/:userId', (req, res) => {
    const { userId } = req.params;

    // Fillimisht fshi të gjitha të dhënat e lidhura me përdoruesin
    db.serialize(() => {
        // Fshi mesazhet
        db.run('DELETE FROM messages WHERE user_id = ?', [userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Gabim gjatë fshirjes së mesazheve' });
            }
        });

        // Fshi njohuritë
        db.run('DELETE FROM knowledge_base WHERE user_id = ?', [userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Gabim gjatë fshirjes së njohurive' });
            }
        });

        // Fshi API keys
        db.run('DELETE FROM api_keys WHERE user_id = ?', [userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Gabim gjatë fshirjes së API keys' });
            }
        });

        // Fshi feedback
        db.run('DELETE FROM feedback WHERE user_id = ?', [userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Gabim gjatë fshirjes së feedback' });
            }
        });

        // Më në fund fshi përdoruesin
        db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Gabim gjatë fshirjes së llogarisë' });
            }

            res.json({ message: 'Llogaria u fshi me sukses' });
        });
    });
});

// Ndrysho fjalëkalimin
router.post('/change-password', async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Të dhëna të pamjaftueshme' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Fjalëkalimi i ri duhet të ketë të paktën 6 karaktere' });
    }

    try {
        // Gjej përdoruesin dhe verifiko fjalëkalimin aktual
        db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Gabim në server' });
            }

            if (!user) {
                return res.status(404).json({ error: 'Përdoruesi nuk u gjet' });
            }

            // Krahaso fjalëkalimin aktual
            const isMatch = await bcrypt.compare(currentPassword, user.password);

            if (!isMatch) {
                return res.status(400).json({ error: 'Fjalëkalimi aktual është gabim' });
            }

            // Hasho fjalëkalimin e ri
            const hashedNewPassword = await bcrypt.hash(newPassword, 12);

            // Përditëso fjalëkalimin
            db.run(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedNewPassword, userId],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Gabim gjatë ndryshimit të fjalëkalimit' });
                    }

                    res.json({ message: 'Fjalëkalimi u ndryshua me sukses' });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: 'Gabim në server' });
    }
});

// Merr të dhënat e përdoruesit
router.get('/user/:userId', (req, res) => {
    const { userId } = req.params;

    db.get(
        'SELECT id, username, profile_picture, created_at FROM users WHERE id = ?',
        [userId],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Gabim në server' });
            }

            if (row) {
                res.json({ user: row });
            } else {
                res.status(404).json({ error: 'Përdoruesi nuk u gjet' });
            }
        }
    );
});

module.exports = router;
