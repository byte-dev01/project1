import { NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { WebViewBridge } = NativeModules;
const webViewEmitter = new NativeEventEmitter(WebViewBridge);

class WebViewService {
  private listeners: Map<string, any> = new Map();

  /**
   * Clear all WebView cache and cookies
   */
  async clearAllData(): Promise<void> {
    try {
      await WebViewBridge.clearCache();
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('webViewState');
      console.log('WebView data cleared successfully');
    } catch (error) {
      console.error('Failed to clear WebView data:', error);
      throw error;
    }
  }

  /**
   * Get cookies for a specific URL
   */
  async getCookies(url: string): Promise<any[]> {
    try {
      return await WebViewBridge.getCookies(url);
    } catch (error) {
      console.error('Failed to get cookies:', error);
      return [];
    }
  }

  /**
   * Set a cookie
   */
  async setCookie(url: string, name: string, value: string): Promise<void> {
    try {
      await WebViewBridge.setCookie(url, name, value);
    } catch (error) {
      console.error('Failed to set cookie:', error);
      throw error;
    }
  }

  /**
   * Handle deep links
   */
  async handleDeepLink(url: string): Promise<any> {
    try {
      return await WebViewBridge.handleDeepLink(url);
    } catch (error) {
      console.error('Failed to handle deep link:', error);
      throw error;
    }
  }

  /**
   * Listen for deep links
   */
  onDeepLink(callback: (data: any) => void): () => void {
    const subscription = webViewEmitter.addListener('DeepLinkReceived', callback);
    this.listeners.set('deepLink', subscription);
    
    return () => {
      subscription.remove();
      this.listeners.delete('deepLink');
    };
  }

  /**
   * Save WebView state
   */
  async saveState(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem('webViewState', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save WebView state:', error);
    }
  }

  /**
   * Restore WebView state
   */
  async restoreState(): Promise<any> {
    try {
      const state = await AsyncStorage.getItem('webViewState');
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('Failed to restore WebView state:', error);
      return null;
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.listeners.forEach(subscription => subscription.remove());
    this.listeners.clear();
  }
}

export const webViewService = new WebViewService();