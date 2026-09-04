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

// Patch variables.gradle to set compileSdkVersion/targetSdkVersion
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
    // Insert signing config loader if key.properties exists
    const keyPropsPath = path.join(projectRoot, 'key.properties');
    if (fs.existsSync(keyPropsPath) && !/keystorePropertiesFile/.test(b)) {
      const signingSnippet = `
    def keystorePropertiesFile = rootProject.file("../key.properties")
    def keystoreProperties = new Properties()
    if (keystorePropertiesFile.exists()) {
      keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
    }
`;
      b = b.replace('android {', 'android {' + signingSnippet);

      if (!/signingConfigs\s*\{/.test(b)) {
        const signingConfigBlock = `
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
`;
        b = b.replace(/buildTypes\s*\{/, signingConfigBlock + '\n    buildTypes {');
      }

      b = b.replace(/release\s*\{([\s\S]*?)\n\s*\}/, (m, inner) => {
        if (/signingConfig/.test(inner)) return m;
        return `release {${inner}\n            signingConfig signingConfigs.release\n        }`;
      });
    }

    safeWrite(appBuildGradle, b);
    console.log('Patched android/app/build.gradle');
  }
}

// Patch AndroidManifest.xml for SMS permissions
const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let m = safeRead(manifestPath);
  if (m && !/android\.permission\.RECEIVE_SMS/.test(m)) {
    const permissions = `
    <uses-permission android:name="android.permission.RECEIVE_SMS" />
    <uses-permission android:name="android.permission.READ_SMS" />
`;
    m = m.replace('<application', permissions + '\n    <application');
    safeWrite(manifestPath, m);
    console.log('Patched AndroidManifest.xml with SMS permissions');
  }
}

// Patch Notification Icon in AndroidManifest.xml
if (fs.existsSync(manifestPath)) {
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

// Ensure icon assets are generated
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

console.log('Android patch complete.');


