const providerName = (process.env.AI_PROVIDER || 'ollama').toLowerCase();

const providers = {
  ollama: () => require('./providers/ollama'),
  gemini: () => require('./providers/gemini'),
};

if (!providers[providerName]) {
  throw new Error(
    `AI_PROVIDER inválido: "${providerName}". Usa "ollama" o "gemini".`
  );
}

const provider = providers[providerName]();

console.log(`[AI] Proveedor activo: ${provider.name} (${provider.model})`);

module.exports = provider;
