const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const User = require('../models/user');

// Get Calendar client with better error handling
const getCalendarClient = (accessToken) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.calendar({ version: 'v3', auth: oauth2Client });
  } catch (error) {
    console.error('Error creating calendar client:', error);
    throw new Error('Failed to initialize calendar client');
  }
};

// Enhanced auth middleware
const checkAuth = async (req, res, next) => {
  try {
    // Get email from query params, body, or request body data
    const email = req.query.email || req.body.email || (req.body.data && req.body.data.email);
    
    if (!email) {
      console.log('No email provided in request');
      return res.status(401).json({ error: 'Email required' });
    }

    console.log('Checking auth for:', email);
    const user = await User.findOne({ email });
    
    if (!user || !user.accessToken) {
      console.log('No user found or no access token');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check token expiry
    if (user.tokenExpiry && new Date(user.tokenExpiry) <= new Date()) {
      console.log('Token expired, attempting refresh');
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
          refresh_token: user.refreshToken
        });

        const { credentials } = await oauth2Client.refreshAccessToken();
        
        user.accessToken = credentials.access_token;
        user.tokenExpiry = new Date(Date.now() + (credentials.expiry_date || 3600000));
        await user.save();
        
        console.log('Token refreshed successfully');
      } catch (error) {
        console.error('Token refresh failed:', error);
        return res.status(401).json({ error: 'Session expired' });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Apply auth middleware to all routes
router.use(checkAuth);

// Create event with enhanced error handling
router.post('/', async (req, res) => {
  try {
    const { summary, startDateTime, endDateTime, timeZone } = req.body;
    console.log('Creating event with data:', { summary, startDateTime, endDateTime });
    
    if (!summary || !startDateTime || !endDateTime) {
      return res.status(400).json({ error: 'Missing required event details' });
    }

    const calendar = getCalendarClient(req.user.accessToken);
    
    const event = {
      summary,
      start: {
        dateTime: startDateTime,
        timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDateTime,
        timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    console.log('Creating event:', event);

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event
    });

    console.log('Event created successfully:', response.data.id);
    res.status(201).json(response.data);
  } catch (error) {
    console.error('Create event error:', error);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Session expired' });
    }
    
    res.status(500).json({ 
      error: 'Failed to create event',
      details: error.message 
    });
  }
});

// Get events with enhanced error handling
router.get('/', async (req, res) => {
  try {
    console.log('Fetching events for user:', req.user.email);
    const calendar = getCalendarClient(req.user.accessToken);
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
    });

    console.log('Events fetched successfully:', response.data.items?.length || 0);
    res.json(response.data.items || []);
  } catch (error) {
    console.error('Get events error:', error);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Session expired' });
    }
    
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Enhanced delete event route
router.delete('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    console.log('Attempting to delete event:', eventId, 'for user:', req.user.email);

    if (!eventId) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const calendar = getCalendarClient(req.user.accessToken);

    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'none'
      });

      console.log('Event deleted successfully');
      res.json({ success: true, message: 'Event deleted successfully' });
    } catch (calendarError) {
      console.error('Google Calendar delete error:', calendarError);

      if (calendarError.response?.status === 404) {
        return res.status(404).json({ error: 'Event not found' });
      }

      if (calendarError.response?.status === 401) {
        return res.status(401).json({ error: 'Session expired' });
      }

      if (calendarError.response?.status === 403) {
        return res.status(403).json({ error: 'Permission denied to delete event' });
      }

      throw calendarError;
    }
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ 
      error: 'Failed to delete event',
      details: error.message,
      eventId: req.params.eventId 
    });
  }
});

// Update event route (optional, for future use)
router.put('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { summary, startDateTime, endDateTime, timeZone } = req.body;
    
    console.log('Updating event:', eventId);

    if (!summary || !startDateTime || !endDateTime) {
      return res.status(400).json({ error: 'Missing required event details' });
    }

    const calendar = getCalendarClient(req.user.accessToken);
    
    const event = {
      summary,
      start: {
        dateTime: startDateTime,
        timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDateTime,
        timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: event,
      sendUpdates: 'none'
    });

    console.log('Event updated successfully');
    res.json(response.data);
  } catch (error) {
    console.error('Update event error:', error);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Session expired' });
    }
    
    res.status(500).json({ 
      error: 'Failed to update event',
      details: error.message 
    });
  }
});

module.exports = router;