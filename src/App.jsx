import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "./components/ui/Card";
import { Button } from "./components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./components/ui/Dialog";
import { Input } from "./components/ui/Input";
import EventTable from './components/ui/EventTable';

// ... rest of your imports and code ...

const handleCreateEvent = async () => {
  try {
    setError(null);
    const startDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
    const endDateTime = new Date(startDateTime.getTime() + (60 * 60 * 1000));

    const response = await axios.post(`${API_URL}/api/events`, {
      summary: newEvent.name,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      userEmail
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data) {
      // Refresh events list
      await fetchEvents(userEmail);
      setShowEventDialog(false);
      setNewEvent({ name: '', date: '', time: '' });
    }
  } catch (error) {
    console.error('Error creating event:', error);
    if (error.response?.status === 401) {
      // Handle unauthorized error
      setError('Session expired. Please sign in again.');
      handleSignOut(); // Sign out user if session is invalid
    } else {
      setError('Failed to create event. Please try again.');
    }
  }
};

// ... rest of your code ...
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const App = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [events, setEvents] = useState([]);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '',
    date: '',
    time: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check authentication status on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authSuccess = params.get('auth-success');
    const email = params.get('email');

    if (authSuccess && email) {
      console.log('Authentication successful for:', email);
      setIsSignedIn(true);
      setUserEmail(email);
      localStorage.setItem('userEmail', email);
      fetchEvents(email);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Fetch events function
  const fetchEvents = async (email) => {
    try {
      const response = await axios.get(`${API_URL}/api/events?email=${email}`);
      setEvents(response.data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Failed to fetch events. Please try signing in again.');
    }
  };

  // Handle sign in
  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/auth/google`);
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError('Failed to sign in with Google. Please try again.');
      setIsLoading(false);
    }
  };

  // Handle sign out
  const handleSignOut = () => {
    setIsSignedIn(false);
    setUserEmail(null);
    setEvents([]);
    localStorage.removeItem('userEmail');
  };

  // Handle event creation
  const handleCreateEvent = async () => {
    try {
      setError(null);
      const startDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
      const endDateTime = new Date(startDateTime.getTime() + (60 * 60 * 1000));

      await axios.post(`${API_URL}/api/events`, {
        summary: newEvent.name,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        userEmail
      });

      await fetchEvents(userEmail);
      setShowEventDialog(false);
      setNewEvent({ name: '', date: '', time: '' });
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Failed to create event. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Google Calendar Integration</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
              <button 
                onClick={() => setError(null)} 
                className="float-right font-bold"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 mb-6">
            <Button 
              onClick={isSignedIn ? handleSignOut : handleSignIn}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSignedIn ? 'Sign Out' : 'Sign in with Google'}
            </Button>

            {isSignedIn && userEmail && (
              <span className="text-sm text-gray-600">
                Signed in as {userEmail}
              </span>
            )}
          </div>

          {isSignedIn && (
            <>
              <Button 
                onClick={() => setShowEventDialog(true)}
                className="bg-green-600 hover:bg-green-700 mb-6"
              >
                Create Event
              </Button>

              <EventTable 
                events={events} 
                onRefresh={() => fetchEvents(userEmail)} 
              />
            </>
          )}

          <Dialog 
            open={showEventDialog} 
            onOpenChange={(open) => {
              setShowEventDialog(open);
              if (!open) {
                setNewEvent({ name: '', date: '', time: '' });
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Calendar Event</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input
                  placeholder="Event name"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({...newEvent, name: e.target.value})}
                />
                <Input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                />
                <Input
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                />
                <Button 
                  onClick={handleCreateEvent}
                  disabled={!newEvent.name || !newEvent.date || !newEvent.time}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Create Event
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;