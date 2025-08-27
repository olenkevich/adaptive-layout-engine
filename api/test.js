export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  res.status(200).json({
    message: 'API is working!',
    method: req.method,
    timestamp: new Date().toISOString(),
    hasTextKey: !!process.env.TEXT_GENERATION_API_KEY,
    hasImageKey: !!process.env.IMAGE_GENERATION_API_KEY
  });
}