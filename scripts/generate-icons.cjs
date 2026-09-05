const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SRC_ICON = path.join(ROOT, 'public/smart_app_icon_master.jpg');

if (!fs.existsSync(SRC_ICON)) {
  console.error('Source icon not found at', SRC_ICON);
  process.exit(1);
}

const pwaSizes = [
  { file: path.join(ROOT, 'public/icon-512.png'), size: 512 },
  { file: path.join(ROOT, 'public/icon-192.png'), size: 192 },
  { file: path.join(ROOT, 'public/icon-maskable-512.png'), size: 512 },
  { file: path.join(ROOT, 'public/icon-maskable-192.png'), size: 192 },
];

const mipmaps = [
  { dir: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
  { dir: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
  { dir: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
  { dir: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
  { dir: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
];

console.log('Generating PWA icons...');
for (const item of pwaSizes) {
  const cmd = `ffmpeg -y -i "${SRC_ICON}" -vf "scale=${item.size}:${item.size}" -update 1 "${item.file}"`;
  execSync(cmd, { stdio: 'ignore' });
}

console.log('Generating Android launcher mipmaps...');
const resDir = path.join(ROOT, 'android/app/src/main/res');

for (const m of mipmaps) {
  const targetFolder = path.join(resDir, m.dir);
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // 1. ic_launcher.png (Legacy square launcher icon)
  const launcherPath = path.join(targetFolder, 'ic_launcher.png');
  execSync(`ffmpeg -y -i "${SRC_ICON}" -vf "scale=${m.iconSize}:${m.iconSize}" -update 1 "${launcherPath}"`, { stdio: 'ignore' });

  // 2. ic_launcher_round.png (Legacy circular launcher icon)
  const roundPath = path.join(targetFolder, 'ic_launcher_round.png');
  execSync(`ffmpeg -y -i "${SRC_ICON}" -vf "scale=${m.iconSize}:${m.iconSize}" -update 1 "${roundPath}"`, { stdio: 'ignore' });

  // 3. ic_launcher_foreground.png (Adaptive icon foreground with 72% safe-area scaling on emerald background #064E3B)
  const fgPath = path.join(targetFolder, 'ic_launcher_foreground.png');
  const innerSize = Math.round(m.fgSize * 0.72);
  const padOffset = Math.round((m.fgSize - innerSize) / 2);
  execSync(
    `ffmpeg -y -i "${SRC_ICON}" -vf "scale=${innerSize}:${innerSize},pad=${m.fgSize}:${m.fgSize}:${padOffset}:${padOffset}:color=0x064E3B" -update 1 "${fgPath}"`,
    { stdio: 'ignore' }
  );

  console.log(`Generated ${m.dir} icons.`);
}

console.log('All icons successfully generated and synced!');
