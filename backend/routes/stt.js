// routes/stt.js
const express = require('express');
const speech = require('@google-cloud/speech');
const authMiddleware = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Verificar que las credenciales existen
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialsPath || !fs.existsSync(path.resolve(credentialsPath))) {
  console.error('❌ Archivo de credenciales de Google Cloud no encontrado:', credentialsPath);
}

// Inicializar cliente de Google Cloud Speech
const speechClient = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});


/**
 * POST /api/stt
 * Convierte audio (base64) a texto usando Google Cloud STT
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Verificar que el cliente de STT esté inicializado
    if (!speechClient) {
      return res.status(500).json({
        error: 'Servicio de Speech-to-Text no disponible',
        details: 'Cliente de Google Cloud no inicializado. Revisa las credenciales.'
      });
    }

    const { audio, language = 'es-ES' } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'Audio es requerido' });
    }

    // Decodificar base64 a Buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    
    const config = {
      encoding: 'WEBM_OPUS', // Cambiar a formato que soporta MediaRecorder
      sampleRateHertz: 48000, // Sample rate típico del navegador
      languageCode: language,
      enableAutomaticPunctuation: true,
      model: 'latest_long',
      audioChannelCount: 2,
    };

    const audio_param = {
      content: audioBuffer,
    };

    // Enviar a Google Cloud STT
    const request = {
      config,
      audio: audio_param,
    };

    const [response] = await speechClient.recognize(request);
    const transcription = response.results
      .map((result) => result.alternatives[0].transcript)
      .join('\n');

    res.json({
      success: true,
      text: transcription,
      confidence: response.results[0]?.alternatives[0]?.confidence || null,
    });
  } catch (error) {
    console.error('Error en STT:', error);

    // Mejorar el manejo de errores
    let errorMessage = 'Error al procesar audio';
    let statusCode = 500;

    if (error.code === 403) {
      errorMessage = 'Error de autenticación con Google Cloud. Verifica las credenciales.';
      statusCode = 403;
    } else if (error.code === 400) {
      errorMessage = 'Formato de audio no válido. Verifica la configuración de grabación.';
      statusCode = 400;
    } else if (error.message.includes('credentials')) {
      errorMessage = 'Credenciales de Google Cloud no encontradas o inválidas.';
      statusCode = 500;
    }

    res.status(statusCode).json({
      error: errorMessage,
      details: error.message,
      code: error.code
    });
  }
});

/**
 * GET /api/stt/test
 * Endpoint de prueba para verificar credenciales de Google Cloud
 */
router.get('/test', authMiddleware, async (req, res) => {
  try {
    if (!speechClient) {
      return res.status(500).json({
        status: 'error',
        message: 'Cliente de Google Cloud Speech no inicializado',
        credentialsConfigured: !!process.env.GOOGLE_APPLICATION_CREDENTIALS
      });
    }

    // Intentar una operación simple para verificar credenciales
    const [result] = await speechClient.recognize({
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
      },
      audio: {
        content: Buffer.from(''), // Audio vacío para prueba
      },
    });

    res.json({
      status: 'success',
      message: 'Credenciales de Google Cloud configuradas correctamente',
      credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error en credenciales de Google Cloud',
      error: error.message,
      code: error.code
    });
  }
});

module.exports = router;
