const User = require('../models/user');
const { oauth2Client } = require('../config/google');

exports.handleGoogleCallback = async (req, res) => {
  const { code } = req.query;
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    // Save or update user in MongoDB
    await User.findOneAndUpdate(
      { email },
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expiry_date),
      },
      { upsert: true, new: true }
    );

    res.redirect(`${process.env.FRONTEND_URL}/auth-success?email=${email}`);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/auth-error`);
  }
};

exports.refreshToken = async (req, res) => {
  const { email } = req.query;
  
  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    oauth2Client.setCredentials({
      refresh_token: user.refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    user.accessToken = credentials.access_token;
    user.tokenExpiry = new Date(Date.now() + credentials.expiry_date);
    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};