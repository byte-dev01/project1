import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const CalendarFeedLink = () => {
  const [nextEvent, setNextEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch next upcoming event
  useEffect(() => {
    fetchNextEvent();
  }, []);

  const fetchNextEvent = async () => {
    try {
      const response = await fetch('/api/events');
      if (response.ok) {
        const events = await response.json();
        
        // Find the next upcoming event
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentTime = now.toTimeString().split(' ')[0].slice(0, 5); // HH:MM format
        
        const upcomingEvents = events
          .filter(event => {
            // Filter future events (including today's future events)
            if (event.date > today) return true;
            if (event.date === today && event.startTime > currentTime) return true;
            return false;
          })
          .sort((a, b) => {
            // Sort by date, then by time
            if (a.date === b.date) {
              return a.startTime.localeCompare(b.startTime);
            }
            return a.date.localeCompare(b.date);
          });
        
        setNextEvent(upcomingEvents[0] || null);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format the event display
  const formatEventDisplay = (event) => {
    if (!event) return 'No upcoming events - Click to add new events';
    
    const eventDate = new Date(event.date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let dateStr;
    if (eventDate.toDateString() === today.toDateString()) {
      dateStr = 'Today';
    } else if (eventDate.toDateString() === tomorrow.toDateString()) {
      dateStr = 'Tomorrow';
    } else {
      dateStr = eventDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric'
      });
    }
    
    // Format time
    const [hours, minutes] = event.startTime.split(':');
    const timeDate = new Date();
    timeDate.setHours(parseInt(hours), parseInt(minutes));
    const timeStr = timeDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return `${dateStr} at ${timeStr} - ${event.title}`;
  };

  if (loading) {
    return (
      <>
        <div className="feed-title">Composite Calendar</div>
        <div className="feed-description">Loading...</div>
      </>
    );
  }

  return (
    <Link to="/calendar" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div className="feed-title" style={{ cursor: 'pointer' }}>
        Composite Calendar
      </div>
      <div className="feed-description" style={{ cursor: 'pointer' }}>
        {formatEventDisplay(nextEvent)}
      </div>
    </Link>
  );
};

export default CalendarFeedLink;
