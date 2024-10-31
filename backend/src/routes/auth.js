const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const User = require('../models/user');

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Define scopes
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// Helper function to refresh token
const refreshUserToken = async (user) => {
  try {
    oauth2Client.setCredentials({
      refresh_token: user.refreshToken
    });
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    user.accessToken = credentials.access_token;
    user.tokenExpiry = new Date(Date.now() + (credentials.expiry_date || 3600000));
    await user.save();
    
    console.log('Token refreshed successfully for user:', user.email);
    return true;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
};

// Auth check endpoint with enhanced error handling
router.get('/check', async (req, res) => {
  try {
    const { email } = req.query;
    console.log('Checking auth for:', email);

    if (!email) {
      console.log('No email provided in auth check');
      return res.json({ authenticated: false });
    }

    const user = await User.findOne({ email });
    if (!user || !user.refreshToken) {
      console.log('No user found or no refresh token for:', email);
      return res.json({ authenticated: false });
    }

    // Check token expiry with 5-minute buffer
    const now = new Date();
    const tokenExpiry = user.tokenExpiry ? new Date(user.tokenExpiry) : now;
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (tokenExpiry.getTime() - now.getTime() <= bufferTime) {
      console.log('Token expired or expiring soon for:', email);
      const refreshSuccess = await refreshUserToken(user);
      if (!refreshSuccess) {
        return res.json({ authenticated: false });
      }
    }

    res.json({ authenticated: true });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ 
      authenticated: false,
      error: 'Internal server error during auth check'
    });
  }
});

// Google auth initiation with enhanced error handling
router.get('/google', (req, res) => {
  try {
    console.log('Generating auth URL with scopes:', SCOPES);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      include_granted_scopes: true
    });
    
    console.log('Auth URL generated successfully');
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Auth URL generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate auth URL',
      details: error.message 
    });
  }
});

// Google callback with enhanced error handling and logging
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    console.log('Received auth code, exchanging for tokens');

    if (!code) {
      throw new Error('No authorization code received');
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Received tokens from Google');

    oauth2Client.setCredentials(tokens);
    
    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;
    const name = userInfo.data.name;

    console.log('User authenticated:', email);

    // Calculate token expiry
    const tokenExpiry = tokens.expiry_date 
      ? new Date(Date.now() + tokens.expiry_date)
      : new Date(Date.now() + 3600000); // 1 hour default

    // Save or update user
    const userData = {
      email,
      name,
      accessToken: tokens.access_token,
      tokenExpiry,
      lastLogin: new Date()
    };

    // Only update refresh token if we received a new one
    if (tokens.refresh_token) {
      userData.refreshToken = tokens.refresh_token;
    }

    const user = await User.findOneAndUpdate(
      { email },
      userData,
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );

    console.log('User data saved successfully');

    // Construct redirect URL
    const redirectUrl = `${process.env.FRONTEND_URL}?auth-success=true&email=${encodeURIComponent(email)}`;
    console.log('Redirecting to:', redirectUrl);
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Callback error:', error);
    const errorMessage = encodeURIComponent(error.message || 'Authentication failed');
    const redirectUrl = `${process.env.FRONTEND_URL}?auth-error=true&error=${errorMessage}`;
    res.redirect(redirectUrl);
  }
});

// Logout endpoint with enhanced error handling and token revocation
router.post('/logout', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Logout request for:', email);

    if (!email) {
      return res.status(400).json({ error: 'Email is required for logout' });
    }

    const user = await User.findOne({ email });
    if (user) {
      // Try to revoke Google token
      if (user.accessToken) {
        try {
          await oauth2Client.revokeToken(user.accessToken);
          console.log('Access token revoked for:', email);
        } catch (error) {
          console.error('Token revocation error:', error);
        }
      }

      // Clear user tokens
      await User.findOneAndUpdate(
        { email },
        {
          $unset: {
            accessToken: "",
            refreshToken: "",
            tokenExpiry: ""
          },
          lastLogout: new Date()
        }
      );
      console.log('User tokens cleared for:', email);
    }

    res.json({ 
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Failed to logout',
      details: error.message 
    });
  }
});

// Token refresh endpoint (optional, for manual refresh)
router.post('/refresh', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.refreshToken) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const refreshSuccess = await refreshUserToken(user);
    if (!refreshSuccess) {
      return res.status(401).json({ error: 'Failed to refresh token' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Manual token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

module.exports = router;
