const { google } = require('googleapis');

// Helper function to get Google Calendar client
const getGoogleCalendarClient = (accessToken) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
};

const eventController = {
  getEvents: async (req, res) => {
    try {
      const user = req.user;
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
      if (error.response?.status === 401) {
        return res.status(401).json({ error: 'Token expired' });
      }
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  },

  createEvent: async (req, res) => {
    try {
      const { summary, description, startDateTime, endDateTime, attendees } = req.body;
      const user = req.user;

      console.log('Creating event for user:', user.email);
      
      const calendar = getGoogleCalendarClient(user.accessToken);

      const event = {
        summary,
        description,
        start: {
          dateTime: startDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        attendees: attendees?.map(email => ({ email }))
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        sendUpdates: attendees?.length ? 'all' : 'none',
        resource: event
      });

      console.log('Event created:', response.data.id);
      res.status(201).json(response.data);
    } catch (error) {
      console.error('Create event error:', error);
      if (error.response?.status === 401) {
        return res.status(401).json({ error: 'Token expired' });
      }
      res.status(500).json({ error: 'Failed to create event' });
    }
  },

  deleteEvent: async (req, res) => {
    try {
      const { eventId } = req.params;
      const user = req.user;

      console.log('Deleting event:', eventId, 'for user:', user.email);

      const calendar = getGoogleCalendarClient(user.accessToken);

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });

      console.log('Event deleted successfully');
      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      console.error('Delete event error:', error);
      if (error.response?.status === 401) {
        return res.status(401).json({ error: 'Token expired' });
      }
      if (error.response?.status === 404) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.status(500).json({ error: 'Failed to delete event' });
    }
  },

  updateEvent: async (req, res) => {
    try {
      const { eventId } = req.params;
      const { summary, description, startDateTime, endDateTime, attendees } = req.body;
      const user = req.user;

      console.log('Updating event:', eventId, 'for user:', user.email);

      const calendar = getGoogleCalendarClient(user.accessToken);

      const event = {
        summary,
        description,
        start: {
          dateTime: startDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        attendees: attendees?.map(email => ({ email }))
      };

      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: attendees?.length ? 'all' : 'none',
        resource: event
      });

      console.log('Event updated successfully');
      res.json(response.data);
    } catch (error) {
      console.error('Update event error:', error);
      if (error.response?.status === 401) {
        return res.status(401).json({ error: 'Token expired' });
      }
      if (error.response?.status === 404) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.status(500).json({ error: 'Failed to update event' });
    }
  }
};

module.exports = eventController;