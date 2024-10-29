const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const User = require('../models/user');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Debug log to check environment variables
console.log('Auth Config:', {
  hasClientId: !!process.env.GOOGLE_CLIENT_ID,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
  frontendUrl: process.env.FRONTEND_URL
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

router.get('/google', (req, res) => {
  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      include_granted_scopes: true,
      prompt: 'consent'
    });

    console.log('Generated Auth URL:', authUrl);
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Auth URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    console.log('Received code in callback:', code);

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    console.log('Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token
    });

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    console.log('User email:', email);

    await User.findOneAndUpdate(
      { email },
      {
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + (tokens.expiry_date || 3600000))
      },
      { upsert: true, new: true }
    );

    // Make sure FRONTEND_URL doesn't have trailing slash
    const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
    const redirectUrl = `${frontendUrl}?auth-success=true&email=${encodeURIComponent(email)}`;
    
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
    res.redirect(`${frontendUrl}?auth-error=true&error=${encodeURIComponent(error.message)}`);
  }
});

module.exports = { router };