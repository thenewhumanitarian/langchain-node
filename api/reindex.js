module.exports = async function handler(req, res) {
  // Enable CORS for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

    // Placeholder endpoint; will be implemented in Phase 2.
    // This will handle reindexing documents from Drupal into the vector store
    return res.json({ 
      ok: true, 
      stats: { 
        numAdded: 0, 
        numUpdated: 0, 
        numDeleted: 0, 
        numSkipped: 0 
      },
      message: 'Reindex endpoint ready for implementation',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
