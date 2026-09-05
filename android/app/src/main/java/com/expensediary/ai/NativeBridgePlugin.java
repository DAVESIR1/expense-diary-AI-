package com.expensediary.ai;

import android.Manifest;
import android.app.AlarmManager;
import android.app.AppOpsManager;
import android.app.KeyguardManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.net.Uri;
import android.os.Build;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.Process;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import android.content.SharedPreferences;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(
    name = "NativeBridge",
    permissions = {
        @Permission(
            alias = "sms",
            strings = {
                Manifest.permission.READ_SMS,
                Manifest.permission.RECEIVE_SMS
            }
        ),
        @Permission(
            alias = "notifications",
            strings = {
                Manifest.permission.POST_NOTIFICATIONS
            }
        )
    }
)
public class NativeBridgePlugin extends Plugin {

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        Context context = getContext();
        boolean smsGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
        
        boolean notifGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notifGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }

        boolean usageGranted = hasUsageStatsPermission();

        JSObject res = new JSObject();
        res.put("sms", smsGranted);
        res.put("notifications", notifGranted);
        res.put("usage", usageGranted);
        call.resolve(res);
    }

    @PluginMethod
    public void requestSMSPermissions(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED) {
            JSObject res = new JSObject();
            res.put("granted", true);
            call.resolve(res);
        } else {
            requestPermissionForAlias("sms", call, "smsPermCallback");
        }
    }

    @PermissionCallback
    private void smsPermCallback(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
        JSObject res = new JSObject();
        res.put("granted", granted);
        call.resolve(res);
    }

    @PluginMethod
    public void requestNotificationPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                JSObject res = new JSObject();
                res.put("granted", true);
                call.resolve(res);
            } else {
                requestPermissionForAlias("notifications", call, "notifPermCallback");
            }
        } else {
            JSObject res = new JSObject();
            res.put("granted", true);
            call.resolve(res);
        }
    }

    @PermissionCallback
    private void notifPermCallback(PluginCall call) {
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        JSObject res = new JSObject();
        res.put("granted", granted);
        call.resolve(res);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to open app settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkSMSPermissionDetailed(PluginCall call) {
        Context context = getContext();
        boolean granted = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean isRestricted = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !granted) {
            isRestricted = true;
        }

        JSObject res = new JSObject();
        res.put("granted", granted);
        res.put("isRestricted", isRestricted);
        res.put("sdkInt", Build.VERSION.SDK_INT);
        call.resolve(res);
    }

    @PluginMethod
    public void openUsageSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to open usage settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getRecentPaymentAppUsage(PluginCall call) {
        JSArray list = new JSArray();
        if (!hasUsageStatsPermission()) {
            JSObject res = new JSObject();
            res.put("hasPermission", false);
            res.put("apps", list);
            call.resolve(res);
            return;
        }

        try {
            UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
            long endTime = System.currentTimeMillis();
            long startTime = endTime - (24 * 60 * 60 * 1000);

            java.util.List<UsageStats> usageStatsList = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime);
            if (usageStatsList != null) {
                for (UsageStats us : usageStatsList) {
                    if (us.getLastTimeUsed() > startTime) {
                        String pkg = us.getPackageName();
                        String appName = getKnownAppName(pkg);
                        if (appName != null) {
                            JSObject item = new JSObject();
                            item.put("packageName", pkg);
                            item.put("appName", appName);
                            item.put("lastTimeUsed", us.getLastTimeUsed());
                            list.put(item);
                        }
                    }
                }
            }

            JSObject res = new JSObject();
            res.put("hasPermission", true);
            res.put("apps", list);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Error querying usage stats: " + e.getMessage());
        }
    }

    @PluginMethod
    public void readRecentBankSMS(PluginCall call) {
        JSArray messages = new JSArray();
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            JSObject res = new JSObject();
            res.put("hasPermission", false);
            res.put("messages", messages);
            res.put("count", 0);
            call.resolve(res);
            return;
        }

        Cursor cursor = null;
        try {
            Uri inboxUri = Uri.parse("content://sms/inbox");
            int days = call.getInt("days", 90);
            long lookbackMs = System.currentTimeMillis() - ((long) days * 24L * 60L * 60L * 1000L);

            // Query SMS inbox ordered by most recent first
            cursor = getContext().getContentResolver().query(
                inboxUri,
                new String[]{"_id", "address", "body", "date"},
                null,
                null,
                "date DESC"
            );

            if (cursor != null) {
                int scanned = 0;
                int count = 0;
                while (cursor.moveToNext() && scanned < 1000 && count < 500) {
                    scanned++;
                    String id = cursor.getString(0);
                    String address = cursor.getString(1);
                    String body = cursor.getString(2);
                    long date = cursor.getLong(3);

                    // Normalize date if stored in seconds (10 digits)
                    long normalizedDate = date;
                    if (date > 0 && date < 100000000000L) {
                        normalizedDate = date * 1000L;
                    }

                    // Check if within lookback
                    if (normalizedDate > 0 && normalizedDate < lookbackMs) {
                        break;
                    }

                    if (body != null && isFinancialSMS(address, body)) {
                        JSObject sms = new JSObject();
                        sms.put("id", id);
                        sms.put("address", address != null ? address : "");
                        sms.put("body", body);
                        sms.put("timestamp", normalizedDate);
                        messages.put(sms);
                        count++;
                    }
                }
            }

            JSObject res = new JSObject();
            res.put("hasPermission", true);
            res.put("messages", messages);
            res.put("count", messages.length());
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Error reading SMS: " + e.getMessage());
        } finally {
            if (cursor != null && !cursor.isClosed()) {
                cursor.close();
            }
        }
    }

    @PluginMethod
    public void showNotification(PluginCall call) {
        String title = call.getString("title", "Expense Diary");
        String body = call.getString("body", "");

        try {
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            String channelId = "expense_diary_channel";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    channelId,
                    "Expense Reminders",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Daily offline expense and transaction reminders");
                channel.enableVibration(true);
                nm.createNotificationChannel(channel);
            }

            Intent intent = new Intent(getContext(), MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                getContext(),
                0,
                intent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
            );

            int iconRes = getContext().getResources().getIdentifier("ic_notification", "drawable", getContext().getPackageName());
            if (iconRes == 0) {
                iconRes = android.R.drawable.ic_dialog_info;
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), channelId)
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setVibrate(new long[]{0, 250, 150, 250});

            nm.notify(1001, builder.build());

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to show notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestAllNativePermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAliases(new String[]{"sms", "notifications"}, call, "allPermCallback");
        } else {
            requestPermissionForAlias("sms", call, "smsPermCallback");
        }
    }

    @PermissionCallback
    private void allPermCallback(PluginCall call) {
        boolean smsGranted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean notifGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notifGranted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        JSObject res = new JSObject();
        res.put("sms", smsGranted);
        res.put("notifications", notifGranted);
        res.put("granted", smsGranted && notifGranted);
        call.resolve(res);
    }

    @PluginMethod
    public void isBiometricsAvailable(PluginCall call) {
        boolean available = false;
        boolean isSecure = false;
        try {
            KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                isSecure = km.isDeviceSecure();
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                BiometricManager bm = (BiometricManager) getContext().getSystemService(Context.BIOMETRIC_SERVICE);
                if (bm != null) {
                    int canAuth = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK);
                    available = (canAuth == BiometricManager.BIOMETRIC_SUCCESS);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                BiometricManager bm = (BiometricManager) getContext().getSystemService(Context.BIOMETRIC_SERVICE);
                if (bm != null) {
                    int canAuth = bm.canAuthenticate();
                    available = (canAuth == BiometricManager.BIOMETRIC_SUCCESS);
                }
            } else {
                available = isSecure;
            }
        } catch (Exception ignored) {
            available = isSecure;
        }

        JSObject res = new JSObject();
        res.put("available", available || isSecure);
        res.put("isSecure", isSecure);
        call.resolve(res);
    }

    @PluginMethod
    public void authenticateBiometrics(PluginCall call) {
        String title = call.getString("title", "Expense Diary");
        String subtitle = call.getString("subtitle", "Confirm your fingerprint or screen lock to unlock");
        String cancelText = call.getString("cancelText", "Cancel");

        getActivity().runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    BiometricPrompt.Builder builder = new BiometricPrompt.Builder(getContext())
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setNegativeButton(cancelText, ContextCompat.getMainExecutor(getContext()), (dialog, which) -> {
                            JSObject res = new JSObject();
                            res.put("success", false);
                            res.put("error", "Cancelled by user");
                            call.resolve(res);
                        });

                    BiometricPrompt prompt = builder.build();
                    CancellationSignal cancelSignal = new CancellationSignal();

                    prompt.authenticate(cancelSignal, ContextCompat.getMainExecutor(getContext()), new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            JSObject res = new JSObject();
                            res.put("success", true);
                            call.resolve(res);
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                            JSObject res = new JSObject();
                            res.put("success", false);
                            res.put("error", errString.toString());
                            call.resolve(res);
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            // Biometric did not match, sensor continues listening
                        }
                    });
                } else {
                    KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
                    if (km != null && km.isDeviceSecure()) {
                        JSObject res = new JSObject();
                        res.put("success", true);
                        call.resolve(res);
                    } else {
                        JSObject res = new JSObject();
                        res.put("success", false);
                        res.put("error", "Biometrics not available on Android < 9");
                        call.resolve(res);
                    }
                }
            } catch (Exception e) {
                call.reject("Biometric authentication failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void printDocument(PluginCall call) {
        String jobName = call.getString("jobName", "Expense_Report_" + System.currentTimeMillis());
        String htmlContent = call.getString("htmlContent", "");

        getActivity().runOnUiThread(() -> {
            try {
                PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) {
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put("error", "PrintManager not available");
                    call.resolve(res);
                    return;
                }

                if (htmlContent != null && !htmlContent.trim().isEmpty()) {
                    // Create an off-screen WebView to render pristine printable HTML
                    android.webkit.WebView printWebView = new android.webkit.WebView(getContext());
                    printWebView.setWebViewClient(new android.webkit.WebViewClient() {
                        @Override
                        public void onPageFinished(android.webkit.WebView view, String url) {
                            try {
                                PrintDocumentAdapter printAdapter;
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                                    printAdapter = view.createPrintDocumentAdapter(jobName);
                                } else {
                                    printAdapter = view.createPrintDocumentAdapter();
                                }
                                printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
                                JSObject res = new JSObject();
                                res.put("success", true);
                                call.resolve(res);
                            } catch (Exception pe) {
                                call.reject("Print page finish error: " + pe.getMessage());
                            }
                        }
                    });
                    printWebView.loadDataWithBaseURL(null, htmlContent, "text/html", "UTF-8", null);
                } else if (getBridge() != null && getBridge().getWebView() != null) {
                    PrintDocumentAdapter printAdapter;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        printAdapter = getBridge().getWebView().createPrintDocumentAdapter(jobName);
                    } else {
                        printAdapter = getBridge().getWebView().createPrintDocumentAdapter();
                    }
                    printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
                    JSObject res = new JSObject();
                    res.put("success", true);
                    call.resolve(res);
                } else {
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put("error", "No WebView available to print");
                    call.resolve(res);
                }
            } catch (Exception e) {
                call.reject("Print failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void saveFileToDownloads(PluginCall call) {
        String fileName = call.getString("fileName", "expense_report.csv");
        String mimeType = call.getString("mimeType", "text/csv");
        String base64Data = call.getString("base64Data", "");
        String textContent = call.getString("textContent", "");

        try {
            byte[] data;
            if (base64Data != null && !base64Data.isEmpty()) {
                data = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
            } else {
                data = textContent.getBytes(StandardCharsets.UTF_8);
            }

            String savedPath = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        OutputStream os = getContext().getContentResolver().openOutputStream(uri);
                        if (os != null) {
                            os.write(data);
                            os.flush();
                            os.close();
                        }
                        savedPath = uri.toString();
                    }
                } catch (Exception me) {
                    // Fallback to direct file below if MediaStore fails
                }
            }

            if (savedPath == null) {
                File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadDir.exists()) {
                    downloadDir.mkdirs();
                }
                File outFile = new File(downloadDir, fileName);
                FileOutputStream fos = new FileOutputStream(outFile);
                fos.write(data);
                fos.flush();
                fos.close();
                savedPath = outFile.getAbsolutePath();

                android.media.MediaScannerConnection.scanFile(
                    getContext(),
                    new String[]{outFile.getAbsolutePath()},
                    new String[]{mimeType},
                    null
                );
            }

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("filePath", savedPath);
            res.put("fileName", fileName);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to save file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        String fileName = call.getString("fileName", "expense_report.csv");
        String mimeType = call.getString("mimeType", "text/csv");
        String base64Data = call.getString("base64Data", "");
        String textContent = call.getString("textContent", "");
        String title = call.getString("title", "Expense Diary Report");

        try {
            byte[] data;
            if (base64Data != null && !base64Data.isEmpty()) {
                data = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
            } else {
                data = textContent.getBytes(StandardCharsets.UTF_8);
            }

            File cacheDir = new File(getContext().getCacheDir(), "shared_files");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }
            File sharedFile = new File(cacheDir, fileName);
            FileOutputStream fos = new FileOutputStream(sharedFile);
            fos.write(data);
            fos.flush();
            fos.close();

            Uri fileUri = androidx.core.content.FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                sharedFile
            );

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType(mimeType);
            shareIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to share file: " + e.getMessage());
        }
    }

    private boolean hasUsageStatsPermission() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        int mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            getContext().getPackageName()
        );
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private String getKnownAppName(String pkg) {
        if (pkg == null) return null;
        if (pkg.contains("paisa") || pkg.contains("nbu.paisa")) return "Google Pay";
        if (pkg.contains("phonepe")) return "PhonePe";
        if (pkg.contains("paytm")) return "Paytm";
        if (pkg.contains("npci.upiapp")) return "BHIM UPI";
        if (pkg.contains("cred")) return "CRED";
        if (pkg.contains("amazon")) return "Amazon";
        if (pkg.contains("flipkart")) return "Flipkart";
        if (pkg.contains("hdfc")) return "HDFC Bank";
        if (pkg.contains("sbi")) return "SBI YONO";
        if (pkg.contains("icici")) return "ICICI iMobile";
        if (pkg.contains("axis")) return "Axis Mobile";
        if (pkg.contains("kotak")) return "Kotak Bank";
        return null;
    }

    private boolean isFinancialSMS(String sender, String body) {
        if (body == null || body.trim().length() < 8) return false;
        String lower = body.toLowerCase();

        // 1. Must contain at least one digit
        boolean hasDigit = false;
        for (int i = 0; i < body.length(); i++) {
            if (Character.isDigit(body.charAt(i))) {
                hasDigit = true;
                break;
            }
        }
        if (!hasDigit) return false;

        // 2. Currency indicator (Supports ₹, Rs., INR, USD, $)
        boolean hasCurrency = body.contains("₹") ||
                              lower.contains("rs.") ||
                              lower.contains("rs ") ||
                              lower.contains("rs:") ||
                              lower.contains("inr") ||
                              lower.contains("usd") ||
                              body.contains("$");

        // 3. Financial action keywords
        boolean hasAction = lower.contains("debit") ||
                            lower.contains("credit") ||
                            lower.contains("spent") ||
                            lower.contains("sent") ||
                            lower.contains("received") ||
                            lower.contains("paid") ||
                            lower.contains("pay") ||
                            lower.contains("transferred") ||
                            lower.contains("withdrawn") ||
                            lower.contains("purchase") ||
                            lower.contains("refund") ||
                            lower.contains("charge") ||
                            lower.contains("txn") ||
                            lower.contains("upi") ||
                            lower.contains("vpa") ||
                            lower.contains("atm") ||
                            lower.contains("bal") ||
                            lower.contains("avl") ||
                            lower.contains("a/c") ||
                            lower.contains("acct") ||
                            lower.contains("dr.") ||
                            lower.contains("cr.");

        // 4. Known financial or Indian bank senders
        boolean isBankSender = false;
        if (sender != null) {
            String s = sender.toUpperCase();
            isBankSender = s.contains("SBI") || s.contains("HDFC") || s.contains("ICICI") ||
                           s.contains("AXIS") || s.contains("KOTAK") || s.contains("PAYTM") ||
                           s.contains("BOB") || s.contains("PNB") || s.contains("YES") ||
                           s.contains("INDUS") || s.contains("UNION") || s.contains("CANARA") ||
                           s.contains("IDFC") || s.contains("IOB") || s.contains("CENT") ||
                           s.contains("FEDERAL") || s.contains("UPI") || s.contains("BHIM") ||
                           s.contains("GPAY") || s.contains("PHONPE") || s.contains("ALERT") ||
                           s.contains("BANK");
        }

        return (hasCurrency && hasAction) || (isBankSender && hasAction) || (isBankSender && hasCurrency);
    }

    @PluginMethod
    public void scheduleDailyReminder(PluginCall call) {
        int hour = call.getInt("hour", 20);
        int minute = call.getInt("minute", 0);
        String title = call.getString("title", "Expense Diary");
        String body = call.getString("body", "Remember to add today's expenses and income!");

        Context context = getContext();
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            call.reject("AlarmManager not available");
            return;
        }

        Intent intent = new Intent(context, ExpenseReminderReceiver.class);
        intent.setAction(ExpenseReminderReceiver.ACTION_REMINDER);
        intent.putExtra("title", title);
        intent.putExtra("body", body);

        PendingIntent pi = PendingIntent.getBroadcast(
            context,
            9901,
            intent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE : PendingIntent.FLAG_UPDATE_CURRENT
        );

        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.set(java.util.Calendar.HOUR_OF_DAY, hour);
        cal.set(java.util.Calendar.MINUTE, minute);
        cal.set(java.util.Calendar.SECOND, 0);
        cal.set(java.util.Calendar.MILLISECOND, 0);

        if (cal.getTimeInMillis() <= System.currentTimeMillis()) {
            cal.add(java.util.Calendar.DAY_OF_YEAR, 1);
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
            }
            JSObject res = new JSObject();
            res.put("success", true);
            res.put("scheduledTime", cal.getTimeInMillis());
            call.resolve(res);
        } catch (SecurityException se) {
            am.set(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
            JSObject res = new JSObject();
            res.put("success", true);
            res.put("scheduledTime", cal.getTimeInMillis());
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to schedule alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelDailyReminder(PluginCall call) {
        Context context = getContext();
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            Intent intent = new Intent(context, ExpenseReminderReceiver.class);
            intent.setAction(ExpenseReminderReceiver.ACTION_REMINDER);
            PendingIntent pi = PendingIntent.getBroadcast(
                context,
                9901,
                intent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE : PendingIntent.FLAG_UPDATE_CURRENT
            );
            am.cancel(pi);
        }
        JSObject res = new JSObject();
        res.put("success", true);
        call.resolve(res);
    }

    @PluginMethod
    public void isNotificationListenerEnabled(PluginCall call) {
        Context context = getContext();
        String pkgName = context.getPackageName();
        String flat = Settings.Secure.getString(context.getContentResolver(), "enabled_notification_listeners");
        boolean enabled = flat != null && flat.contains(pkgName);
        JSObject res = new JSObject();
        res.put("enabled", enabled);
        call.resolve(res);
    }

    @PluginMethod
    public void openNotificationListenerSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to open notification listener settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getRecentFinancialNotifications(PluginCall call) {
        try {
            String json = FinancialNotificationListener.getRecentSavedNotifications(getContext());
            org.json.JSONArray arr = new org.json.JSONArray(json);
            JSArray outArr = new JSArray();
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject obj = arr.getJSONObject(i);
                JSObject j = new JSObject();
                j.put("packageName", obj.optString("packageName"));
                j.put("title", obj.optString("title"));
                j.put("text", obj.optString("text"));
                j.put("timestamp", obj.optLong("timestamp"));
                outArr.put(j);
            }
            JSObject res = new JSObject();
            res.put("notifications", outArr);
            call.resolve(res);
        } catch (Exception e) {
            JSObject res = new JSObject();
            res.put("notifications", new JSArray());
            call.resolve(res);
        }
    }

    @PluginMethod
    public void getPendingIncomingTransactions(PluginCall call) {
        try {
            String json = FinancialSmsReceiver.drainPendingTransactions(getContext());
            org.json.JSONArray arr = new org.json.JSONArray(json);
            JSArray outArr = new JSArray();
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject obj = arr.getJSONObject(i);
                JSObject j = new JSObject();
                j.put("id", obj.optString("id"));
                j.put("source", obj.optString("source"));
                j.put("sender", obj.optString("sender"));
                j.put("text", obj.optString("text"));
                j.put("timestamp", obj.optLong("timestamp"));
                outArr.put(j);
            }
            JSObject res = new JSObject();
            res.put("transactions", outArr);
            call.resolve(res);
        } catch (Exception e) {
            JSObject res = new JSObject();
            res.put("transactions", new JSArray());
            call.resolve(res);
        }
    }

    @PluginMethod
    public void savePersistentVault(PluginCall call) {
        String vaultData = call.getString("vaultData", "");
        if (vaultData == null || vaultData.trim().isEmpty()) {
            call.reject("vaultData cannot be empty");
            return;
        }

        try {
            Context context = getContext();

            // 1. Save to SharedPreferences (survives APK updates and webview cache clears)
            SharedPreferences prefs = context.getSharedPreferences("expense_diary_vault_prefs", Context.MODE_PRIVATE);
            prefs.edit()
                .putString("vault_data", vaultData)
                .putLong("saved_at", System.currentTimeMillis())
                .apply();

            // 2. Save to internal hidden directory (.smart_vault)
            File internalDir = new File(context.getFilesDir(), ".smart_vault");
            if (!internalDir.exists()) internalDir.mkdirs();
            File vaultFile = new File(internalDir, "vault.edb");
            File tempFile = new File(internalDir, "vault.edb.tmp");

            FileOutputStream fos = new FileOutputStream(tempFile);
            fos.write(vaultData.getBytes(StandardCharsets.UTF_8));
            fos.flush();
            try { fos.getFD().sync(); } catch (Exception ignored) {}
            fos.close();

            if (vaultFile.exists()) {
                File backupFile = new File(internalDir, "vault_backup.edb");
                if (backupFile.exists()) backupFile.delete();
                vaultFile.renameTo(backupFile);
            }
            tempFile.renameTo(vaultFile);

            // 3. Save mirror to Android scoped external hidden directory: Android/data/<pkg>/files/.smart_vault/
            try {
                File extDir = context.getExternalFilesDir(null);
                if (extDir != null) {
                    File extHidden = new File(extDir, ".smart_vault");
                    if (!extHidden.exists()) extHidden.mkdirs();
                    File extFile = new File(extHidden, "vault.edb");
                    FileOutputStream extFos = new FileOutputStream(extFile);
                    extFos.write(vaultData.getBytes(StandardCharsets.UTF_8));
                    extFos.flush();
                    extFos.close();
                }
            } catch (Exception ignored) {}

            // 4. Save mirror to root external hidden directory: /.smart_expense_vault/
            try {
                File rootDir = new File(Environment.getExternalStorageDirectory(), ".smart_expense_vault");
                if (!rootDir.exists()) rootDir.mkdirs();
                File rootFile = new File(rootDir, "vault.edb");
                FileOutputStream rootFos = new FileOutputStream(rootFile);
                rootFos.write(vaultData.getBytes(StandardCharsets.UTF_8));
                rootFos.flush();
                rootFos.close();
            } catch (Exception ignored) {}

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("timestamp", System.currentTimeMillis());
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to save persistent vault: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPersistentVault(PluginCall call) {
        try {
            Context context = getContext();
            String vaultData = null;

            // Priority 1: SharedPreferences
            SharedPreferences prefs = context.getSharedPreferences("expense_diary_vault_prefs", Context.MODE_PRIVATE);
            String fromPrefs = prefs.getString("vault_data", null);
            if (fromPrefs != null && !fromPrefs.trim().isEmpty()) {
                vaultData = fromPrefs;
            }

            // Priority 2: Scoped external hidden directory: Android/data/<pkg>/files/.smart_vault/vault.edb
            if (vaultData == null || vaultData.trim().isEmpty()) {
                try {
                    File extDir = context.getExternalFilesDir(null);
                    if (extDir != null) {
                        File extFile = new File(new File(extDir, ".smart_vault"), "vault.edb");
                        if (extFile.exists() && extFile.length() > 0) {
                            vaultData = readFileToString(extFile);
                        }
                    }
                } catch (Exception ignored) {}
            }

            // Priority 3: Internal hidden storage file: filesDir/.smart_vault/vault.edb
            if (vaultData == null || vaultData.trim().isEmpty()) {
                File vaultFile = new File(new File(context.getFilesDir(), ".smart_vault"), "vault.edb");
                if (vaultFile.exists() && vaultFile.length() > 0) {
                    vaultData = readFileToString(vaultFile);
                }
            }

            // Priority 4: Root external hidden directory: /.smart_expense_vault/vault.edb
            if (vaultData == null || vaultData.trim().isEmpty()) {
                try {
                    File rootFile = new File(new File(Environment.getExternalStorageDirectory(), ".smart_expense_vault"), "vault.edb");
                    if (rootFile.exists() && rootFile.length() > 0) {
                        vaultData = readFileToString(rootFile);
                    }
                } catch (Exception ignored) {}
            }

            // Priority 5: Internal backup file
            if (vaultData == null || vaultData.trim().isEmpty()) {
                File backupFile = new File(new File(context.getFilesDir(), ".smart_vault"), "vault_backup.edb");
                if (backupFile.exists() && backupFile.length() > 0) {
                    vaultData = readFileToString(backupFile);
                }
            }

            JSObject res = new JSObject();
            if (vaultData != null && !vaultData.trim().isEmpty()) {
                res.put("exists", true);
                res.put("vaultData", vaultData);
            } else {
                res.put("exists", false);
            }
            call.resolve(res);
        } catch (Exception e) {
            JSObject res = new JSObject();
            res.put("exists", false);
            res.put("error", e.getMessage());
            call.resolve(res);
        }
    }

    @PluginMethod
    public void clearPersistentVault(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences("expense_diary_vault_prefs", Context.MODE_PRIVATE);
            prefs.edit().clear().apply();

            File vaultFile = new File(context.getFilesDir(), "expense_diary_vault.json");
            if (vaultFile.exists()) vaultFile.delete();
            File backupFile = new File(context.getFilesDir(), "expense_diary_vault_backup.json");
            if (backupFile.exists()) backupFile.delete();
            try {
                File extDir = context.getExternalFilesDir(null);
                if (extDir != null) {
                    File extFile = new File(extDir, "expense_diary_vault_mirror.json");
                    if (extFile.exists()) extFile.delete();
                }
            } catch (Exception ignored) {}

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to clear vault: " + e.getMessage());
        }
    }

    private String readFileToString(File file) {
        try {
            FileInputStream fis = new FileInputStream(file);
            byte[] bytes = new byte[(int) file.length()];
            fis.read(bytes);
            fis.close();
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return null;
        }
    }
}
