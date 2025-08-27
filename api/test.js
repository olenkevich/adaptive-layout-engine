module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }
  
  return res.status(200).json({
    message: 'API is working!',
    method: req.method,
    timestamp: new Date().toISOString()
  });
};