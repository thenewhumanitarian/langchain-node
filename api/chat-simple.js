export default async function handler(req, res) {
  // Enable CORS for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.SERVICE_API_KEY || '';
    const auth = req.headers.authorization || '';
    if (apiKey && auth !== `Bearer ${apiKey}`) {
      return res.status(401).json({ error: 'Unauthorised' });
    }

    const { message, conversation_history = [], database_context = '', ai_settings = {} } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid message' });
    }

    console.log('[tnh-langchain-service] Processing simple chat request');

    // Simple response without LangChain for now
    const response = {
      message: `Hello! You said: "${message}". This is a simple test response.`,
      context: {
        relevant_articles: []
      },
      meta: {
        provider: 'test',
        model: 'simple-test',
        environment: process.env.NODE_ENV || 'development'
      }
    };

    return res.json(response);
  } catch (e) {
    console.error('Simple chat error:', e);
    return res.status(500).json({ 
      error: 'Server error', 
      message: e.message,
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
}
