import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Link
} from '@mui/material';
import {
  Lock,
  Smartphone,
  Apps,
  VpnKey
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const MFAVerification = ({ tempToken, availableMethods, onSuccess, onCancel }) => {
  const [selectedMethod, setSelectedMethod] = useState(availableMethods[0] || 'totp');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [smsSent, setSmsSent] = useState(false);

  const methodIcons = {
    totp: <Apps />,
    sms: <Smartphone />,
    backup_codes: <VpnKey />
  };

  const methodLabels = {
    totp: 'Authenticator App',
    sms: 'SMS Text Message',
    backup_codes: 'Backup Code'
  };

  const handleMethodChange = (event, newMethod) => {
    if (newMethod) {
      setSelectedMethod(newMethod);
      setVerificationCode('');
      setError('');
      setAttemptsRemaining(null);
      setSmsSent(false);
    }
  };

  const requestSMSCode = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.post(`${API_BASE}/api/mfa/challenge/create`, {
        tempToken,
        method: 'sms'
      });

      setVerificationId(response.data.data.verificationId);
      setSmsSent(true);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send SMS code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async () => {
    try {
      setLoading(true);
      setError('');

      let response;
      const verificationData = {
        tempToken,
        method: selectedMethod,
        response: {}
      };

      switch (selectedMethod) {
        case 'totp':
          verificationData.response = { token: verificationCode };
          break;
        case 'sms':
          verificationData.response = { 
            verificationId,
            code: verificationCode 
          };
          break;
        case 'backup_codes':
          verificationData.response = { code: verificationCode };
          break;
        default:
          throw new Error('Invalid method');
      }

      response = await axios.post(
        `${API_BASE}/api/auth/mfa/verify`,
        verificationData
      );

      if (response.data.success) {
        onSuccess(response.data);
      }
    } catch (err) {
      const errorData = err.response?.data;
      setError(errorData?.message || 'Verification failed');
      
      if (errorData?.attemptsRemaining !== undefined) {
        setAttemptsRemaining(errorData.attemptsRemaining);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && verificationCode) {
      handleVerification();
    }
  };

  return (
    <Card sx={{ maxWidth: 450, mx: 'auto' }}>
      <CardContent>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Lock sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Two-Factor Authentication
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please verify your identity to continue
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
            {attemptsRemaining !== null && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Attempts remaining: {attemptsRemaining}
              </Typography>
            )}
          </Alert>
        )}

        {availableMethods.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Choose verification method:
            </Typography>
            <ToggleButtonGroup
              value={selectedMethod}
              exclusive
              onChange={handleMethodChange}
              fullWidth
              sx={{ mb: 2 }}
            >
              {availableMethods.map((method) => (
                <ToggleButton key={method} value={method}>
                  {methodIcons[method]}
                  <Box sx={{ ml: 1 }}>
                    <Typography variant="caption">
                      {methodLabels[method]}
                    </Typography>
                  </Box>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        {selectedMethod === 'sms' && !smsSent && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              We'll send a verification code to your registered phone number.
            </Typography>
            <Button
              variant="contained"
              onClick={requestSMSCode}
              disabled={loading}
              fullWidth
              startIcon={<Smartphone />}
            >
              Send SMS Code
            </Button>
          </Box>
        )}

        {(selectedMethod !== 'sms' || smsSent) && (
          <>
            <TextField
              label={
                selectedMethod === 'totp' 
                  ? 'Enter 6-digit code from app'
                  : selectedMethod === 'sms'
                  ? 'Enter SMS code'
                  : 'Enter backup code'
              }
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              onKeyPress={handleKeyPress}
              fullWidth
              autoFocus
              sx={{ mb: 3 }}
              disabled={loading}
              inputProps={{
                autoComplete: 'one-time-code',
                inputMode: 'numeric',
                pattern: selectedMethod === 'backup_codes' ? '[A-Za-z0-9]*' : '[0-9]*'
              }}
            />

            <Button
              variant="contained"
              onClick={handleVerification}
              disabled={loading || !verificationCode}
              fullWidth
              size="large"
              sx={{ mb: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Verify'}
            </Button>
          </>
        )}

        {selectedMethod === 'sms' && smsSent && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Link
              component="button"
              variant="body2"
              onClick={requestSMSCode}
              disabled={loading}
            >
              Resend code
            </Link>
          </Box>
        )}

        <Box sx={{ textAlign: 'center' }}>
          <Link
            component="button"
            variant="body2"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel and return to login
          </Link>
        </Box>

        {selectedMethod === 'backup_codes' && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="caption">
              Each backup code can only be used once. After using a backup code, 
              consider setting up your primary MFA method again.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default MFAVerification;