// Fallback placeholder images for demo/testing
const fallbackImages = [
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=600&fit=crop&q=80',
  'https://images.unsplash.com/photo-1558655146-d09347e92766?w=800&h=600&fit=crop&q=80', 
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=800&h=600&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600&fit=crop&q=80'
];

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
    const { imagePrompt } = req.body;

    if (!imagePrompt || imagePrompt.trim().length === 0) {
      return res.status(400).json({ error: 'Image prompt is required' });
    }

    // For now, return demo fallback image
    const randomImage = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
    return res.status(200).json({
      success: true,
      demo: true,
      imageUrl: randomImage,
      message: 'Demo mode: Configure IMAGE_GENERATION_API_KEY for AI image generation'
    });

  } catch (error) {
    console.error('Image generation error:', error);

    // Return fallback image on error
    const randomImage = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
    
    return res.status(200).json({
      success: true,
      fallback: true,
      imageUrl: randomImage,
      error: 'AI image generation failed, using fallback',
      originalError: error.message
    });
  }
};