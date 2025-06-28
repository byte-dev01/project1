// Create this as: client/src/components/Calendar.js

import React, { useState, useEffect } from 'react';
import './Calendar.css'; // We'll create this CSS file

const Calendar = () => {
  // State management
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [miniCalendarDate, setMiniCalendarDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedHour, setSelectedHour] = useState(9);
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    startTime: '09:00',
    endTime: '10:00'
  });
  const [editingEventId, setEditingEventId] = useState(null);

  // API base URL
  const API_BASE_URL = '/api';

  // Utility functions
  function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  // Load events from API
  const loadEvents = async () => {
    try {
      console.log('🔄 Loading events from API...');
      const response = await fetch(`${API_BASE_URL}/events`);
      
      if (response.ok) {
        const eventsData = await response.json();
        console.log(`📅 Loaded ${eventsData.length} events successfully`);
        setEvents(eventsData);
      } else {
        console.error('❌ Failed to load events. Status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
      }
    } catch (error) {
      console.error('❌ Failed to load events:', error);
    }
  };

  // Add manual refresh function for debugging
  const refreshEvents = async () => {
    console.log('🔄 Manual refresh triggered');
    await loadEvents();
  };

  // Save event to database
  const saveEvent = async (eventData) => {
    try {
      console.log('💾 Saving event:', eventData);
      const response = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      if (response.ok) {
        const savedEvent = await response.json();
        console.log('✅ Event saved successfully:', savedEvent);
        setEvents(prev => {
          const newEvents = [...prev, savedEvent];
          console.log('📅 Updated events state:', newEvents);
          return newEvents;
        });
        return savedEvent;
      } else {
        console.error('❌ Failed to save event. Status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
      }
    } catch (error) {
      console.error('❌ Failed to save event:', error);
    }
  };

  // Update event
  const updateEvent = async (eventData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      if (response.ok) {
        const updatedEvent = await response.json();
        setEvents(prev => prev.map(e => e.id === eventData.id ? updatedEvent : e));
        return updatedEvent;
      }
    } catch (error) {
      console.error('Failed to update event:', error);
    }
  };

  // Delete event
  const deleteEvent = async (eventId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setEvents(prev => prev.filter(e => e.id !== eventId));
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  // Initialize
  useEffect(() => {
    console.log('🚀 Calendar component mounted, loading events...');
    loadEvents();
  }, []);

  // Debug: Log when events state changes (only once to avoid loops)
  useEffect(() => {
    if (events.length > 0) {
      console.log('📅 Events loaded successfully:', events.length, 'events');
    }
  }, [events.length]); // Only trigger when length changes

  // Generate week dates
  const getWeekDates = () => {
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!eventForm.title || !eventForm.date || !eventForm.startTime || !eventForm.endTime) {
      alert('Please fill in all fields');
      return;
    }

    const eventData = {
      id: editingEventId || Date.now().toString(),
      ...eventForm
    };

    if (editingEventId) {
      await updateEvent(eventData);
    } else {
      await saveEvent(eventData);
    }

    closeModal();
  };

  // Open modal for new event
  const openEventModal = (date, hour = 9) => {
    setEventForm({
      title: '',
      date,
      startTime: `${hour.toString().padStart(2, '0')}:00`,
      endTime: `${(hour + 1).toString().padStart(2, '0')}:00`
    });
    setSelectedDate(date);
    setSelectedHour(hour);
    setEditingEventId(null);
    setShowModal(true);
  };

  // Open modal for editing
  const editEvent = (event) => {
    setEventForm({
      title: event.title,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime
    });
    setEditingEventId(event.id);
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setEventForm({
      title: '',
      date: '',
      startTime: '09:00',
      endTime: '10:00'
    });
    setEditingEventId(null);
  };

  // Navigation functions
  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentWeekStart(newDate);
  };

  const goToToday = () => {
    setCurrentWeekStart(getStartOfWeek(new Date()));
    setMiniCalendarDate(new Date());
  };

  // Render time slots
  const renderTimeSlots = () => {
    const weekDates = getWeekDates();
    const slots = [];

    for (let hour = 0; hour < 24; hour++) {
      const timeLabel = hour === 0 ? '12 AM' : 
                       hour < 12 ? `${hour} AM` : 
                       hour === 12 ? '12 PM' : `${hour - 12} PM`;

      slots.push(
        <React.Fragment key={hour}>
          <div className="time-slot">
            <div className="time-label">{timeLabel}</div>
          </div>
          {weekDates.map((date, dayIndex) => (
            <div
              key={`${hour}-${dayIndex}`}
              className="day-column"
              onClick={() => openEventModal(formatDate(date), hour)}
            />
          ))}
        </React.Fragment>
      );
    }

    return slots;
  };

  // Render events
  const renderEvents = () => {
    const weekDates = getWeekDates();
    const weekStart = formatDate(weekDates[0]);
    const weekEnd = formatDate(weekDates[6]);
    
    const eventsInWeek = events.filter(event => event.date >= weekStart && event.date <= weekEnd);
    
    const renderedEvents = eventsInWeek.map((event, index) => {
        const dayIndex = weekDates.findIndex(date => formatDate(date) === event.date);
        
        if (dayIndex === -1) {
          return null;
        }

        const startHour = parseInt(event.startTime.split(':')[0]);
        const startMinutes = parseInt(event.startTime.split(':')[1]);
        const endHour = parseInt(event.endTime.split(':')[0]);
        const endMinutes = parseInt(event.endTime.split(':')[1]);
        
        const startPosition = startHour * 48 + (startMinutes / 60) * 48;
        const duration = (endHour - startHour) * 48 + ((endMinutes - startMinutes) / 60) * 48;
        
        // 简化的位置计算
        const columnWidth = `calc((100% - 60px) / 7)`;
        const leftPosition = `calc(60px + ${dayIndex} * (100% - 60px) / 7)`;
        
        // Debug positioning
        console.log(`📍 Event "${event.title}" positioning:`, {
          dayIndex,
          leftPosition,
          columnWidth,
          date: event.date
        });
        
        const eventStyle = {
          position: 'absolute',
          top: `${startPosition}px`,
          height: `${Math.max(duration, 20)}px`,
          left: leftPosition,
          width: columnWidth,
          zIndex: 1000,
          backgroundColor: '#039be5',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          border: '1px solid #0288d1',
          // 临时添加红色背景以便调试
          backgroundColor: '#ff0000'
        };
        
        return (
          <div
            key={event.id || event._id || index}
            style={eventStyle}
            onClick={(e) => {
              e.stopPropagation();
              console.log('📅 Event clicked:', event.title);
              editEvent(event);
            }}
            title={`${event.title} (${event.startTime} - ${event.endTime})`}
          >
            {event.title}
          </div>
        );
      }).filter(Boolean);
      
    // Only log once when there are events to render
    if (eventsInWeek.length > 0 && renderedEvents.length !== eventsInWeek.length) {
      console.log(`🎨 Rendered ${renderedEvents.length} out of ${eventsInWeek.length} events`);
    }
    
    return renderedEvents;
  };

  const weekDates = getWeekDates();

  return (
    <div className="calendar-wrapper">
      {/* Header */}
      <div className="calendar-header-bar">
        <div className="calendar-logo-section">
          <div className="calendar-logo">
            <svg viewBox="0 0 40 40">
              <rect width="40" height="40" rx="8" fill="#4285f4"/>
              <text x="20" y="28" fontSize="18" fill="white" textAnchor="middle" fontWeight="500">
                {new Date().getDate()}
              </text>
            </svg>
          </div>
          <span className="calendar-logo-text">Calendar</span>
        </div>

        <div className="calendar-date-navigation">
          <button className="calendar-today-button" onClick={goToToday}>
            Today
          </button>
          <button className="calendar-today-button" onClick={refreshEvents} style={{marginLeft: '10px', background: '#28a745'}}>
            🔄 Refresh
          </button>
          <div className="calendar-nav-arrows">
            <button className="calendar-nav-arrow" onClick={() => navigateWeek(-1)}>
              ←
            </button>
            <button className="calendar-nav-arrow" onClick={() => navigateWeek(1)}>
              →
            </button>
          </div>
          <div className="calendar-current-date">
            {weekDates[0].toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </div>
          <div style={{marginLeft: '20px', fontSize: '14px', color: '#666'}}>
            Events: {events.length}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="calendar-main-container">
        {/* Sidebar */}
        <div className="calendar-sidebar">
          <button 
            className="calendar-create-button"
            onClick={() => openEventModal(formatDate(new Date()), 9)}
          >
            <span>+ Create</span>
          </button>
        </div>

        {/* Calendar View */}
        <div className="calendar-container">
          {/* Week Header */}
          <div className="calendar-week-header">
            <div className="calendar-timezone-header">GMT-08</div>
            {weekDates.map(date => (
              <div key={date.toISOString()} className={`calendar-day-header ${isToday(date) ? 'today' : ''}`}>
                <div className="calendar-day-name">
                  {date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}
                </div>
                <div className="calendar-day-number">{date.getDate()}</div>
              </div>
            ))}
          </div>

          {/* Calendar Body */}
          <div className="calendar-body">
            <div className="calendar-time-grid">
              {renderTimeSlots()}
              {renderEvents()}
              
              {/* Test red block for visibility */}
              <div style={{
                position: 'absolute',
                top: '100px',
                left: '200px',
                width: '100px',
                height: '30px',
                backgroundColor: 'red',
                color: 'white',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}>
                TEST BLOCK
              </div>
              
              {/* Temporary debug overlay */}
              {events.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'rgba(0,0,0,0.8)',
                  color: 'white',
                  padding: '10px',
                  borderRadius: '4px',
                  zIndex: 2000,
                  fontSize: '12px'
                }}>
                  📅 Debug Info:<br/>
                  Total Events: {events.length}<br/>
                  Week Range: {formatDate(getWeekDates()[0])} to {formatDate(getWeekDates()[6])}<br/>
                  Events in Week: {events.filter(event => {
                    const weekDates = getWeekDates();
                    const weekStart = formatDate(weekDates[0]);
                    const weekEnd = formatDate(weekDates[6]);
                    return event.date >= weekStart && event.date <= weekEnd;
                  }).length}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {showModal && (
        <div className="calendar-modal-overlay" onClick={closeModal}>
          <div className="calendar-event-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              {editingEventId ? 'Edit Event' : 'Add Event'}
            </div>
            <form onSubmit={handleSubmit}>
              <div className="calendar-form-group">
                <label className="calendar-form-label">Event Title</label>
                <input
                  type="text"
                  className="calendar-form-input"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                  placeholder="Event title"
                  required
                />
              </div>
              <div className="calendar-form-group">
                <label className="calendar-form-label">Date</label>
                <input
                  type="date"
                  className="calendar-form-input"
                  value={eventForm.date}
                  onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
                  required
                />
              </div>
              <div className="calendar-form-group">
                <label className="calendar-form-label">Time</label>
                <div className="calendar-time-inputs">
                  <input
                    type="time"
                    className="calendar-form-input"
                    value={eventForm.startTime}
                    onChange={(e) => setEventForm({...eventForm, startTime: e.target.value})}
                  />
                  <input
                    type="time"
                    className="calendar-form-input"
                    value={eventForm.endTime}
                    onChange={(e) => setEventForm({...eventForm, endTime: e.target.value})}
                  />
                </div>
              </div>
              <div className="calendar-modal-buttons">
                <button type="button" className="calendar-btn calendar-btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                {editingEventId && (
                  <button 
                    type="button" 
                    className="calendar-btn calendar-btn-delete"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this event?')) {
                        deleteEvent(editingEventId);
                        closeModal();
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
                <button type="submit" className="calendar-btn calendar-btn-primary">
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;

