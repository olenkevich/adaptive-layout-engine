module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // For now, return demo content until we add API keys
    return res.status(200).json({
      success: true,
      demo: true,
      result: {
        header: 'AI-Generated Layout',
        subheader: 'This is a demo of AI-powered layout generation. Configure your OpenAI API key to use real AI generation.',
        tag: 'DEMO',
        imagePrompt: 'Modern tech office with large screens showing data analytics, bright lighting, clean minimalist design'
      }
    });

  } catch (error) {
    console.error('Text generation error:', error);
    
    return res.status(500).json({
      error: 'Text generation failed',
      fallback: {
        header: 'Design Excellence',
        subheader: 'Transform your ideas into professional layouts with intelligent design systems.',
        tag: 'PRO',
        imagePrompt: 'Clean modern design with professional typography and layout elements'
      }
    });
  }
};