// Fallback placeholder images
const fallbackImages = [
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=800&fit=crop&q=80',
  'https://images.unsplash.com/photo-1558655146-d09347e92766?w=1200&h=800&fit=crop&q=80', 
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=800&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=1200&h=800&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=1200&h=800&fit=crop&q=80'
];

module.exports = async function(req, res) {
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
    const { imagePrompt, styleId } = req.body;

    if (!imagePrompt) {
      return res.status(400).json({ error: 'Image prompt is required' });
    }

    // Check if Recraft API key is available
    if (!process.env.IMAGE_GENERATION_API_KEY) {
      const randomImage = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
      return res.status(200).json({
        success: true,
        demo: true,
        imageUrl: randomImage,
        message: 'Demo mode: Add IMAGE_GENERATION_API_KEY for AI image generation'
      });
    }

    // Generate image using Recraft API
    const response = await fetch('https://external.api.recraft.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.IMAGE_GENERATION_API_KEY}`
      },
      body: JSON.stringify({
        prompt: `Professional, high-quality business image: ${imagePrompt}. Style: clean, modern, suitable for business/marketing layouts. High contrast, visually striking, suitable for web use. Professional photography style, bright even lighting.`,
        style_id: styleId || '97dac561-3ff9-4764-9fad-392a0732a3f0',
        size: '1365x1024',
        response_format: 'url'
      })
    });

    if (!response.ok) {
      throw new Error(`Recraft API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No image generated');
    }

    const imageUrl = data.data[0].url;

    return res.status(200).json({
      success: true,
      imageUrl: imageUrl,
      prompt: imagePrompt
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
}