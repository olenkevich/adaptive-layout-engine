const OpenAI = require('openai');

// Initialize OpenAI client only if API key is provided
const openai = process.env.TEXT_GENERATION_API_KEY ? new OpenAI({
  apiKey: process.env.TEXT_GENERATION_API_KEY,
}) : null;

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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
    // Check if API key is configured
    if (!openai) {
      return res.status(503).json({ 
        error: 'Text generation service not configured',
        fallback: {
          header: 'AI-Generated Layout',
          subheader: 'This is a demo of AI-powered layout generation. Configure your OpenAI API key to use real AI generation.',
          tag: 'DEMO'
        }
      });
    }

    const { prompt } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Generate text content using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a professional copywriter and design expert. Create compelling, concise content for layout designs.

Instructions:
- Generate a punchy header (max 8 words, inspiring and memorable)
- Create an engaging subheader (max 25 words, descriptive and benefit-focused)  
- Add a relevant tag if appropriate (max 2 words, or empty if not needed)
- Also create an image generation prompt (describe the visual that would complement this content)

Respond ONLY with valid JSON in this exact format:
{
  "header": "Your header text here",
  "subheader": "Your subheader text here", 
  "tag": "TAG" or "",
  "imagePrompt": "Detailed image description for DALL-E"
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.8,
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Parse JSON response
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      return res.status(500).json({
        error: 'Failed to parse AI response',
        fallback: {
          header: 'Creative Design Solution',
          subheader: 'Adaptive layouts that scale beautifully across all devices and platforms.',
          tag: 'NEW',
          imagePrompt: 'Modern abstract geometric design with clean lines and vibrant colors'
        }
      });
    }

    // Validate required fields
    if (!result.header || !result.subheader) {
      return res.status(500).json({
        error: 'Invalid AI response format',
        fallback: {
          header: 'Professional Layout Design',
          subheader: 'Create stunning visuals that engage your audience and deliver results.',
          tag: result.tag || '',
          imagePrompt: result.imagePrompt || 'Professional design layout with modern typography'
        }
      });
    }

    return res.status(200).json({
      success: true,
      result: {
        header: result.header,
        subheader: result.subheader,
        tag: result.tag || '',
        imagePrompt: result.imagePrompt || 'Modern design layout'
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