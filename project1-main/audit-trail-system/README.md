# Audit Trail Visualization System

A comprehensive HIPAA-compliant audit trail system for tracking and visualizing all PHI access and system activities in your medical management application.

## Features

### Core Functionality
- Real-time audit logging of all PHI access and modifications
- User activity tracking with role-based permissions
- Anomaly detection for suspicious activities
- Comprehensive filtering and search capabilities
- Data export in CSV and JSON formats
- Visual dashboards with charts and statistics

### Security & Compliance
- HIPAA-compliant audit logging
- Severity-based alerting system
- Failed login attempt monitoring
- Permission denial tracking
- IP address and session tracking
- Emergency access flagging

## Installation

### Prerequisites
```bash
npm install mongoose winston jsonwebtoken express
npm install react recharts lucide-react
```

### Backend Setup

1. Import the audit service in your main server file:
```javascript
const auditRoutes = require('./audit-trail-system/backend/auditRoutes');
app.use('/api', auditRoutes);
```

2. Connect to MongoDB:
```javascript
mongoose.connect('mongodb://localhost:27017/medical_audit', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
```

3. Set environment variables:
```bash
JWT_SECRET=your-secret-key
MONGODB_URI=mongodb://localhost:27017/medical_audit
```

### Frontend Integration

1. Import the dashboard component:
```jsx
import AuditDashboard from './audit-trail-system/frontend/AuditDashboard';
```

2. Add to your routing:
```jsx
<Route path="/audit" component={AuditDashboard} />
```

## Usage

### Middleware Integration

Use the audit middleware in your routes:

```javascript
const { auditPHIAccess, auditPHIUpdate } = require('./audit-trail-system/shared/auditMiddleware');

// Track PHI access
router.get('/patient/:id', auditPHIAccess, (req, res) => {
  // Your route logic
});

// Track PHI updates
router.put('/patient/:id', auditPHIUpdate, (req, res) => {
  // Your route logic
});
```

### Manual Audit Logging

```javascript
const auditService = require('./audit-trail-system/backend/auditService');

await auditService.logAudit({
  action: 'VIEW_LAB_RESULT',
  resourceType: 'lab_result',
  resourceId: labId,
  patientId: patientId,
  userId: req.user.id,
  userRole: req.user.role,
  userEmail: req.user.email,
  ipAddress: req.ip,
  success: true
});
```

### Authentication Integration

```javascript
const { auditLogin, auditLogout } = require('./audit-trail-system/shared/auditMiddleware');

// On login
await auditLogin(user, success, req.ip, req.get('user-agent'));

// On logout
await auditLogout(user, req.ip, req.get('user-agent'), req.sessionID);
```

## API Endpoints

### Audit Logs
- `GET /api/audit/logs` - Retrieve audit logs with filtering
- `GET /api/audit/statistics` - Get dashboard statistics
- `GET /api/audit/user/:userId/activity` - User activity report
- `GET /api/audit/my-activity` - Current user's activity
- `GET /api/audit/anomalies` - Detect security anomalies
- `GET /api/audit/export` - Export audit logs

### Query Parameters
- `userId` - Filter by user ID
- `patientId` - Filter by patient ID
- `action` - Filter by action type
- `severity` - Filter by severity level
- `startDate` - Start date for date range
- `endDate` - End date for date range
- `page` - Page number for pagination
- `limit` - Results per page

## Dashboard Features

### Statistics Overview
- Total actions performed
- Active users count
- Failed actions tracking
- Critical events monitoring

### Visual Analytics
- Activity timeline chart
- Action distribution bar chart
- Severity distribution pie chart
- Real-time anomaly alerts

### Filtering Options
- User ID search
- Patient ID search
- Action type filtering
- Severity level filtering
- Date range selection

## Security Considerations

1. **Access Control**: Dashboard restricted to admin and compliance officer roles
2. **Data Retention**: Configure retention policies based on compliance requirements
3. **Encryption**: Ensure MongoDB connection uses TLS
4. **Rate Limiting**: Implement rate limiting on audit endpoints
5. **Monitoring**: Set up alerts for critical severity events

## Anomaly Detection

The system automatically detects:
- Multiple failed login attempts from same IP
- Unusual PHI access patterns
- Bulk data exports
- After-hours access attempts
- Geographic access anomalies

## Compliance Notes

This system helps meet HIPAA requirements for:
- § 164.312(b) - Audit controls
- § 164.308(a)(1)(ii)(D) - Information system activity review
- § 164.312(c)(1) - Integrity controls
- § 164.308(a)(5)(ii)(C) - Log-in monitoring

## Performance Optimization

- Indexed fields for fast queries
- Pagination for large datasets
- Caching for statistics
- Asynchronous logging to prevent blocking
- Batch export capabilities

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check MongoDB connection and authentication middleware
2. **Export failing**: Verify user permissions and data size limits
3. **Statistics not updating**: Check the refresh interval and data aggregation pipeline
4. **Anomaly alerts not triggering**: Review threshold settings and detection rules

## License

Part of the Medical Management Application
HIPAA-compliant audit trail system