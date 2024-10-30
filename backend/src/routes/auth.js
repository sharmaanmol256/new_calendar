const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const User = require('../models/user');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// Auth check endpoint
router.get('/check', async (req, res) => {
  try {
    const { email } = req.query;
    console.log('Checking auth for:', email);

    if (!email) {
      return res.json({ authenticated: false });
    }

    const user = await User.findOne({ email });
    if (!user || !user.refreshToken) {
      return res.json({ authenticated: false });
    }

    // Check if token needs refresh
    if (user.tokenExpiry && new Date(user.tokenExpiry) <= new Date()) {
      try {
        oauth2Client.setCredentials({
          refresh_token: user.refreshToken
        });
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        user.accessToken = credentials.access_token;
        user.tokenExpiry = new Date(Date.now() + (credentials.expiry_date || 3600000));
        await user.save();
      } catch (error) {
        console.error('Token refresh failed:', error);
        return res.json({ authenticated: false });
      }
    }

    res.json({ authenticated: true });
  } catch (error) {
    console.error('Auth check error:', error);
    res.json({ authenticated: false });
  }
});

// Google auth initiation
router.get('/google', (req, res) => {
  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      include_granted_scopes: true
    });
    
    console.log('Generated auth URL');
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Auth URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// Google callback
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    console.log('Received auth code');

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    console.log('User authenticated:', email);

    // Save user
    const user = await User.findOneAndUpdate(
      { email },
      {
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + (tokens.expiry_date || 3600000))
      },
      { upsert: true, new: true }
    );

    const redirectUrl = `${process.env.FRONTEND_URL}?auth-success=true&email=${encodeURIComponent(email)}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?auth-error=true&error=${encodeURIComponent(error.message)}`);
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const { email } = req.body;
    if (email) {
      const user = await User.findOne({ email });
      if (user && user.accessToken) {
        try {
          await oauth2Client.revokeToken(user.accessToken);
        } catch (error) {
          console.error('Token revocation error:', error);
        }
      }
      
      await User.findOneAndUpdate(
        { email },
        { $unset: { accessToken: "", refreshToken: "", tokenExpiry: "" } }
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

module.exports = router;