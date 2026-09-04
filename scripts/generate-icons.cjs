const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SRC_ICON = '/home/davesir/.gemini/antigravity-ide/brain/ac8d1944-4c0e-4ec4-aebb-85a4862c8af4/smart_app_icon_1788549677719.jpg';
const ROOT = path.resolve(__dirname, '..');

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
  execSync(cmd, { stdio: 'inherit' });
}

console.log('Generating Android launcher mipmaps...');
const resDir = path.join(ROOT, 'android/app/src/main/res');

for (const m of mipmaps) {
  const targetFolder = path.join(resDir, m.dir);
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // ic_launcher.png
  const launcherPath = path.join(targetFolder, 'ic_launcher.png');
  execSync(`ffmpeg -y -i "${SRC_ICON}" -vf "scale=${m.iconSize}:${m.iconSize}" -update 1 "${launcherPath}"`, { stdio: 'ignore' });

  // ic_launcher_round.png
  const roundPath = path.join(targetFolder, 'ic_launcher_round.png');
  execSync(`ffmpeg -y -i "${SRC_ICON}" -vf "scale=${m.iconSize}:${m.iconSize}" -update 1 "${roundPath}"`, { stdio: 'ignore' });

  // ic_launcher_foreground.png (scaled to adaptive foreground size with black background)
  const fgPath = path.join(targetFolder, 'ic_launcher_foreground.png');
  execSync(`ffmpeg -y -i "${SRC_ICON}" -vf "scale=${m.fgSize}:${m.fgSize}" -update 1 "${fgPath}"`, { stdio: 'ignore' });

  console.log(`Generated ${m.dir} icons.`);
}

console.log('All icons successfully generated!');
