const OpenAI = require('openai');

// Initialize OpenAI client only if API key is provided
const openai = process.env.IMAGE_GENERATION_API_KEY ? new OpenAI({
  apiKey: process.env.IMAGE_GENERATION_API_KEY,
}) : null;

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Fallback placeholder images for demo/testing
const fallbackImages = [
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=600&fit=crop&q=80',
  'https://images.unsplash.com/photo-1558655146-d09347e92766?w=800&h=600&fit=crop&q=80', 
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=800&h=600&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600&fit=crop&q=80'
];

module.exports = async function handler(req, res) {
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

    // Check if API key is configured
    if (!openai) {
      // Return demo fallback image
      const randomImage = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
      return res.status(200).json({
        success: true,
        demo: true,
        imageUrl: randomImage,
        message: 'Demo mode: Configure IMAGE_GENERATION_API_KEY for AI image generation'
      });
    }

    // Generate image using DALL-E
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Create a professional, high-quality image: ${imagePrompt}. Style: clean, modern, suitable for business/marketing layouts. High contrast, visually striking, suitable for web use.`,
      size: '1792x1024', // Good aspect ratio for layout designs
      quality: 'standard',
      n: 1,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No image generated');
    }

    const imageUrl = response.data[0].url;

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
};