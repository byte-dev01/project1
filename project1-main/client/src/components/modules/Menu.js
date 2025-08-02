import React, { useState, useEffect } from 'react';
import './Menu.css';
import {
  Stethoscope,
  Video,
  Calendar,
  Monitor,
  Users,
  MapPin,
  Mail,
  HelpCircle,
  FileText,
  Phone,
  CheckSquare,
  ClipboardList,
  FlaskConical,
  Pill,
  BarChart3,
  DollarSign,
  TrendingUp,
  Search,
  Syringe, SyringeIcon,
  X,
  ChevronRight,
  ChevronLeft,
  FileHeart
} from 'lucide-react';

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

  const openPopupWindow = (url, title) => {
    const width = 800;
    const height = 600;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    const features = `
      width=${width},
      height=${height},
      left=${left},
      top=${top},
      resizable=yes,
      scrollbars=yes,
      toolbar=no,
      menubar=no,
      location=no,
      status=no
    `;

    window.open(url, title, features);
  };

  // Store the actual icon components, not strings
  const menuSections = [
    {
      id: 'findCare',
      title: 'Find Care',
      items: [
        { icon: Stethoscope, label: 'Symptom Checker', href: 'MenuItems/symptom-checker.html', popup: true },
        { icon: Video, label: 'Immediate Care Video Visits', href: 'MenuItems/ImmediateCare.html', popup: true },
        { icon: Calendar, label: 'Schedule an Appointment', href: 'MenuItems/schedule', popup: false },
        { icon: Monitor, label: 'E-Visit', href: '/evisit', popup: true },
        { icon: Users, label: 'View Care Team', href: 'MenuItems/CareTeam.html', popup: false },
        { icon: MapPin, label: 'Find Immediate Care', href: 'MenuItems/FindLocation.html', popup: true }
      ]
    },
    {
      id: 'communication',
      title: 'Communication',
      items: [
        { icon: Mail, label: 'My Messages', href: 'MenuItems/ProviderMessage', popup: true },
        { icon: HelpCircle, label: 'Ask a Question', href: '/ask-question', popup: true },
        { icon: FileText, label: 'Letters', href: 'MenuItems/Letter.html', popup: true },
        { icon: Phone, label: 'Clinic Calls', href: 'MenuItems/ContactPage.html', popup: true }
      ]
    },
    {
      id: 'myRecord',
      title: 'My Record',
      items: [
        { icon: SyringeIcon, label: 'COVID-19', href: 'MenuItems/Covid.html', popup: true },
        { icon: CheckSquare, label: 'To Do', href: '/todo', popup: true },
        { icon: ClipboardList, label: 'Visits/Clinical Notes', href: 'MenuItems/Documents.html', popup: true },
        { icon: FlaskConical, label: 'Test Results', href: 'MenuItems/TestResults.html', popup: true },
        { icon: Pill, label: 'Medications', href: 'MenuItems/Medications', popup: true },
        { icon: BarChart3, label: 'Health Summary', href: 'MenuItems/HealthHistory.html', popup: true }
      ]
    },
    {
      id: 'billing',
      title: 'Billing',
      items: [
        { icon: DollarSign, label: 'Billing Summary', href: 'MenuItems/BillingSummary.html', popup: false },
        { icon: FileHeart, label: 'Insurance', href: 'MenuItems/InsurancePage.html', popup: false },

        { icon: TrendingUp, label: 'Estimates', href: '/estimates', popup: true }
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
                <ChevronLeft className="menu-buttonicon" size={20} />
              </button>
              <h1 className="menu-contextlabel">Menu</h1>
            </div>
            
            {/* Search */}
            <div className="menu-searchcontainer">
              <div className="menu-searchbarcontainer">
                <Search className="menu-searchicon" size={20} />
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
                    <X className="menu-searchemptyicon" size={16} />
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
                  <ChevronRight 
                    className={`submenu-arrow ${expandedSections[section.id] ? 'expanded' : ''}`}
                    size={20}
                  />
                </h2>
                {expandedSections[section.id] && (
                  <ul aria-label={section.title}>
                    {section.items.map((item, index) => {
                      const IconComponent = item.icon;
                      return (
                        <li key={index} className="menuitem">
                          <a 
                            className="menuitem-content"
                            href={item.href}
                            onClick={(e) => {
                              e.preventDefault();
                              
                              if (item.popup) {
                                // Open in popup window
                                openPopupWindow(item.href, item.label);
                              } else {
                                // Navigate normally
                                window.location.href = item.href;
                              }
                              
                              onClose();
                            }}
                          >
                            <span className="menuitem-icon">
                              <IconComponent size={20} />
                            </span>
                            <div className="menuitem-label">
                              {item.label}
                              {item.popup && <span className="popup-indicator"> ↗</span>}
                            </div>
                          </a>
                        </li>
                      );
                    })}
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