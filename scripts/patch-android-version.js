#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, '..');
const capConfigPath = path.join(root, 'capacitor.config.json');
const androidBuildGradle = path.join(root, 'android', 'app', 'build.gradle');

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

const cap = readJSON(capConfigPath);
if (!cap) {
  console.error('capacitor.config.json not found or invalid.');
  process.exit(1);
}

const versionCode = cap.versionCode || 1;
const versionName = cap.versionName || cap.version || '1.0.0';

if (!fs.existsSync(androidBuildGradle)) {
  console.error('Android build.gradle not found. Run `npx @capacitor/cli add android` first.');
  process.exit(1);
}

let gradle = fs.readFileSync(androidBuildGradle, 'utf8');

// Try to set versionCode and versionName in defaultConfig
gradle = gradle.replace(/versionCode\s+\d+/g, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+\"[^"]*\"/g, `versionName \"${versionName}\"`);

// If not present, insert into defaultConfig
if (!/versionCode\s+\d+/.test(gradle) || !/versionName\s+\"/.test(gradle)) {
  gradle = gradle.replace(/defaultConfig\s*\{/, `defaultConfig {\n        versionCode ${versionCode}\n        versionName \"${versionName}\"\n`);
}

fs.writeFileSync(androidBuildGradle, gradle, 'utf8');
console.log('Patched android/app/build.gradle with versionCode=' + versionCode + ' versionName=' + versionName);

