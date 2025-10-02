// verification.js - VERSION I RREGULLUAR PËR SISTEMIN E VJETËR
console.log('✅ verification.js u ngarkua!');

async function verifyEmail() {
    console.log('🎯 BUTONI I VERIFIKIMIT U KLIKUA!');
    
    try {
        // DEBUG: Kontrollo nëse jemi në session
        console.log('🔍 DEBUG: Duke kontrolluar session-in...');
        
        // Përdor fetch pa token - serveri do të përdorë session cookie
        const userResponse = await fetch('/api/auth/me');
        
        console.log('📡 Statusi i përgjigjes së përdoruesit:', userResponse.status);
        
        if (!userResponse.ok) {
            if (userResponse.status === 401) {
                alert('❌ Ju nuk jeni i loguar! Hyni përsëri në sistem.');
            } else {
                alert('❌ Problem me serverin. Status: ' + userResponse.status);
            }
            return;
        }

        const userData = await userResponse.json();
        console.log('👤 Të dhënat e përdoruesit:', userData);

        if (!userData.email) {
            alert('❌ Nuk u gjet email për përdoruesin!');
            return;
        }

        // Dërgo kërkesën për verifikim PA token
        console.log('📧 Duke dërguar email verifikimi për:', userData.email);
        
        const response = await fetch('/api/auth/resend-verification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // NUK ka header Authorization - përdor session cookie
            },
            body: JSON.stringify({
                email: userData.email
            })
        });

        const result = await response.json();
        console.log('📨 Përgjigja e plotë nga serveri:', result);

        if (result.success) {
            alert('✅ ' + result.message + '\n\nShiko konsolën e serverit (Render.com logs) për linkun e verifikimit!');
        } else {
            alert('❌ ' + result.message);
        }

    } catch (error) {
        console.error('❌ Gabim i papritur:', error);
        alert('❌ Gabim i papritur: ' + error.message);
    }
}

// Kontrollo nëse përdoruesi është i loguar
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const userData = await response.json();
            console.log('🔐 Përdoruesi i loguar:', userData.username);
            return true;
        }
        return false;
    } catch (error) {
        console.log('🔐 Përdoruesi nuk është i loguar');
        return false;
    }
}

// Inicializimi
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 verification.js u inicializua!');
    
    // Kontrollo statusin e login-it
    checkLoginStatus().then(isLoggedIn => {
        console.log('🔐 Gjendja e login-it në inicializim:', isLoggedIn ? 'I LOGUAR' : 'I PALOGUAR');
    });
});
