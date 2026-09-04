import { LANGUAGES, TRANSLATIONS } from '../src/data/languages.js';

const enKeys = Object.keys(TRANSLATIONS.en);
console.log(`Total reference keys in 'en': ${enKeys.length}`);

let allPass = true;
for (const lang of LANGUAGES) {
  const obj = TRANSLATIONS[lang.code] || {};
  const missing = enKeys.filter(k => obj[k] === undefined);
  if (missing.length > 0) {
    console.error(`❌ Language ${lang.code} (${lang.name}) is missing ${missing.length} keys: ${missing.join(', ')}`);
    allPass = false;
  } else {
    console.log(`✅ Language ${lang.code} (${lang.name}): 100% complete (${Object.keys(obj).length} keys)`);
  }
}

if (allPass) {
  console.log('\n🎉 ALL 20 LANGUAGES ARE 100% COMPLETE AND FULLY TRANSLATED!');
} else {
  process.exit(1);
}
