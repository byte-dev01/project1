import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './constants';

interface NotificationSettings {
  enabled: boolean;
  urgentFax: boolean;
  newMessages: boolean;
  labResults: boolean;
  appointments: boolean;
  sound: boolean;
  vibration: boolean;
}

class NotificationManager {
  private token: string | null = null;
  private settings: NotificationSettings = {
    enabled: true,
    urgentFax: true,
    newMessages: true,
    labResults: true,
    appointments: true,
    sound: true,
    vibration: true,
  };

  async initialize(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Notifications are not supported on simulator');
      return null;
    }

    // Load saved settings
    await this.loadSettings();

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission not granted for push notifications');
      return null;
    }

    // Get Expo push token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      this.token = tokenData.data;
      return this.token;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  configure() {
    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const settings = await this.getSettings();
        
        return {
          shouldShowAlert: settings.enabled,
          shouldPlaySound: settings.enabled && settings.sound,
          shouldSetBadge: settings.enabled,
        };
      },
    });

    // Handle notification responses (when user taps notification)
    const subscription = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse
    );

    // Handle foreground notifications
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived
    );

    return () => {
      subscription.remove();
      receivedSubscription.remove();
    };
  }

  private handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const { data } = response.notification.request.content;
    
    // Navigate based on notification type
    // This will need to be connected to navigation
    console.log('Notification tapped:', data);
  };

  private handleNotificationReceived = (notification: Notifications.Notification) => {
    console.log('Notification received:', notification);
  };

  // Settings management
  async getSettings(): Promise<NotificationSettings> {
    return this.settings;
  }

  async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(this.settings));
  }

  private async loadSettings(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (saved) {
        this.settings = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  // Schedule notifications
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: this.settings.sound,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: trigger || null, // null = immediate
    });

    return id;
  }

  async cancelNotification(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Badge management
  async setBadgeCount(count: number): Promise<void> {
    if (Platform.OS === 'ios') {
      await Notifications.setBadgeCountAsync(count);
    }
  }

  async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }

  // Notification templates
  async notifyUrgentFax(fax: { _id: string; fileName: string; severityLevel: string }) {
    if (!this.settings.urgentFax) return;

    await this.scheduleLocalNotification(
      'Urgent Fax Received',
      `${fax.fileName} requires immediate attention (${fax.severityLevel})`,
      { type: 'urgent_fax', faxId: fax._id }
    );
  }

  async notifyNewMessage(message: { id: string; senderName: string; subject: string }) {
    if (!this.settings.newMessages) return;

    await this.scheduleLocalNotification(
      'New Message',
      `${message.senderName}: ${message.subject}`,
      { type: 'new_message', messageId: message.id }
    );
  }

  async notifyLabResults(patient: { id: string; name: string; testName: string }) {
    if (!this.settings.labResults) return;

    await this.scheduleLocalNotification(
      'Lab Results Available',
      `${patient.testName} results for ${patient.name} are ready`,
      { type: 'lab_result', patientId: patient.id }
    );
  }

  async notifyAppointmentReminder(appointment: {
    id: string;
    patientName: string;
    time: Date;
    provider: string;
  }) {
    if (!this.settings.appointments) return;

    const trigger = new Date(appointment.time);
    trigger.setHours(trigger.getHours() - 1); // 1 hour before

    await this.scheduleLocalNotification(
      'Appointment Reminder',
      `${appointment.patientName} has an appointment with ${appointment.provider} in 1 hour`,
      { type: 'appointment_reminder', appointmentId: appointment.id },
      { date: trigger }
    );
  }
}

export const notificationManager = new NotificationManager();

