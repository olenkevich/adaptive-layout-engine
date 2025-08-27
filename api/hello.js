module.exports = (req, res) => {
  res.status(200).json({
    name: 'John Doe',
    message: 'Hello from Vercel!'
  });
};