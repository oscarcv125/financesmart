const providers = {
  ollama: () => require('./providers/ollama'),
  gemini: () => require('./providers/gemini'),
};

function pickProviderName() {
  const explicit = (process.env.AI_PROVIDER || '').toLowerCase().trim();
  if (explicit && providers[explicit]) return explicit;
  if (explicit) {
    throw new Error(`AI_PROVIDER inválido: "${explicit}". Usa "ollama" o "gemini".`);
  }
  // No explicit choice: prefer Gemini when an API key is configured, else Ollama.
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return 'ollama';
}

const providerName = pickProviderName();
const provider = providers[providerName]();

const caps = provider.capabilities || {};
const capsLabel = [
  caps.supportsTools && 'tools',
  caps.supportsStructuredOutput && 'structured',
  caps.supportsStreaming && 'streaming',
].filter(Boolean).join(', ') || 'streaming';

console.log(`[AI] Proveedor activo: ${provider.name} (${provider.model}) [${capsLabel}]`);

module.exports = provider;
