import express from 'express';
import cors from 'cors';
import 'dotenv/config'; // Per caricare la chiave API da .env
import { GoogleGenAI } from '@google/genai';

// 1. Inizializzazione
const app = express();
const PORT = process.env.PORT || 3000;

// La chiave viene caricata in modo sicuro dalla variabile d'ambiente GEMINI_API_KEY
// ASSICURATI DI AVER CREATO IL FILE .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 2. Middleware per la sicurezza e gestione del JSON
// Abilita CORS per permettere al tuo frontend (es. localhost:5500) di parlare con il backend
app.use(cors()); 
app.use(express.json());

// 3. Endpoint per la chat di Gemini
app.post('/api/chat', async (req, res) => {
    // Il frontend invierà la cronologia della conversazione nel corpo della richiesta
    const { history, systemPrompt } = req.body;

    // Converte la cronologia in formato Gemini
    const contents = [...history];

    // Aggiunge la System Prompt come primo messaggio 'user' per la configurazione
    if (systemPrompt && contents.length === 0) {
        contents.unshift({
            role: "user",
            parts: [{ text: systemPrompt }]
        });
        // Aggiunge una risposta iniziale fittizia per bilanciare il primo turno di chat
        contents.push({
            role: "model",
            parts: [{ text: "Ok, ho compreso il mio ruolo." }]
        });
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                // Generazione di contenuto
                temperature: 0.5,
            }
        });

        // Invia la risposta pulita al frontend
        res.json({ text: response.text });
        
    } catch (error) {
        console.error('Errore durante la chiamata API Gemini:', error.message);
        // Invia un codice di errore sicuro
        res.status(500).json({ error: 'Errore nel servizio AI.' });
    }
});

// 4. Avvio del server
app.listen(PORT, () => {
    console.log(`Server backend in ascolto su http://localhost:${PORT}`);
    console.log(`CHIAVE API: ${process.env.GEMINI_API_KEY ? 'Caricata' : 'NON CARICATA! Controlla il file .env'}`);
});