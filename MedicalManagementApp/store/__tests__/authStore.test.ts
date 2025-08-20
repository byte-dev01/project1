import { renderHook, act } from '@testing-library/react-hooks';
import { useAuthStore } from '../authStore';
import { SecureStorageService } from '@/services/SecureStorageService';
import { SecureAPIClient } from '@/services/SecureAPIClient';
import { auditLog } from '@/core/compliance/AuditLog';
import * as LocalAuthentication from 'expo-local-authentication';

// Mock dependencies
jest.mock('@/services/SecureStorageService');
jest.mock('@/services/SecureAPIClient');
jest.mock('@/core/compliance/AuditLog');
jest.mock('expo-local-authentication');

describe('authStore', () => {
  const mockUser = {
    id: 'user-123',
    username: 'testdoctor',
    email: 'doctor@healthbridge.com',
    name: 'Dr. Test User',
    roles: ['doctor' as const],
    clinicId: 'clinic-456',
    clinicName: 'Test Clinic',
    permissions: ['read', 'write', 'prescribe'],
  };

  const mockCredentials = {
    username: 'testdoctor',
    password: 'SecurePassword123!',
    clinicId: 'clinic-456',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.logout();
    });
  });

  describe('login', () => {
    it('should successfully log in with valid credentials', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      (SecureAPIClient.post as jest.Mock).mockResolvedValue({
        user: mockUser,
        token: 'jwt-token-123',
      });
      
      let loginResult;
      await act(async () => {
        loginResult = await result.current.login(
          mockCredentials.username,
          mockCredentials.password,
          mockCredentials.clinicId
        );
      });
      
      expect(loginResult).toEqual({ success: true, user: mockUser });
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(SecureStorageService.setAuthToken).toHaveBeenCalledWith('jwt-token-123');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN',
          userId: mockUser.id,
        })
      );
    });

    it('should handle invalid credentials', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      (SecureAPIClient.post as jest.Mock).mockRejectedValue(
        new Error('Invalid credentials')
      );
      
      let loginResult;
      await act(async () => {
        loginResult = await result.current.login(
          'wronguser',
          'wrongpassword',
          'clinic-456'
        );
      });
      
      expect(loginResult).toEqual({
        success: false,
        error: 'Invalid credentials',
      });
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
        })
      );
    });

    it('should enforce account lockout after failed attempts', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      (SecureAPIClient.post as jest.Mock).mockRejectedValue(
        new Error('Invalid credentials')
      );
      
      // Attempt login 5 times
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await result.current.login('user', 'wrong', 'clinic');
        });
      }
      
      // 6th attempt should be blocked
      let blockedResult;
      await act(async () => {
        blockedResult = await result.current.login('user', 'password', 'clinic');
      });
      
      expect(blockedResult).toEqual({
        success: false,
        error: expect.stringContaining('locked'),
      });
    });

    it('should validate password complexity', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      let weakPasswordResult;
      await act(async () => {
        weakPasswordResult = await result.current.login(
          'user',
          'weak', // Too short
          'clinic'
        );
      });
      
      expect(weakPasswordResult).toEqual({
        success: false,
        error: expect.stringContaining('password'),
      });
    });
  });

  describe('biometric authentication', () => {
    it('should authenticate with biometrics when available', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      // First, regular login to store credentials
      (SecureAPIClient.post as jest.Mock).mockResolvedValue({
        user: mockUser,
        token: 'jwt-token-123',
      });
      
      await act(async () => {
        await result.current.login(
          mockCredentials.username,
          mockCredentials.password,
          mockCredentials.clinicId
        );
      });
      
      // Then logout
      await act(async () => {
        await result.current.logout();
      });
      
      // Now try biometric login
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
        success: true,
      });
      (SecureStorageService.getBiometricCredentials as jest.Mock).mockResolvedValue({
        username: mockCredentials.username,
        clinicId: mockCredentials.clinicId,
      });
      
      let biometricResult;
      await act(async () => {
        biometricResult = await result.current.loginWithBiometric();
      });
      
      expect(biometricResult).toEqual({ success: true, user: mockUser });
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Authenticate to access HealthBridge',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Password',
      });
    });

    it('should fall back to password when biometric fails', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
        success: false,
        error: 'user_cancel',
      });
      
      let biometricResult;
      await act(async () => {
        biometricResult = await result.current.loginWithBiometric();
      });
      
      expect(biometricResult).toEqual({
        success: false,
        error: 'Biometric authentication failed',
        fallbackToPassword: true,
      });
    });

    it('should handle devices without biometric hardware', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);
      
      let biometricResult;
      await act(async () => {
        biometricResult = await result.current.loginWithBiometric();
      });
      
      expect(biometricResult).toEqual({
        success: false,
        error: 'Biometric authentication not available',
      });
    });
  });

  describe('logout', () => {
    it('should clear all auth data on logout', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      // First login
      (SecureAPIClient.post as jest.Mock).mockResolvedValue({
        user: mockUser,
        token: 'jwt-token-123',
      });
      
      await act(async () => {
        await result.current.login(
          mockCredentials.username,
          mockCredentials.password,
          mockCredentials.clinicId
        );
      });
      
      // Then logout
      await act(async () => {
        await result.current.logout();
      });
      
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(SecureStorageService.clearAuthToken).toHaveBeenCalled();
      expect(SecureStorageService.clearAll).toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGOUT',
        })
      );
    });

    it('should handle logout errors gracefully', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      (SecureStorageService.clearAuthToken as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );
      
      // Should not throw
      await act(async () => {
        await result.current.logout();
      });
      
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('session management', () => {
    it('should check session validity', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      // Set up valid session
      (SecureStorageService.getAuthToken as jest.Mock).mockResolvedValue('valid-token');
      (SecureAPIClient.get as jest.Mock).mockResolvedValue({
        valid: true,
        user: mockUser,
      });
      
      let isValid;
      await act(async () => {
        isValid = await result.current.checkSession();
      });
      
      expect(isValid).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('should handle expired sessions', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      (SecureStorageService.getAuthToken as jest.Mock).mockResolvedValue('expired-token');
      (SecureAPIClient.get as jest.Mock).mockRejectedValue(
        new Error('Token expired')
      );
      
      let isValid;
      await act(async () => {
        isValid = await result.current.checkSession();
      });
      
      expect(isValid).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should refresh token when needed', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      (SecureStorageService.getAuthToken as jest.Mock).mockResolvedValue('old-token');
      (SecureAPIClient.post as jest.Mock).mockResolvedValue({
        token: 'new-token',
        user: mockUser,
      });
      
      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshToken();
      });
      
      expect(refreshResult).toBe(true);
      expect(SecureStorageService.setAuthToken).toHaveBeenCalledWith('new-token');
    });
  });

  describe('role-based access control', () => {
    it('should check user permissions', () => {
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        result.current.setUser(mockUser);
      });
      
      expect(result.current.hasPermission('read')).toBe(true);
      expect(result.current.hasPermission('prescribe')).toBe(true);
      expect(result.current.hasPermission('admin')).toBe(false);
    });

    it('should check user roles', () => {
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        result.current.setUser(mockUser);
      });
      
      expect(result.current.hasRole('doctor')).toBe(true);
      expect(result.current.hasRole('admin')).toBe(false);
    });

    it('should handle users with multiple roles', () => {
      const { result } = renderHook(() => useAuthStore());
      
      const multiRoleUser = {
        ...mockUser,
        roles: ['doctor', 'admin'] as any[],
      };
      
      act(() => {
        result.current.setUser(multiRoleUser);
      });
      
      expect(result.current.hasRole('doctor')).toBe(true);
      expect(result.current.hasRole('admin')).toBe(true);
      expect(result.current.hasRole('nurse')).toBe(false);
    });
  });

  describe('security features', () => {
    it('should track failed login attempts', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      (SecureAPIClient.post as jest.Mock).mockRejectedValue(
        new Error('Invalid credentials')
      );
      
      await act(async () => {
        await result.current.login('user', 'wrong1', 'clinic');
      });
      
      expect(result.current.failedAttempts).toBe(1);
      
      await act(async () => {
        await result.current.login('user', 'wrong2', 'clinic');
      });
      
      expect(result.current.failedAttempts).toBe(2);
    });

    it('should reset failed attempts on successful login', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      // First fail
      (SecureAPIClient.post as jest.Mock).mockRejectedValue(
        new Error('Invalid credentials')
      );
      
      await act(async () => {
        await result.current.login('user', 'wrong', 'clinic');
      });
      
      expect(result.current.failedAttempts).toBe(1);
      
      // Then succeed
      (SecureAPIClient.post as jest.Mock).mockResolvedValue({
        user: mockUser,
        token: 'jwt-token-123',
      });
      
      await act(async () => {
        await result.current.login(
          mockCredentials.username,
          mockCredentials.password,
          mockCredentials.clinicId
        );
      });
      
      expect(result.current.failedAttempts).toBe(0);
    });

    it('should implement session timeout', async () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useAuthStore());
      
      // Login
      (SecureAPIClient.post as jest.Mock).mockResolvedValue({
        user: mockUser,
        token: 'jwt-token-123',
      });
      
      await act(async () => {
        await result.current.login(
          mockCredentials.username,
          mockCredentials.password,
          mockCredentials.clinicId
        );
      });
      
      // Fast forward 30 minutes (session timeout)
      act(() => {
        jest.advanceTimersByTime(30 * 60 * 1000);
      });
      
      // Session should be invalidated
      expect(result.current.isAuthenticated).toBe(false);
      
      jest.useRealTimers();
    });
  });

  describe('compliance logging', () => {
    it('should log all authentication events', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      // Login
      (SecureAPIClient.post as jest.Mock).mockResolvedValue({
        user: mockUser,
        token: 'jwt-token-123',
      });
      
      await act(async () => {
        await result.current.login(
          mockCredentials.username,
          mockCredentials.password,
          mockCredentials.clinicId
        );
      });
      
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN',
          userId: mockUser.id,
          clinicId: mockCredentials.clinicId,
        })
      );
      
      // Logout
      await act(async () => {
        await result.current.logout();
      });
      
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGOUT',
          userId: mockUser.id,
        })
      );
    });

    it('should log failed authentication attempts', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      (SecureAPIClient.post as jest.Mock).mockRejectedValue(
        new Error('Invalid credentials')
      );
      
      await act(async () => {
        await result.current.login('hacker', 'attempt', 'clinic');
      });
      
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          username: 'hacker',
          reason: 'Invalid credentials',
        })
      );
    });
  });
});