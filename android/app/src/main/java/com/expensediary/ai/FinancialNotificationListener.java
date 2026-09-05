package com.expensediary.ai;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import org.json.JSONArray;
import org.json.JSONObject;

public class FinancialNotificationListener extends NotificationListenerService {
    private static final String PREFS_NAME = "expense_diary_notifications";
    private static final String KEY_NOTIFS = "recent_notifs";
    private static final int MAX_SAVED = 50;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;

        String pkg = sbn.getPackageName();
        if (pkg == null) return;
        String lowerPkg = pkg.toLowerCase();

        boolean isFinancialApp = lowerPkg.contains("paisa") ||
                                 lowerPkg.contains("paytm") ||
                                 lowerPkg.contains("phonepe") ||
                                 lowerPkg.contains("bhim") ||
                                 lowerPkg.contains("cred") ||
                                 lowerPkg.contains("hdfc") ||
                                 lowerPkg.contains("sbi") ||
                                 lowerPkg.contains("icici") ||
                                 lowerPkg.contains("axis") ||
                                 lowerPkg.contains("kotak") ||
                                 lowerPkg.contains("pnb") ||
                                 lowerPkg.contains("baroda") ||
                                 lowerPkg.contains("amazon") ||
                                 lowerPkg.contains("navi") ||
                                 lowerPkg.contains("zerodha") ||
                                 lowerPkg.contains("groww") ||
                                 lowerPkg.contains("angelone") ||
                                 lowerPkg.contains("upstox") ||
                                 lowerPkg.contains("bank");

        Bundle extras = sbn.getNotification().extras;
        if (extras == null) return;

        CharSequence titleCs = extras.getCharSequence("android.title");
        CharSequence textCs = extras.getCharSequence("android.text");
        CharSequence bigTextCs = extras.getCharSequence("android.bigText");
        CharSequence subTextCs = extras.getCharSequence("android.subText");

        String title = titleCs != null ? titleCs.toString() : "";
        String text = textCs != null ? textCs.toString() : "";
        String bigText = bigTextCs != null ? bigTextCs.toString() : "";
        String subText = subTextCs != null ? subTextCs.toString() : "";

        StringBuilder sb = new StringBuilder();
        if (!title.isEmpty()) sb.append(title).append(" ");
        if (!text.isEmpty()) sb.append(text).append(" ");
        if (!bigText.isEmpty() && !bigText.equals(text)) sb.append(bigText).append(" ");
        if (!subText.isEmpty()) sb.append(subText).append(" ");

        CharSequence[] lines = extras.getCharSequenceArray("android.textLines");
        if (lines != null) {
            for (CharSequence line : lines) {
                if (line != null) sb.append(line).append(" ");
            }
        }

        String combined = sb.toString().trim();
        String lowerText = combined.toLowerCase();

        // Reject OTP, Spam, and Loan Ads
        if (lowerText.contains("otp") || lowerText.contains("verification code") ||
            lowerText.contains("pre-approved") || lowerText.contains("congratulations! you are eligible")) {
            return;
        }

        boolean hasFinancialKeywords = lowerText.contains("rs.") ||
                                       lowerText.contains("rs ") ||
                                       lowerText.contains("rs:") ||
                                       lowerText.contains("₹") ||
                                       lowerText.contains("inr") ||
                                       lowerText.contains("debited") ||
                                       lowerText.contains("credited") ||
                                       lowerText.contains("credit") ||
                                       lowerText.contains("salary") ||
                                       lowerText.contains("payroll") ||
                                       lowerText.contains("deposited") ||
                                       lowerText.contains("paid") ||
                                       lowerText.contains("sent") ||
                                       lowerText.contains("spent") ||
                                       lowerText.contains("received") ||
                                       lowerText.contains("transferred") ||
                                       lowerText.contains("nps") ||
                                       lowerText.contains("upi");

        if (isFinancialApp || hasFinancialKeywords) {
            saveFinancialNotification(this, pkg, title, text, sbn.getPostTime());
            FinancialSmsReceiver.savePendingTransaction(this, "notification", pkg, combined, sbn.getPostTime());
        }
    }

    private synchronized static void saveFinancialNotification(Context context, String pkg, String title, String text, long postTime) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existing = prefs.getString(KEY_NOTIFS, "[]");
            JSONArray arr = new JSONArray(existing);

            JSONObject item = new JSONObject();
            item.put("packageName", pkg);
            item.put("title", title);
            item.put("text", text);
            item.put("timestamp", postTime);

            JSONArray updated = new JSONArray();
            updated.put(item);
            for (int i = 0; i < arr.length() && updated.length() < MAX_SAVED; i++) {
                updated.put(arr.getJSONObject(i));
            }

            prefs.edit().putString(KEY_NOTIFS, updated.toString()).apply();
        } catch (Exception ignored) {}
    }

    public static String getRecentSavedNotifications(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_NOTIFS, "[]");
    }
}
