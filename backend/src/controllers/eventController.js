const { google } = require('googleapis');
const Event = require('../models/event');

const getGoogleCalendarClient = (accessToken) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
};

exports.getEvents = async (req, res) => {
  try {
    const user = req.user; // Set by auth middleware
    console.log('Fetching events for user:', user.email);

    const calendar = getGoogleCalendarClient(user.accessToken);
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
    });

    console.log(`Found ${response.data.items?.length || 0} events`);
    res.json(response.data.items || []);
  } catch (error) {
    console.error('Get events error:', error);
    
    // Check if token expired
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const { summary, startDateTime, endDateTime } = req.body;
    const user = req.user; // Set by auth middleware

    console.log('Creating event for user:', user.email);
    
    const calendar = getGoogleCalendarClient(user.accessToken);

    const event = {
      summary,
      start: {
        dateTime: startDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event
    });

    console.log('Event created:', response.data.id);
    res.status(201).json(response.data);
  } catch (error) {
    console.error('Create event error:', error);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    
    res.status(500).json({ error: 'Failed to create event' });
  }
};