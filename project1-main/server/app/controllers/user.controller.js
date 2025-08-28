const db = require("../models");
const User = db.user;

exports.allAccess = (req, res) => {
  res.status(200).json({
    message: "Public Content",
    availableRoutes: ["/login", "/signup"]
  });
};

exports.userBoard = async (req, res) => {
  try {
    // Get user-specific data from token
    const userId = req.userId;
    const user = await User.findById(userId)
      .select('-password')
      .populate('roles', 'name');
    
    res.status(200).json({
      message: "User Dashboard",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name
      },
      availableRoutes: [
        "/dashboard",
        "/chat",
        `/profile/${userId}`,
        "/calendar"
      ],
      features: {
        canViewDashboard: true,
        canChat: true,
        canViewProfile: true,
        canViewCalendar: true
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.adminBoard = async (req, res) => {
  try {
    const userId = req.userId;
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    
    res.status(200).json({
      message: "Admin Dashboard",
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers
      },
      availableRoutes: [
        "/dashboard",
        "/chat",
        `/profile/${userId}`,
        "/calendar",
        `/upload/${userId}`,
        `/recorder/${userId}`,
        "/fax-dashboard",
        "/medical-management",
        "/admin"
      ],
      features: {
        canViewDashboard: true,
        canChat: true,
        canViewProfile: true,
        canViewCalendar: true,
        canUpload: true,
        canRecord: true,
        canManageFax: true,
        canManageMedical: true,
        canAccessAdmin: true,
        canManageUsers: true,
        canManageRoles: true,
        canViewAnalytics: true
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.moderatorBoard = async (req, res) => {
  try {
    const userId = req.userId;
    
    res.status(200).json({
      message: "Moderator Dashboard",
      availableRoutes: [
        "/dashboard",
        "/chat",
        `/profile/${userId}`,
        "/calendar",
        `/upload/${userId}`,
        `/recorder/${userId}`,
        "/fax-dashboard",
        "/medical-management"
      ],
      features: {
        canViewDashboard: true,
        canChat: true,
        canViewProfile: true,
        canViewCalendar: true,
        canUpload: true,
        canRecord: true,
        canManageFax: true,
        canManageMedical: true,
        canModerateContent: true,
        canViewReports: true
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.doctorBoard = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    
    res.status(200).json({
      message: "Doctor Dashboard",
      doctorInfo: {
        name: user.name,
        specialization: user.specialization || "General Practice",
        licenseNumber: user.licenseNumber || "N/A"
      },
      availableRoutes: [
        "/dashboard",
        "/chat",
        `/profile/${userId}`,
        "/calendar",
        `/upload/${userId}`,
        `/recorder/${userId}`,
        "/fax-dashboard",
        "/medical-management"
      ],
      features: {
        canViewDashboard: true,
        canChat: true,
        canViewProfile: true,
        canViewCalendar: true,
        canUpload: true,
        canRecord: true,
        canManageFax: true,
        canManageMedical: true,
        canViewPatients: true,
        canWritePrescriptions: true,
        canViewMedicalRecords: true,
        canScheduleAppointments: true
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.staffBoard = async (req, res) => {
  try {
    const userId = req.userId;
    
    res.status(200).json({
      message: "Staff Dashboard",
      availableRoutes: [
        "/dashboard",
        "/chat",
        `/profile/${userId}`,
        "/calendar",
        `/upload/${userId}`
      ],
      features: {
        canViewDashboard: true,
        canChat: true,
        canViewProfile: true,
        canViewCalendar: true,
        canUpload: true,
        canViewAppointments: true,
        canManageSchedule: true
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// New: Dynamic dashboard that returns content based on user's actual role
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId)
      .populate('roles', 'name')
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's roles
    const roleNames = user.roles.map(role => role.name);
    
    // Determine highest privilege role
    let primaryRole = 'user';
    if (roleNames.includes('admin')) {
      primaryRole = 'admin';
    } else if (roleNames.includes('doctor')) {
      primaryRole = 'doctor';
    } else if (roleNames.includes('moderator')) {
      primaryRole = 'moderator';
    } else if (roleNames.includes('staff')) {
      primaryRole = 'staff';
    }

    // Build response based on role
    const baseInfo = {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        roles: roleNames,
        primaryRole,
        clinicId: user.clinicId,
        clinicName: user.clinicName
      },
      timestamp: new Date().toISOString()
    };

    // Add role-specific content
    switch (primaryRole) {
      case 'admin':
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        return res.json({
          ...baseInfo,
          dashboard: {
            type: 'admin',
            title: 'Admin Dashboard',
            stats: {
              totalUsers,
              activeUsers,
              inactiveUsers: totalUsers - activeUsers
            },
            quickActions: [
              { label: 'Manage Users', path: '/admin/users' },
              { label: 'View Reports', path: '/admin/reports' },
              { label: 'System Settings', path: '/admin/settings' }
            ],
            availableFeatures: [
              'userManagement', 'systemSettings', 'analytics', 
              'faxManagement', 'medicalRecords', 'audioRecording'
            ]
          }
        });

      case 'doctor':
        return res.json({
          ...baseInfo,
          dashboard: {
            type: 'doctor',
            title: 'Doctor Dashboard',
            todayStats: {
              appointments: 0, // Would be fetched from appointments collection
              pendingReviews: 0,
              messages: 0
            },
            quickActions: [
              { label: 'View Patients', path: '/patients' },
              { label: 'Audio Recorder', path: `/recorder/${userId}` },
              { label: 'Fax Dashboard', path: '/fax-dashboard' }
            ],
            availableFeatures: [
              'patientRecords', 'audioRecording', 'faxManagement', 
              'prescriptions', 'medicalManagement'
            ]
          }
        });

      case 'moderator':
        return res.json({
          ...baseInfo,
          dashboard: {
            type: 'moderator',
            title: 'Moderator Dashboard',
            pendingItems: {
              reports: 0,
              reviews: 0,
              approvals: 0
            },
            quickActions: [
              { label: 'Review Queue', path: '/moderator/queue' },
              { label: 'Fax Dashboard', path: '/fax-dashboard' },
              { label: 'Medical Management', path: '/medical-management' }
            ],
            availableFeatures: [
              'contentModeration', 'faxManagement', 'medicalManagement',
              'audioRecording', 'reporting'
            ]
          }
        });

      case 'staff':
        return res.json({
          ...baseInfo,
          dashboard: {
            type: 'staff',
            title: 'Staff Dashboard',
            todayTasks: {
              appointments: 0,
              uploads: 0,
              messages: 0
            },
            quickActions: [
              { label: 'Upload Files', path: `/upload/${userId}` },
              { label: 'Calendar', path: '/calendar' },
              { label: 'Messages', path: '/chat' }
            ],
            availableFeatures: [
              'fileUpload', 'calendar', 'messaging', 'basicReports'
            ]
          }
        });

      default:
        return res.json({
          ...baseInfo,
          dashboard: {
            type: 'user',
            title: 'User Dashboard',
            quickActions: [
              { label: 'View Profile', path: `/profile/${userId}` },
              { label: 'Calendar', path: '/calendar' },
              { label: 'Chat', path: '/chat' }
            ],
            availableFeatures: [
              'profile', 'calendar', 'messaging'
            ]
          }
        });
    }
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ 
      message: "Error loading dashboard",
      error: error.message 
    });
  }
};