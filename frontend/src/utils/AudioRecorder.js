// utils/audioRecorder.js

export class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioStream = null;
    this.audioChunks = [];
    this.audioContext = null;
    this.isRecording = false;
  }

  /**
   * Inicia la grabación de audio
   * @returns {Promise<boolean>} true si se inició correctamente
   */

  async startRecording() {
    try {
      this.audioChunks = [];
      
      // Crear AudioContext para mejor control del audio
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Solicitar acceso al micrófono
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Intentar con formato específico, fallback a automático
      const options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn('Formato audio/webm;codecs=opus no soportado, usando formato automático');
        options.mimeType = ''; // Usar formato automático del navegador
      }

      this.mediaRecorder = new MediaRecorder(this.audioStream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      return true;
    } catch (error) {
      console.error("Error al acceder al micrófono:", error);
      return false;
    }
  }

  /**
   * Detiene la grabación de audio
   * @returns {Promise<Blob>} Blob del audio grabado (WAV)
   */
  stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        // Usar el mime type WAV si está disponible, fallback a audio/wav
        const mimeType = this.mediaRecorder.mimeType || 'audio/wav';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        
        // Detener el stream del micrófono
        this.audioStream.getTracks().forEach(track => track.stop());
        
        if (this.audioContext) {
          this.audioContext.close();
          this.audioContext = null;
        }
        
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioStream = null;
        
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancela la grabación sin guardar
   */
  cancelRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioChunks = [];
      this.isRecording = false;
      
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
    }
  }

  /**
   * Verifica si actualmente está grabando
   */
  getIsRecording() {
    return this.isRecording;
  }

  /**
   * Convierte el audio a base64 para enviar por API
   * @param {Blob} audioBlob - El blob de audio
   * @returns {Promise<string>} String en base64
   */
  static blobToBase64(audioBlob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result.split(',')[1]); // Retorna solo el base64 sin el prefijo
      };
      reader.readAsDataURL(audioBlob);
    });
  }

  /**
   * Crea una URL descargable del audio (útil para testing)
   * @param {Blob} audioBlob - El blob de audio
   * @returns {string} URL del audio
   */
  static createAudioURL(audioBlob) {
    return URL.createObjectURL(audioBlob);
  }

  /**
   * Envía el audio a Google Cloud STT mediante el backend
   * @param {Blob} audioBlob - El blob de audio
   * @param {string} accessToken - Token JWT del usuario
   * @param {string} language - Código de idioma (ej: 'es-ES', 'en-US')
   * @returns {Promise<{text: string, confidence: number}>} Texto transcrito
   */
  static async sendToSTT(audioBlob, accessToken, language = 'es-ES') {
    try {
      // Convertir blob a base64
      const base64Audio = await AudioRecorder.blobToBase64(audioBlob);

      // Enviar al endpoint backend
      const response = await fetch('/api/stt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          audio: base64Audio,
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar audio');
      }

      return {
        text: data.text,
        confidence: data.confidence,
      };
    } catch (error) {
      console.error('Error enviando audio a STT:', error);
      throw error;
    }
  }
}

export default AudioRecorder;