// Daily Reminder & Notification Service

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

export function sendDailyReminderNotification(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
  } catch {
    // Some mobile webviews restrict Notification constructor
  }
}

// Check and trigger reminder if the time matches or user opens app after reminder time today
export function checkAndTriggerDailyReminder(
  enabled: boolean,
  reminderTime: string, // "20:00"
  t: { reminderTitle: string; reminderBody: string }
): void {
  if (!enabled || !reminderTime) return;

  const lastReminderDate = localStorage.getItem('ed_last_daily_reminder_date');
  const todayStr = new Date().toISOString().split('T')[0];

  if (lastReminderDate === todayStr) {
    // Already reminded today
    return;
  }

  const [targetH, targetM] = reminderTime.split(':').map((n) => parseInt(n, 10));
  const now = new Date();
  const currentH = now.getHours();
  const currentM = now.getMinutes();

  // If current time is past or equal to target time
  if (currentH > targetH || (currentH === targetH && currentM >= targetM)) {
    sendDailyReminderNotification(t.reminderTitle, t.reminderBody);
    localStorage.setItem('ed_last_daily_reminder_date', todayStr);
  }
}
