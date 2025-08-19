module.exports = async function handler(req, res) {
  // Enable CORS for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const PROVIDER = process.env.PROVIDER || 'ollama';
  const PORT = process.env.PORT || 8787;

  return res.json({ 
    ok: true, 
    provider: PROVIDER, 
    port: Number(PORT),
    default_model: process.env.OLLAMA_MODEL || 'llama3',
    default_embed_model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
};
