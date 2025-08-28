import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  TextField, 
  Typography, 
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Grid,
  CircularProgress,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import {
  Security,
  PhoneAndroid,
  QrCode2,
  ContentCopy,
  Delete,
  CheckCircle,
  Warning
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const MFASetup = ({ userId, token, onComplete }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [mfaStatus, setMfaStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // TOTP Setup State
  const [totpSecret, setTotpSecret] = useState('');
  const [totpQRCode, setTotpQRCode] = useState('');
  const [totpVerificationCode, setTotpVerificationCode] = useState('');
  const [totpStep, setTotpStep] = useState(0);

  // SMS Setup State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsVerificationId, setSmsVerificationId] = useState('');
  const [smsVerificationCode, setSmsVerificationCode] = useState('');
  const [smsStep, setSmsStep] = useState(0);

  // Backup Codes State
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupDialog, setShowBackupDialog] = useState(false);

  useEffect(() => {
    fetchMFAStatus();
  }, []);

  const fetchMFAStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/mfa/status`, {
        headers: {
          'x-access-token': token
        }
      });
      setMfaStatus(response.data.data);
    } catch (err) {
      setError('Failed to fetch MFA status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // TOTP Setup Methods
  const initiateTOTPSetup = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.post(
        `${API_BASE}/api/mfa/totp/setup`,
        {},
        {
          headers: {
            'x-access-token': token
          }
        }
      );
      
      setTotpSecret(response.data.data.manualEntryKey);
      setTotpQRCode(response.data.data.qrCode);
      setTotpStep(1);
      setSuccess('TOTP setup initiated. Scan the QR code with your authenticator app.');
    } catch (err) {
      setError('Failed to setup TOTP');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const verifyTOTP = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.post(
        `${API_BASE}/api/mfa/totp/verify`,
        { token: totpVerificationCode },
        {
          headers: {
            'x-access-token': token
          }
        }
      );
      
      setSuccess('TOTP authentication enabled successfully!');
      setTotpStep(2);
      setTimeout(() => {
        fetchMFAStatus();
        setTotpStep(0);
        setTotpVerificationCode('');
      }, 2000);
    } catch (err) {
      setError('Invalid verification code. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // SMS Setup Methods
  const initiateSMSSetup = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.post(
        `${API_BASE}/api/mfa/sms/setup`,
        { phoneNumber },
        {
          headers: {
            'x-access-token': token
          }
        }
      );
      
      setSmsVerificationId(response.data.data.verificationId);
      setSmsStep(1);
      setSuccess(`Verification code sent to ${response.data.data.phoneNumber}`);
    } catch (err) {
      setError('Failed to setup SMS authentication');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const verifySMS = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.post(
        `${API_BASE}/api/mfa/sms/verify`,
        { 
          verificationId: smsVerificationId,
          code: smsVerificationCode 
        },
        {
          headers: {
            'x-access-token': token
          }
        }
      );
      
      setSuccess('SMS authentication enabled successfully!');
      setSmsStep(2);
      setTimeout(() => {
        fetchMFAStatus();
        setSmsStep(0);
        setSmsVerificationCode('');
        setPhoneNumber('');
      }, 2000);
    } catch (err) {
      setError('Invalid verification code. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resendSMS = async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${API_BASE}/api/mfa/sms/resend`,
        { phoneNumber },
        {
          headers: {
            'x-access-token': token
          }
        }
      );
      
      setSmsVerificationId(response.data.data.verificationId);
      setSuccess('New verification code sent');
    } catch (err) {
      setError('Failed to resend verification code');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Backup Codes Methods
  const generateBackupCodes = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.post(
        `${API_BASE}/api/mfa/backup-codes/generate`,
        {},
        {
          headers: {
            'x-access-token': token
          }
        }
      );
      
      setBackupCodes(response.data.data.codes);
      setShowBackupDialog(true);
      setSuccess('Backup codes generated successfully');
      fetchMFAStatus();
    } catch (err) {
      setError('Failed to generate backup codes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard');
  };

  const downloadBackupCodes = () => {
    const content = backupCodes.join('\n');
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'mfa-backup-codes.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const disableMethod = async (method) => {
    if (!window.confirm(`Are you sure you want to disable ${method} authentication?`)) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(
        `${API_BASE}/api/mfa/methods/${method}`,
        {
          headers: {
            'x-access-token': token
          }
        }
      );
      
      setSuccess(`${method} authentication disabled`);
      fetchMFAStatus();
    } catch (err) {
      setError(`Failed to disable ${method} authentication`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !mfaStatus) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          <Security sx={{ mr: 1, verticalAlign: 'middle' }} />
          Multi-Factor Authentication Setup
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {mfaStatus && (
          <Alert severity={mfaStatus.enabled ? "success" : "info"} sx={{ mb: 2 }}>
            MFA Status: {mfaStatus.enabled ? 'Enabled' : 'Disabled'}
            {mfaStatus.enforced && ' (Required)'}
          </Alert>
        )}

        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 3 }}>
          <Tab label="Authenticator App" />
          <Tab label="SMS" />
          <Tab label="Backup Codes" />
          <Tab label="Active Methods" />
        </Tabs>

        {/* TOTP Setup Tab */}
        {activeTab === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Authenticator App (TOTP)
            </Typography>
            
            <Stepper activeStep={totpStep} sx={{ mb: 3 }}>
              <Step>
                <StepLabel>Setup</StepLabel>
              </Step>
              <Step>
                <StepLabel>Verify</StepLabel>
              </Step>
              <Step>
                <StepLabel>Complete</StepLabel>
              </Step>
            </Stepper>

            {totpStep === 0 && (
              <Box>
                <Typography variant="body2" paragraph>
                  Use an authenticator app like Google Authenticator, Microsoft Authenticator, or Authy 
                  to generate time-based verification codes.
                </Typography>
                <Button
                  variant="contained"
                  onClick={initiateTOTPSetup}
                  disabled={loading}
                  startIcon={<QrCode2 />}
                >
                  Setup Authenticator App
                </Button>
              </Box>
            )}

            {totpStep === 1 && (
              <Box>
                {totpQRCode && (
                  <Box textAlign="center" mb={2}>
                    <img src={totpQRCode} alt="TOTP QR Code" style={{ maxWidth: '300px' }} />
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      Scan this QR code with your authenticator app
                    </Typography>
                  </Box>
                )}
                
                <Box mb={2}>
                  <Typography variant="body2" gutterBottom>
                    Manual entry key:
                  </Typography>
                  <Box display="flex" alignItems="center">
                    <TextField
                      value={totpSecret}
                      disabled
                      size="small"
                      fullWidth
                      sx={{ mr: 1 }}
                    />
                    <IconButton onClick={() => copyToClipboard(totpSecret)}>
                      <ContentCopy />
                    </IconButton>
                  </Box>
                </Box>

                <TextField
                  label="Verification Code"
                  value={totpVerificationCode}
                  onChange={(e) => setTotpVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  fullWidth
                  sx={{ mb: 2 }}
                />

                <Button
                  variant="contained"
                  onClick={verifyTOTP}
                  disabled={loading || !totpVerificationCode}
                  fullWidth
                >
                  Verify and Enable
                </Button>
              </Box>
            )}

            {totpStep === 2 && (
              <Box textAlign="center">
                <CheckCircle color="success" sx={{ fontSize: 60, mb: 2 }} />
                <Typography variant="h6" color="success.main">
                  Authenticator app enabled successfully!
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* SMS Setup Tab */}
        {activeTab === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              SMS Authentication
            </Typography>
            
            <Stepper activeStep={smsStep} sx={{ mb: 3 }}>
              <Step>
                <StepLabel>Phone Number</StepLabel>
              </Step>
              <Step>
                <StepLabel>Verify</StepLabel>
              </Step>
              <Step>
                <StepLabel>Complete</StepLabel>
              </Step>
            </Stepper>

            {smsStep === 0 && (
              <Box>
                <Typography variant="body2" paragraph>
                  Receive verification codes via SMS text message.
                </Typography>
                <TextField
                  label="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <Button
                  variant="contained"
                  onClick={initiateSMSSetup}
                  disabled={loading || !phoneNumber}
                  startIcon={<PhoneAndroid />}
                >
                  Send Verification Code
                </Button>
              </Box>
            )}

            {smsStep === 1 && (
              <Box>
                <TextField
                  label="Verification Code"
                  value={smsVerificationCode}
                  onChange={(e) => setSmsVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Button
                      variant="contained"
                      onClick={verifySMS}
                      disabled={loading || !smsVerificationCode}
                      fullWidth
                    >
                      Verify
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      onClick={resendSMS}
                      disabled={loading}
                      fullWidth
                    >
                      Resend Code
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            )}

            {smsStep === 2 && (
              <Box textAlign="center">
                <CheckCircle color="success" sx={{ fontSize: 60, mb: 2 }} />
                <Typography variant="h6" color="success.main">
                  SMS authentication enabled successfully!
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Backup Codes Tab */}
        {activeTab === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Backup Recovery Codes
            </Typography>
            <Typography variant="body2" paragraph>
              Generate one-time use backup codes that can be used to access your account 
              if you lose access to your primary MFA method.
            </Typography>
            
            <Button
              variant="contained"
              onClick={generateBackupCodes}
              disabled={loading}
              color="warning"
            >
              Generate New Backup Codes
            </Button>

            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Generating new codes will invalidate all existing backup codes.
              </Typography>
            </Alert>
          </Box>
        )}

        {/* Active Methods Tab */}
        {activeTab === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Active MFA Methods
            </Typography>
            
            {mfaStatus && mfaStatus.methods.length > 0 ? (
              <List>
                {mfaStatus.methods.map((method) => (
                  <ListItem key={method.type}>
                    <ListItemText
                      primary={method.type.toUpperCase()}
                      secondary={`Last used: ${
                        method.lastUsedAt 
                          ? new Date(method.lastUsedAt).toLocaleDateString() 
                          : 'Never'
                      }`}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={`Priority: ${method.priority}`}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      <IconButton
                        edge="end"
                        onClick={() => disableMethod(method.type)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No MFA methods configured
              </Typography>
            )}
          </Box>
        )}

        {/* Backup Codes Dialog */}
        <Dialog 
          open={showBackupDialog} 
          onClose={() => setShowBackupDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Warning color="warning" sx={{ mr: 1, verticalAlign: 'middle' }} />
            Save Your Backup Codes
          </DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Store these codes in a safe place. Each code can only be used once.
            </Alert>
            <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              {backupCodes.map((code, index) => (
                <Typography key={index} variant="mono" sx={{ fontFamily: 'monospace' }}>
                  {index + 1}. {code}
                </Typography>
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => copyToClipboard(backupCodes.join('\n'))}>
              Copy All
            </Button>
            <Button onClick={downloadBackupCodes}>
              Download
            </Button>
            <Button onClick={() => setShowBackupDialog(false)} variant="contained">
              I've Saved Them
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default MFASetup;