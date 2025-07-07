import React, { useState, useEffect } from 'react';
import './Menu.css';

const Menu = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    findCare: true,
    communication: true,
    myRecord: false,
    billing: false,
    insurance: false,
    sharing: false,
    resources: false,
    accountSettings: false
  });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && e.target.classList.contains('menu-shield')) {
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen, onClose]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const menuSections = [
    {
      id: 'findCare',
      title: 'Find Care',
      items: [
        { icon: '🩺', label: 'Symptom Checker', href: '/symptom-checker' },
        { icon: '📹', label: 'Immediate Care Video Visits', href: '/telehealth' },
        { icon: '📅', label: 'Schedule an Appointment', href: '/scheduling' },
        { icon: '💻', label: 'E-Visit', href: '/evisit' },
        { icon: '👥', label: 'View Care Team', href: '/care-team' },
        { icon: '🏥', label: 'Find Immediate Care', href: '/immediate-care' }
      ]
    },
    {
      id: 'communication',
      title: 'Communication',
      items: [
        { icon: '✉️', label: 'My Messages', href: '/chat' },
        { icon: '❓', label: 'Ask a Question', href: '/ask-question' },
        { icon: '📄', label: 'Letters', href: '/letters' },
        { icon: '📞', label: 'Clinic Calls', href: '/clinic-calls' }
      ]
    },
    {
      id: 'myRecord',
      title: 'My Record',
      items: [
        { icon: '🦠', label: 'COVID-19', href: '/covid-status' },
        { icon: '✅', label: 'To Do', href: '/todo' },
        { icon: '📋', label: 'Visits/Clinical Notes', href: '/visits' },
        { icon: '🧪', label: 'Test Results', href: '/test-results' },
        { icon: '💊', label: 'Medications', href: '/medications' },
        { icon: '📊', label: 'Health Summary', href: '/health-summary' }
      ]
    },
    {
      id: 'billing',
      title: 'Billing',
      items: [
        { icon: '💰', label: 'Billing Summary', href: '/billing' },
        { icon: '📈', label: 'Estimates', href: '/estimates' }
      ]
    }
  ];

  return (
    <>
      <div className={`menu-shield ${isOpen ? 'menu-shieldopen' : ''}`} />
      <nav className={`menu-container ${isOpen ? 'menu-open' : ''}`}>
        <div className="menu-flexparent">
          {/* Header */}
          <div className="menu-header">
            <div className="menu-headertop">
              <button 
                className="menu-closebutton"
                onClick={onClose}
                aria-label="Close"
                title="Close the menu"
              >
                <svg className="menu-buttonicon" viewBox="0 0 24 24">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              </button>
              <h1 className="menu-contextlabel">Menu</h1>
            </div>
            
            {/* Search */}
            <div className="menu-searchcontainer">
              <div className="menu-searchbarcontainer">
                <svg className="menu-searchicon" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search the menu"
                  className="menu-searchbar"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search the menu"
                />
                {searchQuery && (
                  <button 
                    className="menu-searchemptybutton"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search field"
                  >
                    <svg className="menu-searchemptyicon" viewBox="0 0 24 24">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Menu List */}
          <ul className="menu-mainmenulist">
            {menuSections.map(section => (
              <li key={section.id} className="submenu">
                <h2 
                  className="submenu-header"
                  onClick={() => toggleSection(section.id)}
                  title={section.title}
                >
                  {section.title}
                  <svg 
                    className={`submenu-arrow ${expandedSections[section.id] ? 'expanded' : ''}`}
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" fill="none"/>
                  </svg>
                </h2>
                {expandedSections[section.id] && (
                  <ul aria-label={section.title}>
                    {section.items.map((item, index) => (
                      <li key={index} className="menuitem">
                        <a 
                          className="menuitem-content"
                          href={item.href}
                          onClick={(e) => {
                            e.preventDefault();
                            // Handle navigation here
                            onClose();
                          }}
                        >
                          <span className="menuitem-icon">{item.icon}</span>
                          <div className="menuitem-label">{item.label}</div>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
};

export default Menu;
