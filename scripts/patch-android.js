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

// 1. Copy persistent debug keystore for consistent signing across all builds
const sourceKeystore = path.join(projectRoot, 'signing', 'debug.keystore');
const destKeystore = path.join(androidDir, 'app', 'debug.keystore');
if (fs.existsSync(sourceKeystore)) {
  fs.mkdirSync(path.dirname(destKeystore), { recursive: true });
  fs.copyFileSync(sourceKeystore, destKeystore);
  console.log('Copied persistent signing/debug.keystore to android/app/debug.keystore');
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
    // Ensure signingConfigs has debug keystore configured
    if (!/signingConfigs\s*\{/.test(b)) {
      const signingConfigBlock = `
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
`;
      b = b.replace(/buildTypes\s*\{/, signingConfigBlock + '\n    buildTypes {');
    }

    // Ensure release uses signingConfigs.debug if no key.properties
    const keyPropsPath = path.join(projectRoot, 'key.properties');
    if (!fs.existsSync(keyPropsPath)) {
      b = b.replace(/release\s*\{([\s\S]*?)\n\s*\}/, (m, inner) => {
        if (/signingConfig/.test(inner)) return m;
        return `release {${inner}\n            signingConfig signingConfigs.debug\n        }`;
      });
    }

    safeWrite(appBuildGradle, b);
    console.log('Patched android/app/build.gradle with persistent keystore');
  }
}

// 3. Write NativeBridgePlugin.java
const javaSrcDir = path.join(androidDir, 'app', 'src', 'main', 'java', 'com', 'expensediary', 'ai');
fs.mkdirSync(javaSrcDir, { recursive: true });

const nativePluginCode = `package com.expensediary.ai;

import android.Manifest;
import android.app.AppOpsManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
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
            call.resolve(res);
            return;
        }

        try {
            Uri inboxUri = Uri.parse("content://sms/inbox");
            long lookback = System.currentTimeMillis() - (48 * 60 * 60 * 1000);

            Cursor cursor = getContext().getContentResolver().query(
                inboxUri,
                new String[]{"_id", "address", "body", "date"},
                "date > ?",
                new String[]{String.valueOf(lookback)},
                "date DESC"
            );

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String id = cursor.getString(0);
                    String address = cursor.getString(1);
                    String body = cursor.getString(2);
                    long date = cursor.getLong(3);

                    if (body != null && isFinancialSMS(address, body)) {
                        JSObject sms = new JSObject();
                        sms.put("id", id);
                        sms.put("address", address);
                        sms.put("body", body);
                        sms.put("timestamp", date);
                        messages.put(sms);
                    }
                }
                cursor.close();
            }

            JSObject res = new JSObject();
            res.put("hasPermission", true);
            res.put("messages", messages);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Error reading SMS: " + e.getMessage());
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
        String lower = body.toLowerCase();
        boolean hasAmount = lower.contains("rs.") || lower.contains("rs ") || lower.contains("inr") || lower.matches(".*\\\\b\\\\d+(\\\\.\\\\d{1,2})?\\\\b.*");
        boolean hasAction = lower.contains("debited") || lower.contains("credited") || lower.contains("spent") || lower.contains("sent") || lower.contains("received") || lower.contains("paid") || lower.contains("transferred");
        return hasAmount && hasAction;
    }
}
`;

safeWrite(path.join(javaSrcDir, 'NativeBridgePlugin.java'), nativePluginCode);
console.log('Injected NativeBridgePlugin.java');

// 4. Register plugin in MainActivity.java
const mainActivityPath = path.join(javaSrcDir, 'MainActivity.java');
const mainActivityCode = `package com.expensediary.ai;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`;
safeWrite(mainActivityPath, mainActivityCode);
console.log('Injected MainActivity.java with NativeBridgePlugin registered');

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
    <uses-permission android:name="android.permission.PACKAGE_USAGE_STATS" tools:ignore="ProtectedPermissions" />
`;
    // Clean old permissions if needed
    m = m.replace(/<uses-permission\s+android:name="android\.permission\.(RECEIVE_SMS|READ_SMS|POST_NOTIFICATIONS|VIBRATE|WAKE_LOCK|USE_BIOMETRIC|PACKAGE_USAGE_STATS)"[^>]*\/>/g, '');
    m = m.replace('<application', permissions.trim() + '\n    <application');
    safeWrite(manifestPath, m);
    console.log('Patched AndroidManifest.xml with all required native permissions');
  }
}

// 6. Ensure icon assets and drawables are generated
try {
  const { execSync } = await import('child_process');
  const genScript = path.join(projectRoot, 'scripts', 'generate_icons.py');
  if (fs.existsSync(genScript)) {
    execSync(`python3 "${genScript}"`, { stdio: 'inherit' });
    console.log('Generated Android mipmap and PWA icons.');
  }
} catch (e) {
  console.warn('Icon generator warning:', e.message);
}

// 7. Fallback: directly ensure drawable/ic_notification.xml exists
const resDir = path.join(androidDir, 'app', 'src', 'main', 'res');
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

console.log('Android patch complete.');
