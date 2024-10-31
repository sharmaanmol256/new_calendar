import React, { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://mern-calendar-app-61i9.onrender.com';

const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

const EventTable = ({ events = [], onRefresh, userEmail }) => {
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [error, setError] = useState(null);

  const handleDelete = async (eventId) => {
    try {
      setDeleteLoading(eventId);
      setError(null);

      console.log('Deleting event:', eventId);
      
      await axiosInstance.delete(`/api/events/${eventId}`, {
        data: { email: userEmail } // Include email in request body
      });

      console.log('Event deleted successfully');
      await onRefresh();
    } catch (error) {
      console.error('Delete failed:', error);
      setError('Failed to delete event');
      
      if (error.response?.status === 401) {
        // Handle authentication error
        localStorage.removeItem('userEmail');
        window.location.href = '/';
      }
    } finally {
      setDeleteLoading(null);
    }
  };

  const getTimeRemaining = (eventDate) => {
    const now = new Date();
    const eventTime = new Date(eventDate);
    const diff = eventTime - now;

    if (diff < 0) return '0m';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="w-full">
      <div className="bg-purple-600 p-4 flex justify-between items-center">
        <h3 className="text-xl font-bold text-white">Upcoming Events</h3>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-700"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4">
          {error}
          <button
            onClick={() => setError(null)}
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
          >
            <span className="text-xl">&times;</span>
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event Name
              </th>
              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time Remaining
              </th>
              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {events.map((event) => {
              const startTime = event.start.dateTime || event.start.date;
              return (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-purple-100">
                        <span className="text-purple-600 text-lg">
                          {event.summary[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {event.summary}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(startTime).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(startTime).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {getTimeRemaining(startTime)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDelete(event.id)}
                      disabled={deleteLoading === event.id}
                      className={`text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {deleteLoading === event.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {events.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No upcoming events. Create your first event!
          </div>
        )}
      </div>
    </div>
  );
};

export default EventTable;