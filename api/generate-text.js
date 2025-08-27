module.exports = async (req, res) => {
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

    // Check if Deepseek API key is available
    if (!process.env.TEXT_GENERATION_API_KEY) {
      return res.status(200).json({
        success: true,
        demo: true,
        result: {
          header: 'AI-Powered Productivity',
          subheader: 'Transform your workflow with intelligent automation and smart insights.',
          tag: 'DEMO',
          imagePrompt: 'Modern office workspace with AI technology, clean design, productivity tools'
        }
      });
    }

    // Generate text content using Deepseek API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEXT_GENERATION_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
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
  "imagePrompt": "Detailed image description for image generation"
}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      throw new Error(`Deepseek API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content.trim();
    
    // Parse JSON response
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      return res.status(200).json({
        success: true,
        fallback: true,
        result: {
          header: 'Creative Design Solution',
          subheader: 'Adaptive layouts that scale beautifully across all devices and platforms.',
          tag: 'NEW',
          imagePrompt: 'Modern abstract geometric design with clean lines and vibrant colors'
        }
      });
    }

    // Validate required fields
    if (!result.header || !result.subheader) {
      return res.status(200).json({
        success: true,
        fallback: true,
        result: {
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
    
    // Return fallback on any error
    return res.status(200).json({
      success: true,
      fallback: true,
      result: {
        header: 'Design Excellence',
        subheader: 'Transform your ideas into professional layouts with intelligent design systems.',
        tag: 'PRO',
        imagePrompt: 'Clean modern design with professional typography and layout elements'
      }
    });
  }
}