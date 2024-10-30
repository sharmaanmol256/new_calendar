const User = require('../models/user');
const { google } = require('googleapis');

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Helper function to refresh token
const refreshAccessToken = async (refreshToken) => {
  try {
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    const { credentials } = await oauth2Client.refreshAccessToken();
    return {
      accessToken: credentials.access_token,
      expiryDate: new Date(Date.now() + (credentials.expiry_date || 3600000))
    };
  } catch (error) {
    console.error('Token refresh helper error:', error);
    throw error;
  }
};

const refreshTokenIfNeeded = async (req, res, next) => {
  try {
    // Get email from various possible locations
    const email = req.query.email || req.body.email || (req.body.data && req.body.data.email);

    if (!email) {
      console.log('No email provided in request');
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Email is required for authentication'
      });
    }

    console.log('Checking auth for email:', email);
    
    // Find user and verify existence
    const user = await User.findOne({ email });
    if (!user) {
      console.log('No user found for email:', email);
      return res.status(401).json({ 
        error: 'User not authenticated',
        message: 'User not found in database'
      });
    }

    // Verify refresh token exists
    if (!user.refreshToken) {
      console.log('No refresh token for user:', email);
      return res.status(401).json({ 
        error: 'User not authenticated',
        message: 'No refresh token available'
      });
    }

    // Check token expiry
    const now = new Date();
    const tokenExpiry = user.tokenExpiry ? new Date(user.tokenExpiry) : now;
    
    // Add some buffer time (5 minutes) to prevent edge cases
    const bufferTime = 5 * 60 * 1000;
    
    if (!user.accessToken || tokenExpiry.getTime() <= (now.getTime() + bufferTime)) {
      console.log('Token expired or expiring soon for user:', email);
      
      try {
        console.log('Attempting to refresh token...');
        const { accessToken, expiryDate } = await refreshAccessToken(user.refreshToken);
        
        // Update user with new token information
        user.accessToken = accessToken;
        user.tokenExpiry = expiryDate;
        await user.save();
        
        console.log('Token refreshed successfully for:', email);
      } catch (refreshError) {
        console.error('Token refresh failed for:', email, refreshError);
        
        // Clear invalid tokens
        user.accessToken = undefined;
        user.tokenExpiry = undefined;
        await user.save();
        
        return res.status(401).json({ 
          error: 'Session expired',
          message: 'Failed to refresh authentication token'
        });
      }
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    // Log the full error stack for debugging
    console.error(error.stack);
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred during authentication'
    });
  }
};

// Helper middleware to verify specific permissions (optional)
const verifyPermissions = (requiredScopes) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'User must be authenticated'
        });
      }

      oauth2Client.setCredentials({
        access_token: req.user.accessToken
      });

      const tokenInfo = await oauth2Client.getTokenInfo(req.user.accessToken);
      
      const hasAllScopes = requiredScopes.every(scope => 
        tokenInfo.scopes.includes(scope)
      );

      if (!hasAllScopes) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          message: 'Missing required Google Calendar permissions'
        });
      }

      next();
    } catch (error) {
      console.error('Permission verification error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Error verifying permissions'
      });
    }
  };
};

// Middleware to check if token is about to expire
const checkTokenExpiry = async (req, res, next) => {
  try {
    if (!req.user || !req.user.tokenExpiry) {
      return next();
    }

    const expiryTime = new Date(req.user.tokenExpiry).getTime();
    const currentTime = Date.now();
    const timeUntilExpiry = expiryTime - currentTime;

    // If token expires in less than 5 minutes, refresh it
    if (timeUntilExpiry < 5 * 60 * 1000) {
      try {
        const { accessToken, expiryDate } = await refreshAccessToken(req.user.refreshToken);
        req.user.accessToken = accessToken;
        req.user.tokenExpiry = expiryDate;
        await req.user.save();
      } catch (error) {
        console.error('Token refresh error in expiry check:', error);
      }
    }

    next();
  } catch (error) {
    console.error('Token expiry check error:', error);
    next();
  }
};

module.exports = {
  refreshTokenIfNeeded,
  verifyPermissions,
  checkTokenExpiry,
  // Export the OAuth client for use in other parts of the application
  oauth2Client
};