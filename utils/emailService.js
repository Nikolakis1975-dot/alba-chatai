const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
    static transporter = null;

    // ✅ INICIALIZO TRANSPORTER-IN
    static initializeTransporter() {
        if (this.transporter) return;

        try {
            // ✅ KONFIGURIMI I TRANSPORTER-IT
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                secure: false, // true për port 465, false për portet e tjera
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            console.log('✅ Transporter i email-it u inicializua');
        } catch (error) {
            console.error('❌ Gabim në inicializimin e transporter-it:', error);
        }
    }

    // ✅ VERIFIKO KONFIGURIMIN E EMAIL-IT
    static async verifyConfiguration() {
        if (!this.transporter) {
            this.initializeTransporter();
        }

        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.error('❌ Variablat e mjedisit SMTP_USER/SMTP_PASS nuk janë konfiguruar!');
            return false;
        }

        try {
            await this.transporter.verify();
            console.log('✅ Serveri i email-it është gati për dërgim mesazhesh');
            return true;
        } catch (error) {
            console.error('❌ Gabim në verifikimin e serverit të email-it:', error);
            return false;
        }
    }

    // ✅ DËRGO EMAIL VERIFIKIMI
    static async sendVerificationEmail(userEmail, verificationToken) {
        try {
            // Verifiko konfigurimin
            const isConfigured = await this.verifyConfiguration();
            if (!isConfigured) {
                throw new Error('Serveri i email-it nuk është i konfiguruar siç duhet');
            }

            const verificationLink = `${process.env.SITE_URL || 'http://localhost:3000'}/api/email/verify-email?token=${verificationToken}`;
            
            // ✅ TEMPLATE I BUKUR I EMAIL-IT
            const emailTemplate = `
<!DOCTYPE html>
<html lang="sq">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifikoni Email-in - ChatAI ALBA</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        
        .email-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        
        .email-header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .email-header .logo {
            font-size: 48px;
            margin-bottom: 15px;
        }
        
        .email-content {
            padding: 40px 30px;
            background: #f8f9fa;
        }
        
        .welcome-text {
            font-size: 18px;
            margin-bottom: 20px;
            color: #2d3748;
        }
        
        .verification-box {
            background: white;
            border-radius: 10px;
            padding: 25px;
            margin: 25px 0;
            border-left: 4px solid #667eea;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .verification-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.3s, box-shadow 0.3s;
        }
        
        .verification-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }
        
        .verification-link {
            word-break: break-all;
            background: #f1f3f4;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            border: 1px dashed #667eea;
        }
        
        .info-section {
            background: #e8f4fd;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #4299e1;
        }
        
        .info-section h3 {
            color: #2b6cb0;
            margin-bottom: 10px;
        }
        
        .email-footer {
            background: #2d3748;
            color: white;
            padding: 25px;
            text-align: center;
            border-radius: 0 0 15px 15px;
        }
        
        .footer-links {
            margin: 15px 0;
        }
        
        .footer-links a {
            color: #a0aec0;
            text-decoration: none;
            margin: 0 10px;
        }
        
        .footer-links a:hover {
            color: white;
        }
        
        .expiry-notice {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
            color: #856404;
        }
        
        @media (max-width: 600px) {
            .email-content {
                padding: 20px 15px;
            }
            
            .verification-button {
                display: block;
                text-align: center;
                margin: 20px auto;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">🤖</div>
            <h1>ChatAI ALBA</h1>
            <p>Platforma inteligjente e bisedave</p>
        </div>
        
        <div class="email-content">
            <p class="welcome-text"><strong>Përshëndetje!</strong></p>
            
            <p>Faleminderit që u regjistruat në <strong>ChatAI ALBA</strong>. Jemi të ngazëllyer që jeni pjesë e komunitetit tonë!</p>
            
            <div class="verification-box">
                <h2 style="color: #667eea; margin-bottom: 15px;">✅ Verifikoni Email-in tuaj</h2>
                <p>Për të aktivizuar llogarinë tuaj dhe të përfitoni nga të gjitha veçoritë, ju lutem verifikoni adresën tuaj të email-it duke klikuar butonin më poshtë:</p>
                
                <div style="text-align: center; margin: 25px 0;">
                    <a href="${verificationLink}" class="verification-button">
                        📧 Verifiko Email-in
                    </a>
                </div>
                
                <p><strong>Nëse butoni nuk funksionon</strong>, kopjojeni dhe ngjisni linkun e mëposhtëm në shfletuesin tuaj:</p>
                
                <div class="verification-link">
                    ${verificationLink}
                </div>
            </div>
            
            <div class="expiry-notice">
                ⏰ <strong>Kujdes:</strong> Ky link verifikimi do të skadojë pas <strong>24 orësh</strong>.
            </div>
            
            <div class="info-section">
                <h3>📋 Çfarë mund të bëni pas verifikimit?</h3>
                <ul style="margin-left: 20px; margin-top: 10px;">
                    <li>Bisedoni me asistentin inteligjent</li>
                    <li>Menaxhoni API keys tuaja</li>
                    <li>Ruani historinë e bisedave</li>
                    <li>Përdorni të gjitha veçoritë e platformës</li>
                </ul>
            </div>
            
            <p style="margin-top: 25px;">Nëse keni ndonjë pyetje ose keni nevojë për ndihmë, mos hezitoni të na kontaktoni.</p>
            
            <p style="margin-top: 20px;">Me respekt,<br><strong>Ekipi i ChatAI ALBA</strong></p>
        </div>
        
        <div class="email-footer">
            <p>&copy; 2024 ChatAI ALBA. Të gjitha të drejtat e rezervuara.</p>
            <div class="footer-links">
                <a href="${process.env.SITE_URL || 'http://localhost:3000'}">Faqja Kryesore</a>
                <a href="${process.env.SITE_URL || 'http://localhost:3000'}/privacy">Privatësia</a>
                <a href="${process.env.SITE_URL || 'http://localhost:3000'}/support">Ndihma</a>
            </div>
            <p style="color: #a0aec0; font-size: 12px; margin-top: 15px;">
                Ky email është dërguar automatikisht. Ju lutem mos i përgjigjeni.
            </p>
        </div>
    </div>
</body>
</html>
            `;

            const mailOptions = {
                from: `"ChatAI ALBA" <${process.env.SMTP_USER}>`,
                to: userEmail,
                subject: '📧 Verifikoni Email-in tuaj - ChatAI ALBA',
                html: emailTemplate,
                text: `Përshëndetje!\n\nFaleminderit që u regjistruat në ChatAI ALBA. Për të verifikuar email-in tuaj, ju lutem përdorni këtë link:\n\n${verificationLink}\n\nKy link do të skadojë pas 24 orësh.\n\nMe respekt,\nEkipi i ChatAI ALBA`
            };

            // ✅ DËRGO EMAIL-IN REAL
            const result = await this.transporter.sendMail(mailOptions);
            
            console.log('✅ EMAIL I DËRGUAR ME SUKSES:');
            console.log(`   📨 Për: ${userEmail}`);
            console.log(`   📧 Nga: ${process.env.SMTP_USER}`);
            console.log(`   🆔 Message ID: ${result.messageId}`);
            console.log(`   🔗 Linku: ${verificationLink}`);
            
            return true;

        } catch (error) {
            console.error('❌ GABIM NË DËRGIMIN E EMAIL-IT:', error);
            
            // ✅ FALLBACK: Shfaq informacionin në console për testim
            const verificationLink = `${process.env.SITE_URL || 'http://localhost:3000'}/api/email/verify-email?token=${verificationToken}`;
            console.log('\n📧 ===== EMAIL VERIFIKIMI (FALLBACK MODE) =====');
            console.log(`📨 Për: ${userEmail}`);
            console.log(`🔗 Linku i verifikimit: ${verificationLink}`);
            console.log(`🔐 Token: ${verificationToken}`);
            console.log('💡 KOPJOJE KËTË LINK NË SHFRETUES PËR VERIFIKIM!');
            console.log('📧 ========================================\n');
            
            return false;
        }
    }

    // ✅ DËRGO EMAIL PËR RIDËRGIM
    static async sendPasswordResetEmail(userEmail, resetToken) {
        // Mund të shtohet në të ardhmen
        console.log('📧 Email reset i fjalëkalimit për:', userEmail);
        return true;
    }
}

// ✅ INICIALIZO AUTOMATIKISHT
EmailService.initializeTransporter();

module.exports = EmailService;
