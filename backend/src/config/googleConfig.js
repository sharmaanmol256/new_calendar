const { google } = require('googleapis');

// Debug: Log the values being used
console.log('OAuth Configuration:', {
    clientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not Set',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not Set',
    redirectUri: process.env.GOOGLE_REDIRECT_URI
});

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar'
];

const getAuthUrl = () => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        include_granted_scopes: true,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI // Explicitly set redirect URI
    });
    
    // Debug: Log the generated URL
    console.log('Generated Auth URL:', url);
    
    return url;
};

module.exports = {
    oauth2Client,
    getAuthUrl,
    SCOPES
};