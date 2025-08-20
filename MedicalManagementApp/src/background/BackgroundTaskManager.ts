import BackgroundFetch from 'react-native-background-fetch';
import { NativeModules, Platform } from 'react-native';
import { api } from '@api/client';
import { auditLogger } from '@core/compliance/AuditLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { BackgroundModule } = NativeModules;

interface BackgroundTask {
  id: string;
  name: string;
  interval: number; // minutes
  priority: 'high' | 'medium' | 'low';
  handler: () => Promise<void>;
  lastRun?: Date;
  nextRun?: Date;
}

export class BackgroundTaskManager {
  private static instance: BackgroundTaskManager;
  private tasks: Map<string, BackgroundTask> = new Map();
  private isInitialized: boolean = false;

  static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  /**
   * Initialize background task manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure background fetch
      await BackgroundFetch.configure({
        minimumFetchInterval: 15, // 15 minutes
        forceAlarmManager: false,
        stopOnTerminate: false,
        startOnBoot: true,
        enableHeadless: true,
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
      }, async (taskId) => {
        await this.onBackgroundFetch(taskId);
      }, (taskId) => {
        console.log(`Background fetch timeout: ${taskId}`);
        BackgroundFetch.finish(taskId);
      });

      // Register default tasks
      await this.registerDefaultTasks();

      // iOS specific setup
      if (Platform.OS === 'ios') {
        await this.setupiOSBackgroundTasks();
      }

      this.isInitialized = true;

      await auditLogger.logSystemEvent({
        type: 'BACKGROUND_TASKS_INITIALIZED',
        timestamp: new Date(),
      });

    } catch (error) {
      console.error('Failed to initialize background tasks:', error);
      throw error;
    }
  }

  /**
   * Register default healthcare tasks
   */
  private async registerDefaultTasks(): Promise<void> {
    // Check for urgent faxes
    this.registerTask({
      id: 'check_urgent_faxes',
      name: 'Check Urgent Faxes',
      interval: 15,
      priority: 'high',
      handler: async () => {
        await this.checkUrgentFaxes();
      },
    });

    // Sync offline data
    this.registerTask({
      id: 'sync_offline_data',
      name: 'Sync Offline Data',
      interval: 30,
      priority: 'medium',
      handler: async () => {
        await this.syncOfflineData();
      },
    });

    // Check medication refills
    this.registerTask({
      id: 'check_medication_refills',
      name: 'Check Medication Refills',
      interval: 60,
      priority: 'medium',
      handler: async () => {
        await this.checkMedicationRefills();
      },
    });

    // Clean expired cache
    this.registerTask({
      id: 'clean_expired_cache',
      name: 'Clean Expired Cache',
      interval: 120,
      priority: 'low',
      handler: async () => {
        await this.cleanExpiredCache();
      },
    });

    // Verify compliance status
    this.registerTask({
      id: 'verify_compliance',
      name: 'Verify Compliance Status',
      interval: 240,
      priority: 'high',
      handler: async () => {
        await this.verifyComplianceStatus();
      },
    });
  }

  /**
   * iOS-specific background task setup
   */
  private async setupiOSBackgroundTasks(): Promise<void> {
    // Register BGProcessingTask for long-running operations
    await BackgroundModule.registerBGProcessingTask('com.healthbridge.dataSync', async () => {
      await this.performDataSync();
    });

    // Register BGAppRefreshTask for periodic updates
    await BackgroundModule.registerBGAppRefreshTask('com.healthbridge.urgentCheck', async () => {
      await this.checkUrgentNotifications();
    });
  }

  /**
   * Register a background task
   */
  registerTask(task: BackgroundTask): void {
    this.tasks.set(task.id, task);
    console.log(`Registered background task: ${task.name}`);
  }

  /**
   * Handle background fetch event
   */
  private async onBackgroundFetch(taskId: string): Promise<void> {
    console.log(`Background fetch triggered: ${taskId}`);
    
    try {
      // Run high priority tasks
      const highPriorityTasks = Array.from(this.tasks.values())
        .filter(task => task.priority === 'high');
      
      for (const task of highPriorityTasks) {
        if (await this.shouldRunTask(task)) {
          await this.runTask(task);
        }
      }

      // Run other due tasks if time permits
      const remainingTasks = Array.from(this.tasks.values())
        .filter(task => task.priority !== 'high');
      
      for (const task of remainingTasks) {
        if (await this.shouldRunTask(task)) {
          await this.runTask(task);
        }
      }

      BackgroundFetch.finish(taskId);
    } catch (error) {
      console.error('Background fetch error:', error);
      BackgroundFetch.finish(taskId);
    }
  }

  /**
   * Check if task should run
   */
  private async shouldRunTask(task: BackgroundTask): Promise<boolean> {
    if (!task.lastRun) return true;
    
    const now = Date.now();
    const lastRun = task.lastRun.getTime();
    const intervalMs = task.interval * 60 * 1000;
    
    return (now - lastRun) >= intervalMs;
  }

  /**
   * Run a background task
   */
  private async runTask(task: BackgroundTask): Promise<void> {
    console.log(`Running background task: ${task.name}`);
    
    try {
      const startTime = Date.now();
      
      await task.handler();
      
      task.lastRun = new Date();
      task.nextRun = new Date(Date.now() + task.interval * 60 * 1000);
      
      const duration = Date.now() - startTime;
      
      await auditLogger.logSystemEvent({
        type: 'BACKGROUND_TASK_COMPLETED',
        taskId: task.id,
        taskName: task.name,
        duration,
        timestamp: new Date(),
      });
      
    } catch (error) {
      console.error(`Background task failed: ${task.name}`, error);
      
      await auditLogger.logSystemEvent({
        type: 'BACKGROUND_TASK_FAILED',
        taskId: task.id,
        taskName: task.name,
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Check for urgent faxes
   */
  private async checkUrgentFaxes(): Promise<void> {
    try {
      const response = await api.get('/api/fax/urgent');
      const urgentFaxes = response.data;
      
      if (urgentFaxes.length > 0) {
        // Send push notification
        await this.sendPushNotification({
          title: 'Urgent Fax',
          body: `You have ${urgentFaxes.length} urgent fax(es) requiring attention`,
          data: { type: 'urgent_fax', count: urgentFaxes.length },
        });
        
        // Store for offline access
        await AsyncStorage.setItem('urgent_faxes', JSON.stringify(urgentFaxes));
      }
    } catch (error) {
      console.error('Failed to check urgent faxes:', error);
    }
  }

  /**
   * Sync offline data
   */
  private async syncOfflineData(): Promise<void> {
    try {
      const offlineQueue = await AsyncStorage.getItem('offline_queue');
      if (!offlineQueue) return;
      
      const queue = JSON.parse(offlineQueue);
      const successfulSyncs = [];
      
      for (const item of queue) {
        try {
          await api.request(item);
          successfulSyncs.push(item.id);
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
        }
      }
      
      // Remove successful syncs from queue
      const remainingQueue = queue.filter(
        (item: any) => !successfulSyncs.includes(item.id)
      );
      
      await AsyncStorage.setItem('offline_queue', JSON.stringify(remainingQueue));
      
      console.log(`Synced ${successfulSyncs.length} offline items`);
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  }

  /**
   * Check medication refills
   */
  private async checkMedicationRefills(): Promise<void> {
    try {
      const response = await api.get('/api/medications/refills-due');
      const refillsDue = response.data;
      
      if (refillsDue.length > 0) {
        await this.sendPushNotification({
          title: 'Medication Refills',
          body: `${refillsDue.length} medication(s) need refills`,
          data: { type: 'medication_refill', medications: refillsDue },
        });
      }
    } catch (error) {
      console.error('Failed to check medication refills:', error);
    }
  }

  /**
   * Clean expired cache
   */
  private async cleanExpiredCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const now = Date.now();
      let cleaned = 0;
      
      for (const key of keys) {
        if (key.startsWith('cache_')) {
          const item = await AsyncStorage.getItem(key);
          if (item) {
            const data = JSON.parse(item);
            if (data.expiry && data.expiry < now) {
              await AsyncStorage.removeItem(key);
              cleaned++;
            }
          }
        }
      }
      
      console.log(`Cleaned ${cleaned} expired cache items`);
    } catch (error) {
      console.error('Failed to clean cache:', error);
    }
  }

  /**
   * Verify compliance status
   */
  private async verifyComplianceStatus(): Promise<void> {
    try {
      // Check HIPAA compliance
      const hipaaStatus = await api.get('/api/compliance/hipaa/status');
      
      if (!hipaaStatus.data.compliant) {
        await auditLogger.logComplianceEvent({
          type: 'HIPAA_NON_COMPLIANCE',
          issues: hipaaStatus.data.issues,
          timestamp: new Date(),
        });
      }
      
      // Check California compliance
      const caStatus = await api.get('/api/compliance/california/status');
      
      if (!caStatus.data.compliant) {
        await auditLogger.logComplianceEvent({
          type: 'CA_NON_COMPLIANCE',
          issues: caStatus.data.issues,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error('Failed to verify compliance:', error);
    }
  }

  /**
   * Perform data sync (iOS BGProcessingTask)
   */
  private async performDataSync(): Promise<void> {
    console.log('Performing full data sync...');
    
    try {
      await Promise.all([
        this.syncOfflineData(),
        this.syncPatientRecords(),
        this.syncClinicalData(),
      ]);
    } catch (error) {
      console.error('Data sync failed:', error);
    }
  }

  /**
   * Check urgent notifications (iOS BGAppRefreshTask)
   */
  private async checkUrgentNotifications(): Promise<void> {
    console.log('Checking urgent notifications...');
    
    try {
      await Promise.all([
        this.checkUrgentFaxes(),
        this.checkCriticalLabResults(),
        this.checkEmergencyAlerts(),
      ]);
    } catch (error) {
      console.error('Urgent check failed:', error);
    }
  }

  /**
   * Additional helper methods
   */
  private async syncPatientRecords(): Promise<void> {
    // Implement patient record sync
  }

  private async syncClinicalData(): Promise<void> {
    // Implement clinical data sync
  }

  private async checkCriticalLabResults(): Promise<void> {
    // Implement critical lab result checking
  }

  private async checkEmergencyAlerts(): Promise<void> {
    // Implement emergency alert checking
  }

  private async sendPushNotification(notification: any): Promise<void> {
    // Implement push notification sending
    console.log('Sending push notification:', notification);
  }

  /**
   * Clean up and stop all tasks
   */
  async cleanup(): Promise<void> {
    await BackgroundFetch.stop();
    this.tasks.clear();
    this.isInitialized = false;
  }
}

export const backgroundTaskManager = BackgroundTaskManager.getInstance();