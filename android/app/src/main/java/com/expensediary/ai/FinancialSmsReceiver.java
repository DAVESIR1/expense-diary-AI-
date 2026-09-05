package com.expensediary.ai;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsMessage;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Listens 24/7 for incoming SMS even when the app is backgrounded or terminated.
 * Extracts financial & UPI SMS and saves them to a persistent pending queue in SharedPreferences.
 */
public class FinancialSmsReceiver extends BroadcastReceiver {
    public static final String PREFS_NAME = "expense_diary_pending_prefs";
    public static final String KEY_PENDING_TX = "pending_incoming_tx";
    private static final int MAX_PENDING = 100;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) return;

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        try {
            Object[] pdus = (Object[]) bundle.get("pdus");
            if (pdus == null || pdus.length == 0) return;

            String format = bundle.getString("format");
            StringBuilder fullBody = new StringBuilder();
            String sender = "";
            long timestamp = System.currentTimeMillis();

            for (Object pdu : pdus) {
                SmsMessage smsMessage;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    smsMessage = SmsMessage.createFromPdu((byte[]) pdu, format);
                } else {
                    smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
                }
                if (smsMessage != null) {
                    if (sender.isEmpty()) {
                        sender = smsMessage.getDisplayOriginatingAddress();
                        timestamp = smsMessage.getTimestampMillis();
                    }
                    fullBody.append(smsMessage.getMessageBody());
                }
            }

            String body = fullBody.toString();
            if (isFinancialCandidate(sender, body)) {
                savePendingTransaction(context, "sms", sender, body, timestamp);
            }
        } catch (Exception ignored) {
        }
    }

    public static synchronized void savePendingTransaction(Context context, String source, String sender, String text, long timestamp) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_PENDING_TX, "[]");
            JSONArray arr = new JSONArray(raw);

            // Avoid exact duplicate within 60s
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                if (o.optString("text").equals(text) && Math.abs(o.optLong("timestamp") - timestamp) < 60000) {
                    return;
                }
            }

            JSONObject item = new JSONObject();
            item.put("id", "bg_" + System.currentTimeMillis() + "_" + Math.abs(text.hashCode() % 10000));
            item.put("source", source);
            item.put("sender", sender != null ? sender : "");
            item.put("text", text);
            item.put("timestamp", timestamp);

            JSONArray updated = new JSONArray();
            updated.put(item);
            for (int i = 0; i < arr.length() && updated.length() < MAX_PENDING; i++) {
                updated.put(arr.getJSONObject(i));
            }

            prefs.edit().putString(KEY_PENDING_TX, updated.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    public static synchronized String drainPendingTransactions(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_PENDING_TX, "[]");
            // Clear queue upon drain
            prefs.edit().putString(KEY_PENDING_TX, "[]").apply();
            return raw;
        } catch (Exception ignored) {
            return "[]";
        }
    }

    public static boolean isFinancialCandidate(String sender, String body) {
        if (body == null || body.trim().length() < 8) return false;
        String lower = body.toLowerCase();

        // Strict OTP & Promo exclusion
        if (lower.contains("otp") || lower.contains("one time password") || lower.contains("verification code")) {
            return false;
        }
        if (lower.contains("pre-approved") || lower.contains("congratulations! you are eligible") ||
            lower.contains("apply for loan") || lower.contains("instant loan")) {
            return false;
        }

        // Must have at least one digit
        boolean hasDigit = false;
        for (int i = 0; i < body.length(); i++) {
            if (Character.isDigit(body.charAt(i))) {
                hasDigit = true;
                break;
            }
        }
        if (!hasDigit) return false;

        // Financial keywords
        boolean hasFinancialAction = lower.contains("debited") ||
                                     lower.contains("credited") ||
                                     lower.contains("credit") ||
                                     lower.contains("salary") ||
                                     lower.contains("payroll") ||
                                     lower.contains("stipend") ||
                                     lower.contains("deposited") ||
                                     lower.contains("paid") ||
                                     lower.contains("spent") ||
                                     lower.contains("sent") ||
                                     lower.contains("received") ||
                                     lower.contains("transferred") ||
                                     lower.contains("withdrawn") ||
                                     lower.contains("refund") ||
                                     lower.contains("txn of") ||
                                     lower.contains("nps") ||
                                     lower.contains("pran") ||
                                     lower.contains("sip") ||
                                     lower.contains("mutual fund") ||
                                     lower.contains("upi");

        boolean hasCurrency = body.contains("₹") ||
                              lower.contains("rs.") ||
                              lower.contains("rs ") ||
                              lower.contains("rs:") ||
                              lower.contains("inr") ||
                              body.contains("$");

        return hasFinancialAction && (hasCurrency || lower.contains("nps") || lower.contains("upi") || lower.contains("salary"));
    }
}
