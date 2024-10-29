const User = require('../models/user');

const authMiddleware = async (req, res, next) => {
  try {
    // Get email from either query params or body
    const email = req.query.email || (req.body && req.body.userEmail);
    
    if (!email) {
      console.log('No email provided in request:', { query: req.query, body: req.body });
      return res.status(401).json({ error: 'Email is required' });
    }

    console.log('Looking up user:', email);
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.accessToken) {
      console.log('No access token for user:', email);
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Store user in request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = authMiddleware;