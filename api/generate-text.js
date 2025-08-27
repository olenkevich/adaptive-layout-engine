export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // For now, return test data to verify UI is working
    return res.status(200).json({
      success: true,
      result: {
        header: 'AI-Powered Productivity',
        subheader: 'Transform your workflow with intelligent automation and smart insights.',
        tag: 'NEW',
        imagePrompt: 'Modern office workspace with AI technology, clean design, productivity tools'
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}