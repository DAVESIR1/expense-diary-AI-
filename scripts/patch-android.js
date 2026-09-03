#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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

// Patch variables.gradle or build.gradle to set compileSdkVersion/targetSdkVersion
const variablesGradle = path.join(androidDir, 'variables.gradle');
const appBuildGradle = path.join(androidDir, 'app', 'build.gradle');

const desiredSdk = 35;

if (fs.existsSync(variablesGradle)) {
  let v = safeRead(variablesGradle);
  if (v) {
    v = v.replace(/compileSdkVersion\s*=\s*\d+/g, `compileSdkVersion = ${desiredSdk}`);
    v = v.replace(/targetSdkVersion\s*=\s*\d+/g, `targetSdkVersion = ${desiredSdk}`);
    safeWrite(variablesGradle, v);
    console.log('Patched', 'variables.gradle');
  }
}

if (fs.existsSync(appBuildGradle)) {
  let b = safeRead(appBuildGradle);
  if (b) {
    // Ensure targetSdkVersion/compileSdkVersion near defaultConfig
    b = b.replace(/targetSdkVersion\s+\d+/g, `targetSdkVersion ${desiredSdk}`);
    b = b.replace(/compileSdkVersion\s+\d+/g, `compileSdkVersion ${desiredSdk}`);

    // Insert signing config loader at top if not present
    if (!/keystorePropertiesFile/.test(b)) {
      const insertAt = 'android {';
      const signingSnippet = `
    def keystorePropertiesFile = rootProject.file("../key.properties")
    def keystoreProperties = new Properties()
    if (keystorePropertiesFile.exists()) {
      keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
    }
`;
      b = b.replace(insertAt, insertAt + signingSnippet);
    }

    // Add signingConfigs.release and apply to release buildType
    if (!/signingConfigs\s*\{[\s\S]*release\s*\{/.test(b)) {
      b = b.replace(/signingConfigs\s*\{\s*\}/, `signingConfigs {\n        release {\n          if (keystorePropertiesFile.exists()) {\n            storeFile file(keystoreProperties['storeFile'])\n            storePassword keystoreProperties['storePassword']\n            keyAlias keystoreProperties['keyAlias']\n            keyPassword keystoreProperties['keyPassword']\n          }\n        }\n      }`);
    }

    if (!/buildTypes\s*\{[\s\S]*release\s*\{[\s\S]*signingConfig/.test(b)) {
      b = b.replace(/buildTypes\s*\{/, `buildTypes {`);
      b = b.replace(/release\s*\{([\s\S]*?)\n\s*\}/, (m, inner) => {
        if (/signingConfig/.test(inner)) return m;
        return `release {${inner}\n        signingConfig signingConfigs.release\n      }`;
      });
    }

    safeWrite(appBuildGradle, b);
    console.log('Patched', 'android/app/build.gradle');
  }
}

// Copy adaptive icon assets if present in public
const publicDir = path.join(projectRoot, 'public');
const fg = path.join(publicDir, 'android-adaptive-icon-foreground.svg');
const bg = path.join(publicDir, 'android-adaptive-icon-background.svg');
if (fs.existsSync(fg) && fs.existsSync(bg)) {
  const mipmapDir = path.join(androidDir, 'app', 'src', 'main', 'res', 'mipmap-anydpi-v26');
  try { fs.mkdirSync(mipmapDir, { recursive: true }); } catch {}
  const outFg = path.join(mipmapDir, 'ic_launcher_foreground.xml');
  const outBg = path.join(mipmapDir, 'ic_launcher_background.xml');
  // Wrap SVGs into XML drawable wrapper for VectorDrawable compatibility may not be perfect; copy raw svg as drawable xml
  fs.copyFileSync(fg, outFg);
  fs.copyFileSync(bg, outBg);
  console.log('Copied adaptive icon assets to', mipmapDir);
}

console.log('Android patch complete. Please review changes before building.');
