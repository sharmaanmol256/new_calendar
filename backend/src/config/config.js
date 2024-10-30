const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from the correct location
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI
    },
    mongodb: {
        uri: process.env.MONGODB_URI
    },
    frontend: {
        url: process.env.FRONTEND_URL
    },
    server: {
        port: process.env.PORT || 5000
    }
};

// Validate required configuration
const validateConfig = () => {
    const required = [
        ['google.clientId', config.google.clientId],
        ['google.clientSecret', config.google.clientSecret],
        ['google.redirectUri', config.google.redirectUri],
        ['mongodb.uri', config.mongodb.uri],
        ['frontend.url', config.frontend.url]
    ];

    const missing = required.filter(([key, value]) => !value);
    
    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.map(([key]) => key).join(', ')}`);
    }
};

validateConfig();

module.exports = config;