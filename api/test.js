export default async function handler(req, res) {
  // Enable CORS for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Test basic functionality
    const testData = {
      message: 'Test endpoint working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      provider: process.env.PROVIDER || 'unknown',
      openai_key_set: !!process.env.OPENAI_API_KEY,
      supabase_url_set: !!process.env.SUPABASE_URL,
      supabase_key_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      service_key_set: !!process.env.SERVICE_API_KEY
    };

    return res.json(testData);
  } catch (e) {
    console.error('Test endpoint error:', e);
    return res.status(500).json({ 
      error: 'Test endpoint error', 
      message: e.message,
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
};
