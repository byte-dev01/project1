import { NativeModules, Platform, AppState, DeviceEventEmitter } from 'react-native';
import { captureScreen } from 'react-native-view-shot';
import Clipboard from '@react-native-clipboard/clipboard';
import { auditLogger } from '../../services/security/auditLogger';

class PHIProtectionService {
  private isProtected: boolean = false;
  private clipboardMonitor: NodeJS.Timeout | null = null;
  private lastClipboardContent: string = '';

  async initialize(): Promise<void> {
    if (Platform.OS === 'ios') {
      await this.setupIOSProtections();
    }
    
    this.setupClipboardMonitoring();
    this.setupScreenshotPrevention();
    this.setupAppSwitcherProtection();
  }

  private async setupIOSProtections(): Promise<void> {
    const { PHIProtection } = NativeModules;
    if (!PHIProtection) {
      console.warn('PHIProtection native module not found');
      return;
    }

    // Prevent screenshots
    await PHIProtection.setScreenshotBlocking(true);
    
    // Hide app content in app switcher
    await PHIProtection.setAppSwitcherBlurring(true);
    
    // Disable screen recording
    await PHIProtection.setScreenRecordingDetection(true);

    // Listen for screen recording
    DeviceEventEmitter.addListener('ScreenRecordingDetected', () => {
      this.handleScreenRecording();
    });
  }

  private setupClipboardMonitoring(): void {
    // Monitor clipboard for PHI
    this.clipboardMonitor = setInterval(async () => {
      const content = await Clipboard.getString();
      
      if (content !== this.lastClipboardContent) {
        if (this.containsPHI(content)) {
          // Clear clipboard if PHI detected
          Clipboard.setString('');
          
          await auditLogger.logSecurityEvent('PHI_CLIPBOARD_CLEARED', {
            contentLength: content.length,
            timestamp: Date.now(),
          });
        }
        this.lastClipboardContent = content;
      }
    }, 1000); // Check every second
  }

  private containsPHI(text: string): boolean {
    // PHI patterns
    const patterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{10,}\b/, // Medical Record Numbers
      /(?:patient|diagnosis|medication|treatment)/i,
      /\b(?:HIV|AIDS|STD|mental health|substance abuse)\b/i,
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  private setupScreenshotPrevention(): void {
    if (Platform.OS === 'ios') {
      // iOS: Use native module to detect screenshots
      DeviceEventEmitter.addListener('UserDidTakeScreenshot', async () => {
        await auditLogger.logSecurityEvent('SCREENSHOT_ATTEMPTED', {
          timestamp: Date.now(),
          prevented: this.isProtected,
        });

        if (this.isProtected) {
          // Alert user that screenshots are not allowed
          const { Alert } = require('react-native');
          Alert.alert(
            'Security Notice',
            'Screenshots are not allowed when viewing patient information',
            [{ text: 'OK' }]
          );
        }
      });
    }
  }

  private setupAppSwitcherProtection(): void {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'inactive') {
        // App is going to background - hide sensitive content
        this.hideSensitiveContent();
      } else if (nextAppState === 'active') {
        // App is coming to foreground - restore content
        this.showSensitiveContent();
      }
    });
  }

  private hideSensitiveContent(): void {
    if (Platform.OS === 'ios') {
      const { PHIProtection } = NativeModules;
      PHIProtection?.showPrivacyScreen(true);
    }
  }

  private showSensitiveContent(): void {
    if (Platform.OS === 'ios') {
      const { PHIProtection } = NativeModules;
      PHIProtection?.showPrivacyScreen(false);
    }
  }

  private async handleScreenRecording(): Promise<void> {
    // Log security event
    await auditLogger.logSecurityEvent('SCREEN_RECORDING_DETECTED', {
      timestamp: Date.now(),
    });

    // Blur or hide sensitive content
    this.hideSensitiveContent();

    // Alert user
    const { Alert } = require('react-native');
    Alert.alert(
      'Recording Detected',
      'Screen recording is not allowed when viewing patient information. The app will now close.',
      [
        {
          text: 'OK',
          onPress: () => {
            // Force app to background
            if (Platform.OS === 'ios') {
              const { PHIProtection } = NativeModules;
              PHIProtection?.minimizeApp();
            }
          },
        },
      ]
    );
  }

  enableProtection(): void {
    this.isProtected = true;
  }

  disableProtection(): void {
    this.isProtected = false;
  }

  cleanup(): void {
    if (this.clipboardMonitor) {
      clearInterval(this.clipboardMonitor);
    }
  }
}

export const phiProtection = new PHIProtectionService();
