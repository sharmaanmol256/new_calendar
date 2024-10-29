import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const authAPI = {
  getGoogleAuthUrl: () => api.get('/api/auth/google'),
};

export const eventsAPI = {
  getEvents: () => api.get('/api/events'),
  createEvent: (eventData) => api.post('/api/events', eventData),
};

export default api;