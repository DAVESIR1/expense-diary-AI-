package com.expensediary.ai;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;

public class ExpenseReminderReceiver extends BroadcastReceiver {
    public static final String ACTION_REMINDER = "com.expensediary.ai.ALARM_EXPENSE_REMINDER";
    public static final String CHANNEL_ID = "expense_diary_reminder_channel";

    @Override
    public void onReceive(Context context, Intent intent) {
        String title = intent.getStringExtra("title");
        if (title == null || title.isEmpty()) {
            title = "Expense Diary";
        }
        String body = intent.getStringExtra("body");
        if (body == null || body.isEmpty()) {
            body = "Don't forget to record your daily expenses and income!";
        }

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Daily Expense Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Daily alarms and reminders to log expenses");
            channel.enableVibration(true);
            nm.createNotificationChannel(channel);
        }

        Intent openAppIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openAppIntent == null) {
            openAppIntent = new Intent(context, MainActivity.class);
        }
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            9901,
            openAppIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE : PendingIntent.FLAG_UPDATE_CURRENT
        );

        int iconRes = context.getResources().getIdentifier("ic_notification", "drawable", context.getPackageName());
        if (iconRes == 0) {
            iconRes = context.getApplicationInfo().icon;
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        nm.notify(8801, builder.build());
    }
}
