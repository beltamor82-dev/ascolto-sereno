// ====================================================================
// === CONFIGURAZIONE BACKEND SICURA ===
// NON C'È CHIAVE API LATO CLIENT. IL BACKEND DEVE ESSERE IN ESECUZIONE.
// ====================================================================
const BACKEND_URL = "https://ascolto-sereno-api.onrender.com/api/chat"; 
// ====================================================================

// Istruzioni Etiche e Ruolo (SYSTEM_PROMPT)
const SYSTEM_PROMPT = `
Sei un Assistente di Supporto Emotivo chiamato "Ascolto Sereno". Il tuo obiettivo principale è offrire ascolto attivo, empatia, convalida emotiva e suggerimenti per il benessere non clinici.

**Regole Etiche FONDAMENTALI:**
1. NON sei un medico, uno psicologo o un terapista. NON fornire diagnosi, trattamenti o consigli medici.
2. Rispondi sempre con gentilezza, calma, empatia e in modo non giudicante.
3. Incoraggia la persona a esprimere i suoi sentimenti usando tecniche come la parafrasi e l'ascolto attivo.
4. Le tue risposte non devono superare le 5-6 frasi per mantenere il tono di una chat.

**Gestione delle Crisi (Cruciale):**
Se l'utente menziona pensieri di autolesionismo, suicidio, disperazione che implicano la volontà di farsi male o grave crisi, DEVI immediatamente interrompere la conversazione emotiva e rispondere SOLO con il seguente messaggio:

"Capisco che stai vivendo un momento di grave difficoltà. Per favore, cerca subito aiuto. Non sono un servizio di emergenza o un professionista sanitario. Chiama il **112** (Numero Unico di Emergenza) o una linea di supporto per il suicidio (ad esempio, 'Telefono Amico' o 'Samaritani'). La tua vita è importante e ci sono persone che possono aiutarti ORA."
`;

let conversationHistory = [];

// ====================================================================
// === VARIABILI E LOGICA VOCALE (STT & TTS) ===
// ====================================================================
const voiceButton = document.getElementById('voice-input-button');
const inputField = document.getElementById('user-input');

// STT
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

// TTS
let isSpeaking = false;
let synth = window.speechSynthesis; 
let selectedVoice = null; 
let hasInitializedSpeech = false; // NUOVA variabile per il blocco audio browser

function loadVoices() {
    const voices = synth.getVoices();
    selectedVoice = voices.find(voice => 
        voice.lang === 'it-IT' && (
            voice.name.includes('Google') || 
            voice.name.includes('Alice') || 
            voice.name.includes('Anna')
        )
    );
    if (!selectedVoice) {
        selectedVoice = voices.find(voice => voice.lang === 'it-IT');
    }
    if (!selectedVoice && voices.length > 0) {
        selectedVoice = voices[0];
    }
}

if (synth) {
    if (synth.getVoices().length === 0) {
        synth.onvoiceschanged = loadVoices;
    } else {
        loadVoices();
    }
}


function speakText(text) {
    if (!synth) return;

    if (isSpeaking && !isListening) synth.cancel();

    const cleanText = text.replace(/\*\*/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    utterance.lang = 'it-IT'; 
    utterance.pitch = 1.05; 
    utterance.rate = 0.95;  

    utterance.onstart = () => { isSpeaking = true; };
    utterance.onend = () => { isSpeaking = false; };
    utterance.onerror = (event) => { isSpeaking = false; };

    synth.speak(utterance);
}

// LOGICA RICONOSCIMENTO VOCALE (STT)
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'it-IT';
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        inputField.value = transcript;
        document.getElementById('chat-form').dispatchEvent(new Event('submit')); 
    };

    recognition.onend = () => {
        stopListening();
    };

    recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
             alert(`Errore microfono: ${event.error}.`);
        }
        stopListening();
    };
    
    voiceButton.addEventListener('click', () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    });

} else {
    voiceButton.style.display = 'none';
}

function startListening() {
    if (recognition && !isListening) {
        
        // Parla il messaggio di benvenuto solo al primo click dell'utente
        if (!hasInitializedSpeech) {
            let initialMessage = "Ciao! Sono Ascolto Sereno. Sono qui per te in uno spazio sicuro e senza giudizi. Clicca di nuovo sul pulsante per iniziare il dialogo vocale.";
            
            speakText(initialMessage.replace(/\*\*/g, '')); 
            hasInitializedSpeech = true;
            return; 
        }
        
        if (synth && isSpeaking) synth.cancel(); 
        recognition.start();
        isListening = true;
        voiceButton.innerHTML = '👄'; 
        document.body.classList.add('listening');
        inputField.placeholder = "Sto ascoltando... parla ora.";
    }
}

function stopListening() {
    if (recognition && isListening) {
        try {
            recognition.abort(); 
        } catch (e) {}
        isListening = false;
        voiceButton.innerHTML = '👄'; 
        document.body.classList.remove('listening');
        inputField.placeholder = "Scrivi qui come ti senti...";
    }
}

// ====================================================================
// === LOGICA CHAT E API GEMINI (Tramite Backend) ===
// ====================================================================

document.getElementById('chat-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const userMessage = inputField.value.trim();
    
    if (userMessage === "") return;

    addMessage(userMessage, 'user-message');
    getGeminiResponse(userMessage);
    inputField.value = '';
});


function addMessage(text, type) {
    const chatBox = document.getElementById('chat-box');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);
    
    const sender = (type === 'bot-message') ? '<strong>Ascolto Sereno</strong>: ' : 'Tu: ';
    let formattedText = text.replace(/\*\*/g, '<strong>').replace(/\*\*/g, '</strong>');
    
    messageDiv.innerHTML = sender + formattedText;
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}


async function getGeminiResponse(userText) {
    
    conversationHistory.push({
        role: "user",
        parts: [{ text: userText }]
    });

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                history: conversationHistory, 
                systemPrompt: SYSTEM_PROMPT
            })
        });

        if (!response.ok) {
            // Tenta di leggere l'errore dal backend
            const errorData = await response.json();
            throw new Error(`Errore nel servizio AI: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        
        let botText = data.text 
                      ? data.text
                      : "Mi dispiace, la risposta AI è stata interrotta o vuota.";
        
        addMessage(botText, 'bot-message');
        speakText(botText); 
        
        conversationHistory.push({
            role: "model",
            parts: [{ text: botText }]
        });

    } catch (error) {
        console.error("Errore nel recupero della risposta AI:", error);
        addMessage("Mi dispiace, c'è stato un problema di comunicazione. Assicurati che il backend Node.js sia attivo (localhost:3000).", 'bot-message');
    }
}


// ====================================================================
// === INIZIALIZZAZIONE MESSAGGIO DI BENVENUTO (Solo visuale) ===
// ====================================================================

window.onload = () => {
    
    conversationHistory.push({
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }] 
    });

    let initialMessage = "Ciao! Sono **Ascolto Sereno** e sono qui per te in uno spazio sicuro e senza giudizi. Come ti senti oggi? Ricorda, sono un supporto emotivo, non un professionista sanitario.";
    
    // VISUALIZZA il messaggio di benvenuto. L'audio parte al primo click dell'utente.
    addMessage(initialMessage, 'bot-message');
    
    conversationHistory.push({
        role: "model",
        parts: [{ text: initialMessage.replace(/\*\*/g, '') }] 
    });

};

