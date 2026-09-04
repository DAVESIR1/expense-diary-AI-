import { registerPlugin } from '@capacitor/core';

export interface AppUsageRecord {
  packageName: string;
  appName: string;
  lastTimeUsed: number;
}

export interface BankSMSMessage {
  id: string;
  address: string;
  body: string;
  timestamp: number;
}

export interface NativePermissionsStatus {
  sms: boolean;
  notifications: boolean;
  usage: boolean;
}

interface NativeBridgePluginInterface {
  checkPermissions(): Promise<NativePermissionsStatus>;
  requestSMSPermissions(): Promise<{ granted: boolean }>;
  requestNotificationPermissions(): Promise<{ granted: boolean }>;
  requestAllNativePermissions(): Promise<any>;
  openUsageSettings(): Promise<{ success: boolean }>;
  getRecentPaymentAppUsage(): Promise<{ hasPermission: boolean; apps: AppUsageRecord[] }>;
  readRecentBankSMS(): Promise<{ hasPermission: boolean; messages: BankSMSMessage[] }>;
  showNotification(options: { title: string; body: string }): Promise<{ success: boolean }>;
}

// Register native bridge plugin (provided by Android NativeBridgePlugin.java)
const NativeBridgeImpl = registerPlugin<NativeBridgePluginInterface>('NativeBridge');

export const NativeBridgeService = {
  /**
   * Check permissions status across SMS, Notifications, and App Usage.
   */
  async checkPermissions(): Promise<NativePermissionsStatus> {
    try {
      return await NativeBridgeImpl.checkPermissions();
    } catch {
      // Fallback for desktop / web browser environment
      const notifGranted = 'Notification' in window && Notification.permission === 'granted';
      const smsSaved = localStorage.getItem('expense_diary_sms_granted') === 'true';
      const usageSaved = localStorage.getItem('expense_diary_usage_granted') === 'true';
      return {
        sms: smsSaved,
        notifications: notifGranted,
        usage: usageSaved,
      };
    }
  },

  /**
   * Request real Android OS SMS permissions (READ_SMS & RECEIVE_SMS).
   */
  async requestSMSPermissions(): Promise<boolean> {
    try {
      const res = await NativeBridgeImpl.requestSMSPermissions();
      if (res && res.granted) {
        localStorage.setItem('expense_diary_sms_granted', 'true');
        return true;
      }
      return false;
    } catch {
      // Browser fallback
      localStorage.setItem('expense_diary_sms_granted', 'true');
      return true;
    }
  },

  /**
   * Request real Android 13+ Notification permissions (POST_NOTIFICATIONS).
   */
  async requestNotificationPermissions(): Promise<boolean> {
    try {
      const res = await NativeBridgeImpl.requestNotificationPermissions();
      if (res && res.granted) {
        return true;
      }
    } catch {
      // Browser fallback
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      }
    }
    return false;
  },

  /**
   * Open Android System "Usage Access" settings so user can grant PACKAGE_USAGE_STATS.
   */
  async openUsageSettings(): Promise<boolean> {
    try {
      const res = await NativeBridgeImpl.openUsageSettings();
      return !!res.success;
    } catch {
      return false;
    }
  },

  /**
   * Fetch recent payment and shopping app usage from Android UsageStatsManager.
   */
  async getRecentPaymentAppUsage(): Promise<AppUsageRecord[]> {
    try {
      const res = await NativeBridgeImpl.getRecentPaymentAppUsage();
      if (res && res.apps) {
        return res.apps;
      }
    } catch {
      // Web fallback
    }
    return [];
  },

  /**
   * Read recent financial and bank SMS from Android SMS content provider.
   */
  async readRecentBankSMS(): Promise<BankSMSMessage[]> {
    try {
      const res = await NativeBridgeImpl.readRecentBankSMS();
      if (res && res.messages) {
        return res.messages;
      }
    } catch {
      // Web fallback
    }
    return [];
  },

  /**
   * Show native Android system notification with channel, icon and sound.
   */
  async showNotification(title: string, body: string): Promise<boolean> {
    try {
      const res = await NativeBridgeImpl.showNotification({ title, body });
      return !!res.success;
    } catch {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon-192.png' });
        return true;
      }
    }
    return false;
  },
};
