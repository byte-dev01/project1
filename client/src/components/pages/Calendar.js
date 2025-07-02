// Create this as: client/src/components/Calendar.js
import React, { useState, useEffect } from 'react';
import './Calendar.css';

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
    endTime: '10:00',
    description: '',
    location: ''
  });
  const [editingEventId, setEditingEventId] = useState(null);
  const [viewType, setViewType] = useState('week');
  const [showViewDropdown, setShowViewDropdown] = useState(false);

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

  function isSameMonth(date1, date2) {
    return date1.getMonth() === date2.getMonth() && 
           date1.getFullYear() === date2.getFullYear();
  }

  // Load events from API
  const loadEvents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/events`);
      if (response.ok) {
        const eventsData = await response.json();
        setEvents(eventsData);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  // Save event to database
  const saveEvent = async (eventData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      if (response.ok) {
        const savedEvent = await response.json();
        setEvents(prev => [...prev, savedEvent]);
        return savedEvent;
      }
    } catch (error) {
      console.error('Failed to save event:', error);
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
    loadEvents();
  }, []);

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

  // Generate mini calendar days
  const getMiniCalendarDays = () => {
    const firstDay = new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth(), 1);
    const lastDay = new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Previous month days
    const prevMonthLastDay = new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth(), 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: prevMonthLastDay - i,
        isCurrentMonth: false,
        fullDate: new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth() - 1, prevMonthLastDay - i)
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: i,
        isCurrentMonth: true,
        fullDate: new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth(), i)
      });
    }
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: i,
        isCurrentMonth: false,
        fullDate: new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth() + 1, i)
      });
    }
    
    return days;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!eventForm.title || !eventForm.date || !eventForm.startTime || !eventForm.endTime) {
      alert('Please fill in all required fields');
      return;
    }

    const eventData = {
      id: editingEventId || Date.now().toString(),
      ...eventForm,
      updatedAt: new Date()
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
      endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
      description: '',
      location: ''
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
      endTime: event.endTime,
      description: event.description || '',
      location: event.location || ''
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
      endTime: '10:00',
      description: '',
      location: ''
    });
    setEditingEventId(null);
  };

  // Navigation functions
  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentWeekStart(newDate);
  };

  const navigateMiniCalendar = (direction) => {
    const newDate = new Date(miniCalendarDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setMiniCalendarDate(newDate);
  };

  const goToToday = () => {
    setCurrentWeekStart(getStartOfWeek(new Date()));
    setMiniCalendarDate(new Date());
  };

  // Render time slots
  const renderTimeSlots = () => {
    const slots = [];
    
    for (let hour = 0; hour < 24; hour++) {
      slots.push(
        <div key={hour} className="gcal-time-slot">
          <div className="gcal-time-label">
            {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
          </div>
        </div>
      );
    }
    
    return slots;
  };

  // Render day columns
  const renderDayColumns = () => {
    const weekDates = getWeekDates();
    
    return weekDates.map((date, index) => (
      <div key={index} className="gcal-day-column">
        {Array.from({ length: 24 }, (_, hour) => (
          <div
            key={hour}
            className="gcal-hour-cell"
            onClick={() => openEventModal(formatDate(date), hour)}
          />
        ))}
      </div>
    ));
  };

  // Render events
  const renderEvents = () => {
    const weekDates = getWeekDates();
    const weekStart = formatDate(weekDates[0]);
    const weekEnd = formatDate(weekDates[6]);
    
    return events
      .filter(event => event.date >= weekStart && event.date <= weekEnd)
      .map((event) => {
        const dayIndex = weekDates.findIndex(date => formatDate(date) === event.date);
        if (dayIndex === -1) return null;

        const startHour = parseInt(event.startTime.split(':')[0]);
        const startMinutes = parseInt(event.startTime.split(':')[1]);
        const endHour = parseInt(event.endTime.split(':')[0]);
        const endMinutes = parseInt(event.endTime.split(':')[1]);
        
        const top = (startHour + startMinutes / 60) * 48;
        const height = ((endHour + endMinutes / 60) - (startHour + startMinutes / 60)) * 48;
        const left = dayIndex * (100 / 7);
        
        return (
          <div
            key={event.id}
            className="gcal-event"
            style={{
              top: `${top}px`,
              height: `${Math.max(height, 20)}px`,
              left: `${left}%`,
              width: `${100 / 7}%`
            }}
            onClick={(e) => {
              e.stopPropagation();
              editEvent(event);
            }}
          >
            <div className="gcal-event-title">{event.title}</div>
            {event.location && <div className="gcal-event-location">{event.location}</div>}
          </div>
        );
      });
  };

  const weekDates = getWeekDates();

  return (
    <div className="gcal-wrapper">
      {/* Header */}
      <header className="gcal-header">
        <div className="gcal-header-left">
          <button className="gcal-menu-btn">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor"/>
            </svg>
          </button>
          
          <div className="gcal-logo">
            <img src="https://ssl.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_27_2x.png" alt="Calendar" />
            <span className="gcal-logo-text">Calendar</span>
          </div>
          
          <div className="gcal-today-nav">
            <button className="gcal-today-btn" onClick={goToToday}>
              Today
            </button>
            
            <div className="gcal-nav-arrows">
              <button onClick={() => navigateWeek(-1)}>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59z" fill="currentColor"/>
                </svg>
              </button>
              <button onClick={() => navigateWeek(1)}>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" fill="currentColor"/>
                </svg>
              </button>
            </div>
            
            <div className="gcal-current-period">
              {weekDates[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
        
        <div className="gcal-header-right">
          <div className="gcal-view-switcher">
            <button 
              className="gcal-view-btn"
              onClick={() => setShowViewDropdown(!showViewDropdown)}
            >
              Week
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M7 10l5 5 5-5z" fill="currentColor"/>
              </svg>
            </button>
            
            {showViewDropdown && (
              <div className="gcal-view-dropdown">
                <div className="gcal-view-option">Day</div>
                <div className="gcal-view-option gcal-view-active">Week</div>
                <div className="gcal-view-option">Month</div>
                <div className="gcal-view-option">Year</div>
                <div className="gcal-view-option">Schedule</div>
                <div className="gcal-view-option">4 days</div>
              </div>
            )}
          </div>
          
          <button className="gcal-settings-btn">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M13.85 22.25h-3.7c-.74 0-1.36-.54-1.45-1.27l-.27-1.89c-.27-.14-.53-.29-.79-.46l-1.8.72c-.7.26-1.47-.03-1.81-.65L2.2 15.53c-.35-.66-.2-1.44.36-1.88l1.53-1.19c-.01-.15-.02-.3-.02-.46 0-.15.01-.31.02-.46l-1.52-1.19c-.59-.45-.74-1.26-.37-1.88l1.85-3.19c.34-.62 1.11-.9 1.79-.63l1.81.73c.26-.17.52-.32.78-.46l.27-1.91c.09-.7.71-1.25 1.44-1.25h3.7c.74 0 1.36.54 1.45 1.27l.27 1.89c.27.14.53.29.79.46l1.8-.72c.71-.26 1.48.03 1.82.65l1.84 3.18c.36.66.2 1.44-.36 1.88l-1.52 1.19c.01.15.02.3.02.46s-.01.31-.02.46l1.52 1.19c.56.45.72 1.23.37 1.86l-1.86 3.22c-.34.62-1.11.9-1.8.63l-1.8-.72c-.26.17-.52.32-.78.46l-.27 1.91c-.1.68-.72 1.22-1.46 1.22zm-3.23-2h2.76l.37-2.55.53-.22c.44-.18.88-.44 1.34-.78l.45-.34 2.38.96 1.38-2.4-2.03-1.58.07-.56c.03-.26.06-.51.06-.78s-.03-.53-.06-.78l-.07-.56 2.03-1.58-1.39-2.4-2.39.96-.45-.35c-.42-.32-.87-.58-1.33-.77l-.52-.22-.37-2.55h-2.76l-.37 2.55-.53.21c-.44.19-.88.44-1.34.79l-.45.33-2.38-.95-1.39 2.39 2.03 1.58-.07.56a7 7 0 0 0-.06.79c0 .26.02.53.06.78l.07.56-2.03 1.58 1.38 2.4 2.39-.96.45.35c.43.33.86.58 1.33.77l.53.22.38 2.55z" fill="currentColor"/>
              <circle cx="12" cy="12" r="3.5" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="gcal-main">
        {/* Sidebar */}
        <div className="gcal-sidebar">
          {/* Create Button */}
          <button 
            className="gcal-create-btn"
            onClick={() => openEventModal(formatDate(new Date()))}
          >
            <svg width="36" height="36" viewBox="0 0 36 36">
              <path fill="#fff" d="M16 16V8h4v8h8v4h-8v8h-4v-8H8v-4h8z"/>
            </svg>
            <span>Create</span>
          </button>

          {/* Mini Calendar */}
          <div className="gcal-mini-calendar">
            <div className="gcal-mini-calendar-header">
              <span>{miniCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              <div className="gcal-mini-calendar-nav">
                <button onClick={() => navigateMiniCalendar(-1)}>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59z" fill="currentColor"/>
                  </svg>
                </button>
                <button onClick={() => navigateMiniCalendar(1)}>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="gcal-mini-calendar-days">
              <div className="gcal-mini-calendar-weekdays">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="gcal-mini-calendar-weekday">{day}</div>
                ))}
              </div>
              <div className="gcal-mini-calendar-dates">
                {getMiniCalendarDays().map((day, i) => (
                  <div
                    key={i}
                    className={`gcal-mini-calendar-date ${!day.isCurrentMonth ? 'gcal-other-month' : ''} ${isToday(day.fullDate) ? 'gcal-today' : ''}`}
                    onClick={() => {
                      setCurrentWeekStart(getStartOfWeek(day.fullDate));
                    }}
                  >
                    {day.date}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Calendar List */}
          <div className="gcal-calendar-list">
            <div className="gcal-calendar-section">
              <h3>My calendars</h3>
              <div className="gcal-calendar-item">
                <input type="checkbox" defaultChecked />
                <span className="gcal-calendar-color" style={{ backgroundColor: '#039be5' }}></span>
                <span className="gcal-calendar-name">Rachel Li</span>
              </div>
              <div className="gcal-calendar-item">
                <input type="checkbox" defaultChecked />
                <span className="gcal-calendar-color" style={{ backgroundColor: '#33b679' }}></span>
                <span className="gcal-calendar-name">Birthdays</span>
              </div>
              <div className="gcal-calendar-item">
                <input type="checkbox" defaultChecked />
                <span className="gcal-calendar-color" style={{ backgroundColor: '#4285f4' }}></span>
                <span className="gcal-calendar-name">Tasks</span>
              </div>
            </div>
            
            <div className="gcal-calendar-section">
              <h3>Other calendars</h3>
              <div className="gcal-calendar-item">
                <input type="checkbox" defaultChecked />
                <span className="gcal-calendar-color" style={{ backgroundColor: '#0b8043' }}></span>
                <span className="gcal-calendar-name">Holidays in United States</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar View */}
        <div className="gcal-calendar-view">
          {/* Week Header */}
          <div className="gcal-week-header">
            <div className="gcal-timezone">GMT-07</div>
            {weekDates.map((date, i) => (
              <div key={i} className={`gcal-day-header ${isToday(date) ? 'gcal-today' : ''}`}>
                <div className="gcal-day-name">
                  {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                </div>
                <div className={`gcal-day-number ${isToday(date) ? 'gcal-today-number' : ''}`}>
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Time Grid */}
          <div className="gcal-time-grid-container">
            <div className="gcal-time-grid">
              <div className="gcal-time-column">
                {renderTimeSlots()}
              </div>
              <div className="gcal-days-container">
                {renderDayColumns()}
                <div className="gcal-events-container">
                  {renderEvents()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {showModal && (
        <div className="gcal-modal-overlay" onClick={closeModal}>
          <div className="gcal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gcal-modal-header">
              <h2>{editingEventId ? 'Edit event' : 'Create event'}</h2>
              <button className="gcal-modal-close" onClick={closeModal}>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                </svg>
              </button>
            </div>
            
            <div className="gcal-modal-form">
              <div className="gcal-form-group">
                <input
                  type="text"
                  className="gcal-form-input gcal-title-input"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                  placeholder="Add title"
                  required
                  autoFocus
                />
              </div>
              
              <div className="gcal-form-row">
                <div className="gcal-form-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" fill="#5f6368"/>
                  </svg>
                </div>
                <div className="gcal-form-inputs">
                  <input
                    type="date"
                    className="gcal-form-input"
                    value={eventForm.date}
                    onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
                    required
                  />
                  <div className="gcal-time-inputs">
                    <input
                      type="time"
                      className="gcal-form-input"
                      value={eventForm.startTime}
                      onChange={(e) => setEventForm({...eventForm, startTime: e.target.value})}
                    />
                    <span>–</span>
                    <input
                      type="time"
                      className="gcal-form-input"
                      value={eventForm.endTime}
                      onChange={(e) => setEventForm({...eventForm, endTime: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              
              <div className="gcal-form-row">
                <div className="gcal-form-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#5f6368"/>
                  </svg>
                </div>
                <input
                  type="text"
                  className="gcal-form-input"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                  placeholder="Add location"
                />
              </div>
              
              <div className="gcal-form-row">
                <div className="gcal-form-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z" fill="#5f6368"/>
                  </svg>
                </div>
                <textarea
                  className="gcal-form-input gcal-form-textarea"
                  value={eventForm.description}
                  onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                  placeholder="Add description"
                  rows={3}
                />
              </div>
              
              <div className="gcal-modal-actions">
                {editingEventId && (
                  <button 
                    type="button" 
                    className="gcal-btn gcal-btn-delete"
                    onClick={() => {
                      if (confirm('Delete this event?')) {
                        deleteEvent(editingEventId);
                        closeModal();
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
                <div className="gcal-modal-actions-right">
                  <button type="button" className="gcal-btn gcal-btn-cancel" onClick={closeModal}>
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="gcal-btn gcal-btn-save"
                    onClick={handleSubmit}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;