const { Ollama } = require('ollama');
require('dotenv').config();

// Aquí usamos la IP de Tailscale que pondrás en tu .env
const ollama = new Ollama({ 
  host: process.env.OLLAMA_HOST 
  //|| 'http://localhost:11434' 
});

module.exports = { ollama };