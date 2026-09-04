// Daily Offline & Cash Expense Reminder Service (§11)
// Smart scheduling, duplicate suppression, snooze intervals, and action buttons

import { Transaction } from '../types';

export interface SnoozeOption {
  label: string;
  minutes: number;
}

export const SNOOZE_OPTIONS: SnoozeOption[] = [
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: 'Tomorrow morning (9 AM)', minutes: -1 }, // special code for 9 AM next day
];

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }

  return false;
}

/**
 * Check if the user entered any transactions in the last N hours.
 * Used to avoid annoying the user if they've already logged expenses recently (§11.4).
 */
export function hasRecentTransactions(transactions: Transaction[], hoursThreshold = 2): boolean {
  if (!transactions || transactions.length === 0) return false;

  const now = new Date().getTime();
  const thresholdMs = hoursThreshold * 60 * 60 * 1000;

  return transactions.some((t) => {
    // Attempt parse date + time
    const dateTimeStr = t.time ? `${t.date}T${t.time}` : `${t.date}T12:00:00`;
    const txTime = new Date(dateTimeStr).getTime();
    return !isNaN(txTime) && now - txTime < thresholdMs;
  });
}

/**
 * Snooze the reminder for the given number of minutes or until next morning.
 */
export function snoozeReminder(minutes: number): void {
  const now = new Date();
  let snoozeDate: Date;

  if (minutes === -1) {
    // Next morning at 9:00 AM
    snoozeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
  } else {
    snoozeDate = new Date(now.getTime() + minutes * 60 * 1000);
  }

  localStorage.setItem('ed_reminder_snooze_until', snoozeDate.toISOString());
}

/**
 * Check if reminder is currently snoozed.
 */
export function isReminderSnoozed(): boolean {
  const snoozeUntil = localStorage.getItem('ed_reminder_snooze_until');
  if (!snoozeUntil) return false;

  const snoozeTime = new Date(snoozeUntil).getTime();
  if (isNaN(snoozeTime)) return false;

  return new Date().getTime() < snoozeTime;
}

/**
 * Send interactive notification with YES / LATER actions if supported.
 */
export async function sendDailyReminderNotification(
  title: string,
  body: string,
  options?: {
    yesLabel?: string;
    laterLabel?: string;
  }
): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const icon = '/icon-192.png';
  const badge = '/icon-192.png';

  // Try service worker notification for action buttons support
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon,
          badge,
          tag: 'daily-expense-reminder',
          data: { url: '/?action=add_expense' },
          actions: [
            {
              action: 'add_expense',
              title: options?.yesLabel || 'Add Expense (YES)',
            },
            {
              action: 'snooze_1h',
              title: options?.laterLabel || 'Snooze 1h (LATER)',
            },
          ],
        } as any);
        return;
      }
    } catch {
      // Fall back to standard Notification constructor
    }
  }

  try {
    new Notification(title, {
      body,
      icon,
      badge,
      tag: 'daily-expense-reminder',
    });
  } catch {
    // Mobile WebViews might block Notification constructor
  }
}

/**
 * Main reminder check function called on startup and periodic heartbeats.
 */
export function checkAndTriggerDailyReminder(
  enabled: boolean,
  reminderTime: string, // e.g. "21:00"
  t: { reminderTitle: string; reminderBody: string },
  recentTransactions: Transaction[] = []
): boolean {
  if (!enabled || !reminderTime) return false;

  // 1. Check if user snoozed
  if (isReminderSnoozed()) {
    return false;
  }

  // 2. Duplicate prevention: skip if user logged an expense in last 2 hours (§11.4)
  if (hasRecentTransactions(recentTransactions, 2)) {
    return false;
  }

  const lastReminderDate = localStorage.getItem('ed_last_daily_reminder_date');
  const todayStr = new Date().toISOString().split('T')[0];

  if (lastReminderDate === todayStr) {
    // Already triggered today
    return false;
  }

  const [targetH, targetM] = reminderTime.split(':').map((n) => parseInt(n, 10));
  const now = new Date();
  const currentH = now.getHours();
  const currentM = now.getMinutes();

  // If current time is past or equal to target time
  if (currentH > targetH || (currentH === targetH && currentM >= targetM)) {
    sendDailyReminderNotification(t.reminderTitle, t.reminderBody);
    localStorage.setItem('ed_last_daily_reminder_date', todayStr);
    return true;
  }

  return false;
}
