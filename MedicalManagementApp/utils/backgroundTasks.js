import BackgroundFetch from 'react-native-background-fetch';

class BackgroundSyncManager {
  /**
   * Configure background sync for critical data
   */
  async configure() {
    BackgroundFetch.configure({
      minimumFetchInterval: 15, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
    }, async (taskId) => {
      console.log('[BackgroundFetch] taskId:', taskId);
      
      try {
        // Sync critical data
        await this.syncCriticalData();
        
        // Clean old cache
        await this.cleanOldCache();
        
        // Upload pending notes
        await this.uploadPendingNotes();
        
        BackgroundFetch.finish(taskId);
      } catch (error) {
        console.error('Background sync failed:', error);
        BackgroundFetch.finish(taskId);
      }
    }, (taskId) => {
      // Task timeout
      BackgroundFetch.finish(taskId);
    });
    
    // Check status
    const status = await BackgroundFetch.status();
    console.log('[BackgroundFetch] status:', status);
  }
  
  async syncCriticalData() {
    // Sync only essential data in background
    const priorities = [
      'current_patient_updates',
      'new_lab_results',
      'critical_alerts',
      'appointment_changes',
    ];
    
    for (const dataType of priorities) {
      await this.syncDataType(dataType);
    }
  }
}
