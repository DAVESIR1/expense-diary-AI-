#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeRead(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

function safeWrite(p, data) {
  try { fs.writeFileSync(p, data, 'utf8'); return true; } catch (e) { console.error('Write failed', p, e); return false; }
}

const projectRoot = path.resolve(__dirname, '..');
const androidDir = path.join(projectRoot, 'android');
if (!fs.existsSync(androidDir)) {
  console.error('Android directory not found. Run `npx @capacitor/cli add android` first.');
  process.exit(1);
}

// 1. Copy persistent release and debug keystores for consistent signing across all builds.
//    On CI the `signing/` folder is gitignored and absent — generate a throwaway
//    keystore via keytool so the release build still signs (CI artifacts aren't
//    published to Play, they are diagnostic). Local builds always win the copy above.
const sourceReleaseKeystore = path.join(projectRoot, 'signing', 'release.keystore');
const sourceDebugKeystore = path.join(projectRoot, 'signing', 'debug.keystore');
const destReleaseKeystore = path.join(androidDir, 'app', 'release.keystore');
const destDebugKeystore = path.join(androidDir, 'app', 'debug.keystore');

function generateKeystore(dest, alias, password) {
  const { execSync } = require('child_process');
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const dname = 'CN=Expense Diary AI, OU=Development, O=ExpenseDiary, L=Unknown, S=Unknown, C=IN';
    const cmd = `keytool -genkeypair -v -keystore "${dest}" -alias ${alias} -keyalg RSA -keysize 2048 -validity 10000 -storepass ${password} -keypass ${password} -dname "${dname}" -storetype JKS`;
    execSync(cmd, { stdio: 'ignore' });
    console.log(`Generated ${path.relative(projectRoot, dest)} via keytool`);
    return true;
  } catch (e) {
    console.warn(`Warning: could not generate keystore at ${dest}:`, e?.message || e);
    return false;
  }
}

if (fs.existsSync(sourceReleaseKeystore)) {
  fs.mkdirSync(path.dirname(destReleaseKeystore), { recursive: true });
  fs.copyFileSync(sourceReleaseKeystore, destReleaseKeystore);
  console.log('Copied persistent signing/release.keystore to android/app/release.keystore');
} else if (!fs.existsSync(destReleaseKeystore)) {
  // CI fallback: sign with a freshly generated keystore so the build succeeds.
  generateKeystore(destReleaseKeystore, 'expensediary', 'expensediary');
}
if (fs.existsSync(sourceDebugKeystore)) {
  fs.mkdirSync(path.dirname(destDebugKeystore), { recursive: true });
  fs.copyFileSync(sourceDebugKeystore, destDebugKeystore);
  console.log('Copied persistent signing/debug.keystore to android/app/debug.keystore');
} else if (!fs.existsSync(destDebugKeystore)) {
  generateKeystore(destDebugKeystore, 'expensediary', 'expensediary');
}

// 2. Patch variables.gradle to set compileSdkVersion/targetSdkVersion
const variablesGradle = path.join(androidDir, 'variables.gradle');
const appBuildGradle = path.join(androidDir, 'app', 'build.gradle');

const desiredSdk = 35;

if (fs.existsSync(variablesGradle)) {
  let v = safeRead(variablesGradle);
  if (v) {
    v = v.replace(/compileSdkVersion\s*=\s*\d+/g, `compileSdkVersion = ${desiredSdk}`);
    v = v.replace(/targetSdkVersion\s*=\s*\d+/g, `targetSdkVersion = ${desiredSdk}`);
    safeWrite(variablesGradle, v);
    console.log('Patched variables.gradle');
  }
}

if (fs.existsSync(appBuildGradle)) {
  let b = safeRead(appBuildGradle);
  if (b) {
    // Cleanly replace any existing signingConfigs and buildTypes with the regulatory production signing block
    const signingAndBuildTypesBlock = `    signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword 'expensediary'
            keyAlias 'expensediary'
            keyPassword 'expensediary'
            v1SigningEnabled true
            v2SigningEnabled true
        }
        debug {
            storeFile file('release.keystore')
            storePassword 'expensediary'
            keyAlias 'expensediary'
            keyPassword 'expensediary'
            v1SigningEnabled true
            v2SigningEnabled true
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }`;

    // Remove old signingConfigs if present
    b = b.replace(/signingConfigs\s*\{[\s\S]*?buildTypes\s*\{/, 'buildTypes {');
    // Replace buildTypes with both signingConfigs and buildTypes
    b = b.replace(/buildTypes\s*\{[\s\S]*?\n\s*\}\s*\}/, signingAndBuildTypesBlock);

    safeWrite(appBuildGradle, b);
    console.log('Patched android/app/build.gradle with regulatory release signingConfigs');
  }
}

// 3. Write NativeBridgePlugin.java
const javaSrcDir = path.join(androidDir, 'app', 'src', 'main', 'java', 'com', 'expensediary', 'ai');
fs.mkdirSync(javaSrcDir, { recursive: true });

const nativePluginCode = `package com.expensediary.ai;

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
`;

safeWrite(path.join(javaSrcDir, 'NativeBridgePlugin.java'), nativePluginCode);
console.log('Injected NativeBridgePlugin.java');

// 4. Register plugin in MainActivity.java with DownloadListener and DOM Storage enabled
const mainActivityPath = path.join(javaSrcDir, 'MainActivity.java');
const mainActivityCode = `package com.expensediary.ai;

import android.os.Bundle;
import android.webkit.DownloadListener;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeBridgePlugin.class);
        super.onCreate(savedInstanceState);

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebSettings ws = this.bridge.getWebView().getSettings();
            ws.setDomStorageEnabled(true);
            ws.setDatabaseEnabled(true);

            this.bridge.getWebView().setDownloadListener(new DownloadListener() {
                @Override
                public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                    try {
                        android.content.Intent i = new android.content.Intent(android.content.Intent.ACTION_VIEW);
                        i.setData(android.net.Uri.parse(url));
                        startActivity(i);
                    } catch (Exception ignored) {}
                }
            });
        }
    }
}
`;
safeWrite(mainActivityPath, mainActivityCode);
console.log('Injected MainActivity.java with NativeBridgePlugin and DownloadListener');

// 4b. Write ExpenseReminderReceiver.java
const receiverCode = `package com.expensediary.ai;

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
`;
safeWrite(path.join(javaSrcDir, 'ExpenseReminderReceiver.java'), receiverCode);
console.log('Injected ExpenseReminderReceiver.java');

// 4c. Write FinancialNotificationListener.java
const listenerCode = `package com.expensediary.ai;

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
                                       lowerText.contains("₹") ||
                                       lowerText.contains("inr") ||
                                       lowerText.contains("debited") ||
                                       lowerText.contains("credited") ||
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
`;
safeWrite(path.join(javaSrcDir, 'FinancialNotificationListener.java'), listenerCode);
console.log('Injected FinancialNotificationListener.java');

// 4d. Write FinancialSmsReceiver.java
const smsReceiverCode = `package com.expensediary.ai;

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
                                     lower.contains("paid") ||
                                     lower.contains("spent") ||
                                     lower.contains("sent") ||
                                     lower.contains("received") ||
                                     lower.contains("transferred") ||
                                     lower.contains("withdrawn") ||
                                     lower.contains("txn of") ||
                                     lower.contains("nps") ||
                                     lower.contains("pran") ||
                                     lower.contains("sip") ||
                                     lower.contains("mutual fund") ||
                                     lower.contains("upi");

        boolean hasCurrency = body.contains("₹") ||
                              lower.contains("rs.") ||
                              lower.contains("rs ") ||
                              lower.contains("inr") ||
                              body.contains("$");

        return hasFinancialAction && (hasCurrency || lower.contains("nps") || lower.contains("upi"));
    }
}
`;
safeWrite(path.join(javaSrcDir, 'FinancialSmsReceiver.java'), smsReceiverCode);
console.log('Injected FinancialSmsReceiver.java');

// Ensure res/xml/file_paths.xml exists for FileProvider
const resXmlDir = path.join(androidDir, 'app', 'src', 'main', 'res', 'xml');
fs.mkdirSync(resXmlDir, { recursive: true });
const filePathsXml = `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="shared_files" path="shared_files/" />
    <external-path name="downloads" path="Download/" />
</paths>
`;
safeWrite(path.join(resXmlDir, 'file_paths.xml'), filePathsXml);

// 5. Patch AndroidManifest.xml with tools namespace and all runtime permissions
const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let m = safeRead(manifestPath);
  if (m) {
    if (!/xmlns:tools=/.test(m)) {
      m = m.replace('<manifest', '<manifest xmlns:tools="http://schemas.android.com/tools"');
    }

    const permissions = `
    <uses-permission android:name="android.permission.RECEIVE_SMS" />
    <uses-permission android:name="android.permission.READ_SMS" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />
    <uses-permission android:name="android.permission.USE_FINGERPRINT" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" tools:ignore="ScopedStorage" />
    <uses-permission android:name="android.permission.PACKAGE_USAGE_STATS" tools:ignore="ProtectedPermissions" />
    <uses-permission android:name="android.permission.BROADCAST_SMS" tools:ignore="ProtectedPermissions" />
`;
    // Clean old permissions if needed
    m = m.replace(/<uses-permission\s+android:name="android\.permission\.(RECEIVE_SMS|READ_SMS|POST_NOTIFICATIONS|VIBRATE|WAKE_LOCK|USE_BIOMETRIC|USE_FINGERPRINT|SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|PACKAGE_USAGE_STATS|BROADCAST_SMS)"[^>]*\/>/g, '');
    m = m.replace('<application', permissions.trim() + '\n    <application');

    // Add FileProvider, Reminder Receiver, SMS Receiver, and Notification Listener to application if not present
    if (!/androidx\.core\.content\.FileProvider/.test(m)) {
      const provider = `
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
      `;
      m = m.replace('</application>', provider + '\n    </application>');
    }

    if (!/ExpenseReminderReceiver/.test(m)) {
      const receiverEntry = `
        <receiver
            android:name=".ExpenseReminderReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="com.expensediary.ai.ALARM_EXPENSE_REMINDER" />
            </intent-filter>
        </receiver>
      `;
      m = m.replace('</application>', receiverEntry + '\n    </application>');
    }

    if (!/FinancialSmsReceiver/.test(m)) {
      const smsReceiverEntry = `
        <receiver
            android:name=".FinancialSmsReceiver"
            android:permission="android.permission.BROADCAST_SMS"
            android:exported="true">
            <intent-filter android:priority="999">
                <action android:name="android.provider.Telephony.SMS_RECEIVED" />
            </intent-filter>
        </receiver>
      `;
      m = m.replace('</application>', smsReceiverEntry + '\n    </application>');
    }

    if (!/FinancialNotificationListener/.test(m)) {
      const serviceEntry = `
        <service
            android:name=".FinancialNotificationListener"
            android:label="Expense Diary Financial Listener"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
      `;
      m = m.replace('</application>', serviceEntry + '\n    </application>');
    }

    // Ensure application tag has standard icons
    m = m.replace(/android:icon="[^"]*"/, 'android:icon="@mipmap/ic_launcher"');
    m = m.replace(/android:roundIcon="[^"]*"/, 'android:roundIcon="@mipmap/ic_launcher_round"');

    // Ensure MainActivity activity tag has explicit android:icon and android:roundIcon
    if (!m.includes('android:name=".MainActivity"\n            android:icon="@mipmap/ic_launcher"')) {
      m = m.replace(
        'android:name=".MainActivity"',
        'android:name=".MainActivity"\n            android:icon="@mipmap/ic_launcher"\n            android:roundIcon="@mipmap/ic_launcher_round"'
      );
    }

    m = m.replace(/\n\s*\n\s*\n+/g, '\n\n');
    safeWrite(manifestPath, m);
    console.log('Patched AndroidManifest.xml with all required native permissions, FileProvider, Receivers, Service, and launcher icons');
  }
}

// 6. Ensure icon assets and drawables are generated
const resDir = path.join(androidDir, 'app', 'src', 'main', 'res');
try {
  const { execSync } = await import('child_process');
  const aiGenScript = path.join(projectRoot, 'scripts', 'generate-icons.cjs');
  const genScript = path.join(projectRoot, 'scripts', 'generate_icons.py');
  if (fs.existsSync(aiGenScript)) {
    execSync(`node "${aiGenScript}"`, { stdio: 'inherit' });
    console.log('Generated AI launcher mipmaps and PWA icons.');
  } else if (fs.existsSync(genScript)) {
    execSync(`python3 "${genScript}"`, { stdio: 'inherit' });
    console.log('Generated Android mipmap and PWA icons.');
  }
} catch (e) {
  console.warn('Icon generator warning:', e.message);
}

// Ensure adaptive icon XMLs use @mipmap/ic_launcher_foreground and remove conflicting vector drawables
const mipmapAnyDpi = path.join(resDir, 'mipmap-anydpi-v26');
fs.mkdirSync(mipmapAnyDpi, { recursive: true });
const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
safeWrite(path.join(mipmapAnyDpi, 'ic_launcher.xml'), adaptiveXml);
safeWrite(path.join(mipmapAnyDpi, 'ic_launcher_round.xml'), adaptiveXml);

const vectorFg = path.join(resDir, 'drawable', 'ic_launcher_foreground.xml');
const vectorFgV24 = path.join(resDir, 'drawable-v24', 'ic_launcher_foreground.xml');
if (fs.existsSync(vectorFg)) fs.unlinkSync(vectorFg);
if (fs.existsSync(vectorFgV24)) fs.unlinkSync(vectorFgV24);

// 7. Fallback: directly ensure drawable/ic_notification.xml exists
const notifXmlPath = path.join(resDir, 'drawable', 'ic_notification.xml');
if (!fs.existsSync(notifXmlPath)) {
  fs.mkdirSync(path.dirname(notifXmlPath), { recursive: true });
  const fallbackNotifXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M18,2H6C4.9,2 4,2.9 4,4v16c0,1.1 0.9,2 2,2h12c1.1,0 2,-0.9 2,-2V4C20,2.9 19.1,2 18,2z M12,10l-2,-1.5L8,10V4h4V10z M18,20H6V4h1v8l3,-2.25L13,12V4h5V20z" />
</vector>`;
  safeWrite(notifXmlPath, fallbackNotifXml);
  console.log('Created fallback drawable/ic_notification.xml');
}

// 8. Patch Notification Icon in AndroidManifest.xml
if (fs.existsSync(manifestPath) && fs.existsSync(notifXmlPath)) {
  let m = safeRead(manifestPath);
  if (m && !/default_notification_icon/.test(m)) {
    const metaData = `
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/ic_notification" />
`;
    m = m.replace('</application>', metaData + '\n    </application>');
    safeWrite(manifestPath, m);
    console.log('Patched AndroidManifest.xml with notification icon');
  }
}

// 9. Patch strings.xml with official app_name
const stringsXmlPath = path.join(resDir, 'values', 'strings.xml');
if (fs.existsSync(stringsXmlPath)) {
  let s = safeRead(stringsXmlPath);
  if (s) {
    s = s.replace(/<string name="app_name">.*?<\/string>/, '<string name="app_name">smart expence income</string>');
    s = s.replace(/<string name="title_activity_main">.*?<\/string>/, '<string name="title_activity_main">smart expence income</string>');
    safeWrite(stringsXmlPath, s);
    console.log('Patched strings.xml with smart expence income');
  }
}

console.log('Android patch complete.');
