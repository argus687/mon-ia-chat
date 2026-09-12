let messagesHistory = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    const savedKey = localStorage.getItem('groq_api_key');
    if (savedKey) {
        document.getElementById('apiKeyInput').value = savedKey;
        document.getElementById('keyStatus').style.display = 'block';
    }

    const storedUser = localStorage.getItem('argus_user');
    if (storedUser) {
        currentUser = storedUser;
        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('userNameDisplay').textContent = `👤 ${currentUser}`;
    }

    document.getElementById('loginButton').addEventListener('click', handleLogin);
    document.getElementById('registerButton').addEventListener('click', handleRegister);
    document.getElementById('showRegisterButton').addEventListener('click', () => toggleAuth(true));
    document.getElementById('showLoginButton').addEventListener('click', () => toggleAuth(false));
    
    document.getElementById('settingsButton').addEventListener('click', () => {
        document.getElementById('settingsScreen').classList.remove('hidden');
    });
    document.getElementById('closeSettingsButton').addEventListener('click', () => {
        document.getElementById('settingsScreen').classList.add('hidden');
    });
    document.getElementById('logoutButton').addEventListener('click', handleLogout);

    document.getElementById('sendButton').addEventListener('click', onSendMessage);
    document.getElementById('messageInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSendMessage();
        }
    });

    document.getElementById('newChatButton').addEventListener('click', () => {
        messagesHistory = [];
        document.getElementById('messages').innerHTML = `
            <div id="welcome">
                <div class="big-wave">〰</div>
                <h1>Bonjour, je suis ARGUS.</h1>
                <p>Posez-moi une question, demandez l'heure, la météo ou une ville (ex: "Où est Nice ?").</p>
            </div>
        `;
    });
});

function toggleAuth(showRegister) {
    document.getElementById('loginForm').classList.toggle('hidden', showRegister);
    document.getElementById('registerForm').classList.toggle('hidden', !showRegister);
}

function handleLogin() {
    const user = document.getElementById('loginUsername').value.trim();
    if (!user) return alert("Veuillez entrer un nom d'utilisateur.");
    currentUser = user;
    localStorage.setItem('argus_user', user);
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('userNameDisplay').textContent = `👤 ${currentUser}`;
}

function handleRegister() {
    const user = document.getElementById('registerUsername').value.trim();
    if (!user) return alert("Veuillez entrer un nom d'utilisateur.");
    currentUser = user;
    localStorage.setItem('argus_user', user);
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('userNameDisplay').textContent = `👤 ${currentUser}`;
}

function handleLogout() {
    localStorage.removeItem('argus_user');
    currentUser = null;
    document.getElementById('authScreen').classList.remove('hidden');
}

async function onSendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;

    const welcome = document.getElementById('welcome');
    if (welcome) welcome.style.display = 'none';

    appendMessageToChat('user', text);
    input.value = '';

    messagesHistory.push({ role: "user", content: text });

    const loadingId = appendMessageToChat('ai', 'Réflexion en cours...');
    const reply = await handleUserMessage(text, messagesHistory);

    const bubble = document.getElementById(loadingId);
    bubble.innerHTML = reply;
    messagesHistory.push({ role: "assistant", content: reply });
}

function appendMessageToChat(sender, content) {
    const messagesDiv = document.getElementById('messages');
    const messageId = 'msg-' + Date.now();
    
    const div = document.createElement('div');
    div.className = `message-bubble message-${sender}`;
    div.id = messageId;
    div.innerHTML = content;
    
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return messageId;
}

async function handleUserMessage(promptText, history) {
    const textLower = promptText.toLowerCase();

    if (textLower.includes("heure") || textLower.includes("quelle heure")) {
        const now = new Date();
        return `Il est actuellement **${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}**.`;
    }

    if (textLower.includes("où est") || textLower.includes("carte de") || textLower.includes("situe")) {
        let location = "Paris";
        let lat = "48.8566", lon = "2.3522";

        if (textLower.includes("nice")) {
            location = "Nice";
            lat = "43.7102"; lon = "7.2620";
        } else if (textLower.includes("marseille")) {
            location = "Marseille";
            lat = "43.2965"; lon = "5.3698";
        } else if (textLower.includes("lyon")) {
            location = "Lyon";
            lat = "45.7640"; lon = "4.8357";
        }

        return `Voici la localisation de **${location}** :<br>
        <iframe class="map-embed" src="https://www.openstreetmap.org/export/embed.html?bbox=${Number(lon)-0.05},${Number(lat)-0.05},${Number(lon)+0.05},${Number(lat)+0.05}&layer=mapnik&marker=${lat},${lon}"></iframe>`;
    }

    if (textLower.includes("meteo") || textLower.includes("météo")) {
        try {
            let lat = 43.7102, lon = 7.2620, cityName = "Nice";
            if (textLower.includes("paris")) { lat = 48.85; lon = 2.35; cityName = "Paris"; }

            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            const weatherData = await weatherRes.json();
            
            if (weatherData && weatherData.current_weather) {
                const temp = weatherData.current_weather.temperature;
                const wind = weatherData.current_weather.windspeed;
                return `<div class="weather-card">
                    🌤️ **Météo en direct pour ${cityName}**<br>
                    - Température : <b>${temp}°C</b><br>
                    - Vent : ${wind} km/h
                </div>`;
            }
        } catch (e) {
            console.error("Erreur météo", e);
        }
    }

    const apiKey = localStorage.getItem('groq_api_key');
    if (!apiKey) {
        document.getElementById('settingsScreen').classList.remove('hidden');
        return "⚠️ Veuillez renseigner votre clé API Groq dans les Paramètres (⚙️).";
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-120b',
                messages: history
            })
        });

        const data = await response.json();
        if (data.error) return "Erreur Groq : " + data.error.message;
        return data.choices[0].message.content;
    } catch (err) {
        return "Erreur de connexion aux serveurs de l'IA.";
    }
}
