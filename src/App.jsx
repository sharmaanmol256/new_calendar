import { useState, useEffect, useCallback } from 'react';
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

const API_URL = import.meta.env.VITE_API_URL || 'https://mern-calendar-app-61i9.onrender.com';

// Create axios instance with base configuration
const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Add request interceptor to include email in all requests
axiosInstance.interceptors.request.use(
  (config) => {
    const email = localStorage.getItem('userEmail');
    if (email) {
      // Add email to query params for GET requests
      if (config.method === 'get') {
        config.params = { ...config.params, email };
      }
      // Add email to body for other requests
      else {
        config.data = { ...config.data, email };
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle auth errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('userEmail');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

const App = () => {
  // State Management
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [events, setEvents] = useState([]);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '',
    date: '',
    time: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch events function
  const fetchEvents = useCallback(async () => {
    if (!userEmail) return;

    try {
      setError(null);
      console.log('Fetching events for:', userEmail);
      const response = await axiosInstance.get('/api/events');
      setEvents(response.data || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      if (error.response?.status === 401) {
        setIsSignedIn(false);
        setUserEmail(null);
        localStorage.removeItem('userEmail');
        setError('Session expired. Please sign in again.');
      } else {
        setError('Failed to load events. Please try again.');
      }
    }
  }, [userEmail]);

  // Initialize auth state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check URL parameters for OAuth response
        const params = new URLSearchParams(window.location.search);
        const authSuccess = params.get('auth-success');
        const email = params.get('email');
        const authError = params.get('auth-error');

        if (authSuccess === 'true' && email) {
          console.log('Auth callback successful:', email);
          localStorage.setItem('userEmail', email);
          setIsSignedIn(true);
          setUserEmail(email);
          await fetchEvents();
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }

        if (authError) {
          const errorMsg = params.get('error') || 'Authentication failed';
          setError(decodeURIComponent(errorMsg));
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }

        // Check existing session
        const savedEmail = localStorage.getItem('userEmail');
        if (savedEmail) {
          console.log('Checking existing session for:', savedEmail);
          const response = await axiosInstance.get(`/api/auth/check?email=${savedEmail}`);
          
          if (response.data.authenticated) {
            console.log('Session valid for:', savedEmail);
            setIsSignedIn(true);
            setUserEmail(savedEmail);
            await fetchEvents();
          } else {
            console.log('Session invalid for:', savedEmail);
            localStorage.removeItem('userEmail');
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('userEmail');
        setError('Failed to verify authentication');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [fetchEvents]);

  // Handle sign in
  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axiosInstance.get('/api/auth/google');
      
      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Sign in failed:', error);
      setError('Failed to initiate sign in');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      setError(null);
      
      if (userEmail) {
        await axiosInstance.post('/api/auth/logout', { email: userEmail });
      }
      
      setIsSignedIn(false);
      setUserEmail(null);
      setEvents([]);
      localStorage.removeItem('userEmail');
      
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out failed:', error);
      setError('Failed to sign out properly');
    }
  };

  // Handle create event
  const handleCreateEvent = async () => {
    if (!isSignedIn || !userEmail) {
      setError('Please sign in to create events');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const startDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
      if (startDateTime < new Date()) {
        throw new Error('Cannot create events in the past');
      }

      const endDateTime = new Date(startDateTime.getTime() + (60 * 60 * 1000));

      console.log('Creating event:', {
        summary: newEvent.name,
        startDateTime,
        endDateTime,
        email: userEmail
      });

      const response = await axiosInstance.post('/api/events', {
        summary: newEvent.name,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString()
      });

      console.log('Event created:', response.data);
      await fetchEvents();
      setShowEventDialog(false);
      setNewEvent({ name: '', date: '', time: '' });
    } catch (error) {
      console.error('Failed to create event:', error);
      if (error.response?.status === 401) {
        setIsSignedIn(false);
        setUserEmail(null);
        localStorage.removeItem('userEmail');
        setError('Session expired. Please sign in again.');
      } else {
        setError(error.response?.data?.error || error.message || 'Failed to create event');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
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
          {/* Error Display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative">
              <span className="block sm:inline">{error}</span>
              <button 
                onClick={() => setError(null)}
                className="absolute top-0 bottom-0 right-0 px-4 py-3"
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>
          )}

          {/* Auth Button */}
          <div className="flex items-center gap-4 mb-6">
            <Button 
              onClick={isSignedIn ? handleSignOut : handleSignIn}
              className="bg-purple-600 hover:bg-purple-700"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : isSignedIn ? 'Sign Out' : 'Sign in with Google'}
            </Button>

            {isSignedIn && userEmail && (
              <span className="text-sm text-gray-600">
                Signed in as {userEmail}
              </span>
            )}
          </div>

          {/* Main Content */}
          {isSignedIn ? (
            <>
              <Button 
                onClick={() => setShowEventDialog(true)}
                className="bg-green-600 hover:bg-green-700 mb-6"
                disabled={isSubmitting}
              >
                Create Event
              </Button>

              <EventTable 
                events={events} 
                onRefresh={fetchEvents}
                userEmail={userEmail}
              />
            </>
          ) : (
            <div className="text-center py-8 text-red-600">
              Please sign in to create events
            </div>
          )}

          {/* Create Event Dialog */}
          <Dialog 
            open={showEventDialog} 
            onOpenChange={(open) => {
              setShowEventDialog(open);
              if (!open) {
                setNewEvent({ name: '', date: '', time: '' });
                setError(null);
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
                  disabled={isSubmitting}
                />
                <Input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                  disabled={isSubmitting}
                />
                <Input
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                  disabled={isSubmitting}
                />
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowEventDialog(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateEvent}
                    disabled={isSubmitting || !newEvent.name || !newEvent.date || !newEvent.time}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Event'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;