const crypto = require('crypto');
const express = require('express');
const db = require('../database');
const router = express.Router();

// Përditëso foton e profilit
router.post('/profile-picture', (req, res) => {
    const { userId, profile_picture } = req.body;

    if (!userId || !profile_picture) {
        return res.status(400).json({ error: 'Të dhëna të pamjaftueshme' });
    }

    db.run(
        'UPDATE users SET profile_picture = ? WHERE id = ?',
        [profile_picture, userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Gabim gjatë përditësimit të fotos' });
            }

            res.json({ message: 'Foto u përditësua me sukses' });
        }
    );
});

// Merr foton e profilit
router.get('/profile-picture/:userId', (req, res) => {
    const { userId } = req.params;

    db.get(
        'SELECT profile_picture FROM users WHERE id = ?',
        [userId],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Gabim gjatë marrjes së fotos' });
            }

            if (row) {
                res.json({ profile_picture: row.profile_picture });
            } else {
                res.status(404).json({ error: 'Përdoruesi nuk u gjet' });
            }
        }
    );
});

module.exports = router;
