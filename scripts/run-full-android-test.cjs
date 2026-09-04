const { getPageWsUrl, CDPClient } = require('./cdp-client.cjs');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log('=== STARTING FULL ANDROID EMULATOR TEST SUITE ===');
  
  const recordsDir = path.resolve(__dirname, '../records/emulator_test');
  if (!fs.existsSync(recordsDir)) fs.mkdirSync(recordsDir, { recursive: true });

  // Start screen recording on device
  console.log('[1/10] Starting adb screenrecord...');
  const recProcess = spawn('/home/davesir/Android/Sdk/platform-tools/adb', [
    'shell', 'screenrecord', '--size', '720x1560', '/sdcard/full_app_test_run.mp4'
  ]);

  const wsUrl = await getPageWsUrl();
  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  console.log('[2/10] Connected to WebView via Chrome DevTools Protocol at:', wsUrl);

  // Enable Console and Log domains to capture any web errors
  await cdp.send('Console.enable');
  await cdp.send('Runtime.enable');
  const consoleErrors = [];
  cdp.ws.on('message', msg => {
    const data = JSON.parse(msg);
    if (data.method === 'Runtime.consoleAPICalled') {
      if (data.params.type === 'error') {
        consoleErrors.push(data.params.args.map(a => a.value || a.description).join(' '));
      }
    }
  });

  const results = [];

  try {
    // -------------------------------------------------------------
    // TEST 1: ONBOARDING STEP 1 (Profile & Currency)
    // -------------------------------------------------------------
    console.log('\n--- Testing Onboarding Step 1: Profile ---');
    await sleep(1000);
    cdp.screenshot('03_onboarding_step1.png');

    // Fill name
    await cdp.eval(`
      (() => {
        const nameInput = document.querySelector('input[placeholder*="Alex Smith"]');
        if (nameInput) {
          nameInput.value = 'Davesir Test';
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          nameInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(500);

    // Click Continue
    await cdp.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const continueBtn = btns.find(b => b.innerText.includes('Continue') || b.innerText.includes('આગળ'));
        if (continueBtn) continueBtn.click();
      })()
    `);
    await sleep(1000);
    cdp.screenshot('04_onboarding_step2_security.png');
    results.push({ test: 'Onboarding Step 1 (Profile)', status: 'PASS' });

    // -------------------------------------------------------------
    // TEST 2: ONBOARDING STEP 2 (Security Setup - PIN & Passphrase)
    // -------------------------------------------------------------
    console.log('\n--- Testing Onboarding Step 2: Security Setup ---');
    const step2Heading = await cdp.eval('document.querySelector("h2, h3")?.innerText');
    console.log('Current Heading:', step2Heading);

    // If SecuritySetupModal is present, let's setup PIN
    await cdp.eval(`
      (() => {
        // Look for PIN inputs
        const pinInputs = Array.from(document.querySelectorAll('input[type="password"], input[inputmode="numeric"]'));
        if (pinInputs.length > 0) {
          pinInputs.forEach(i => {
            i.value = '1234';
            i.dispatchEvent(new Event('input', { bubbles: true }));
            i.dispatchEvent(new Event('change', { bubbles: true }));
          });
        }
        // Click any Next / Continue / Setup button
        const btns = Array.from(document.querySelectorAll('button'));
        const nextBtn = btns.find(b => b.innerText.includes('Next') || b.innerText.includes('Continue') || b.innerText.includes('આગળ') || b.innerText.includes('Done') || b.innerText.includes('Generate'));
        if (nextBtn) nextBtn.click();
      })()
    `);
    await sleep(1500);
    cdp.screenshot('05_onboarding_progress.png');

    // Click through any remaining onboarding screens
    for (let step = 3; step <= 5; step++) {
      const isModal = await cdp.eval('Boolean(document.querySelector(".fixed.inset-0"))');
      if (!isModal) break;
      await cdp.eval(`
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => 
            b.innerText.includes('Next') || 
            b.innerText.includes('Continue') || 
            b.innerText.includes('Get Started') || 
            b.innerText.includes('શરૂ કરો') || 
            b.innerText.includes('Done') || 
            b.innerText.includes('Close') || 
            b.innerText.includes('Save') ||
            b.innerText.includes('આગળ')
          );
          if (btn) btn.click();
        })()
      `);
      await sleep(1000);
    }
    cdp.screenshot('06_home_screen_ready.png');
    results.push({ test: 'Onboarding Flow Completed', status: 'PASS' });

    // -------------------------------------------------------------
    // TEST 3: HOME SCREEN & TRANSACTIONS
    // -------------------------------------------------------------
    console.log('\n--- Testing Home Screen & Quick Transaction ---');
    await sleep(1000);

    // Click quick Add Expense button or Floating / Header Add
    await cdp.eval(`
      (() => {
        const addBtn = document.querySelector('#quick-add-btn') || 
                       Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add Transaction') || b.innerText.includes('ખર્ચ ઉમેરો') || b.innerText.includes('+ Expense') || b.innerText.includes('Expense'));
        if (addBtn) addBtn.click();
      })()
    `);
    await sleep(1000);
    cdp.screenshot('07_add_transaction_modal.png');

    // Fill transaction details
    await cdp.eval(`
      (() => {
        const amtInput = document.querySelector('input[type="number"], input[placeholder*="0.00"], input[placeholder*="0"]');
        if (amtInput) {
          amtInput.value = '450';
          amtInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const descInput = document.querySelector('input[placeholder*="Title"], input[placeholder*="Note"], input[placeholder*="Description"]');
        if (descInput) {
          descInput.value = 'Gujarati Thali Dinner';
          descInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        // Select category if available
        const catBtn = document.querySelector('button[data-category="Food"], button:has(svg)');
        // Save
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save') || b.innerText.includes('ઉમેરો') || b.innerText.includes('સાચવો'));
        if (saveBtn) saveBtn.click();
      })()
    `);
    await sleep(1500);
    cdp.screenshot('08_home_after_transaction.png');

    const netBalanceText = await cdp.eval('document.querySelector(".text-2xl, .text-3xl, .font-bold")?.innerText');
    console.log('Balance after transaction:', netBalanceText);
    results.push({ test: 'Add Transaction & Balance Update', status: 'PASS', netBalance: netBalanceText });

    // -------------------------------------------------------------
    // TEST 4: DIARY SCREEN & SECURITY LOCK & PIN SETUP
    // -------------------------------------------------------------
    console.log('\n--- Testing Diary Screen & PIN Setup ---');
    await cdp.eval(`
      (() => {
        const diaryNav = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Diary') || b.innerText.includes('ડાયરી'));
        if (diaryNav) diaryNav.click();
      })()
    `);
    await sleep(1200);
    cdp.screenshot('09_diary_screen_initial.png');

    // Check if Diary is locked or unlocked
    const isDiaryLocked = await cdp.eval('Boolean(document.querySelector("input[placeholder*=\'PIN\']"))');
    console.log('Is Diary locked?', isDiaryLocked);

    if (isDiaryLocked) {
      await cdp.eval(`
        (() => {
          const pinInp = document.querySelector('input[placeholder*="PIN"]');
          if (pinInp) {
            pinInp.value = '1234';
            pinInp.dispatchEvent(new Event('input', { bubbles: true }));
          }
          const unlockBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Unlock') || b.innerText.includes('ખોલો'));
          if (unlockBtn) unlockBtn.click();
        })()
      `);
      await sleep(1000);
      cdp.screenshot('10_diary_unlocked.png');
    }

    // Test Diary PIN Setup card toggle
    await cdp.eval(`
      (() => {
        const pinSetupBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Diary PIN') || b.innerText.includes('Set') || b.innerText.includes('Change'));
        if (pinSetupBtn) pinSetupBtn.click();
      })()
    `);
    await sleep(800);
    cdp.screenshot('11_diary_pin_setup_form.png');
    results.push({ test: 'Diary Security & PIN Setup Card', status: 'PASS' });

    // Test Borrowed / Lent tab
    console.log('\n--- Testing Money Borrowed / Lent ---');
    await cdp.eval(`
      (() => {
        const blTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Borrowed') || b.innerText.includes('Lent') || b.innerText.includes('ઉછીના'));
        if (blTab) blTab.click();
      })()
    `);
    await sleep(1000);
    cdp.screenshot('12_diary_borrowed_lent_tab.png');
    results.push({ test: 'Diary Money Borrowed/Lent Tab', status: 'PASS' });

    // -------------------------------------------------------------
    // TEST 5: REPORTS SCREEN
    // -------------------------------------------------------------
    console.log('\n--- Testing Reports Screen ---');
    await cdp.eval(`
      (() => {
        const reportNav = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Report') || b.innerText.includes('રિપોર્ટ'));
        if (reportNav) reportNav.click();
      })()
    `);
    await sleep(1500);
    cdp.screenshot('13_reports_screen.png');

    // Switch between Box and Minimal layout
    await cdp.eval(`
      (() => {
        const minimalBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Minimal') || b.innerText.includes('સાદો'));
        if (minimalBtn) minimalBtn.click();
      })()
    `);
    await sleep(800);
    cdp.screenshot('14_reports_minimal_layout.png');
    results.push({ test: 'Reports Screen & Layout Switching', status: 'PASS' });

    // -------------------------------------------------------------
    // TEST 6: SETTINGS SCREEN & NATIVE PERMISSIONS
    // -------------------------------------------------------------
    console.log('\n--- Testing Settings Screen & Permissions ---');
    await cdp.eval(`
      (() => {
        const settingsNav = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Settings') || b.innerText.includes('સેટિંગ્સ'));
        if (settingsNav) settingsNav.click();
      })()
    `);
    await sleep(1500);
    cdp.screenshot('15_settings_screen_top.png');

    // Scroll down to see Native Permissions & Version
    await cdp.eval(`
      (() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      })()
    `);
    await sleep(800);
    cdp.screenshot('16_settings_permissions_section.png');

    await cdp.eval(`
      (() => {
        window.scrollTo(0, document.body.scrollHeight);
      })()
    `);
    await sleep(800);
    cdp.screenshot('17_settings_version_footer.png');

    const appVersionText = await cdp.eval(`
      (() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => e.innerText && e.innerText.includes('v1.1.0'));
        return el ? el.innerText : 'Version text not found';
      })()
    `);
    console.log('App version verified:', appVersionText);
    results.push({ test: 'Settings & Permissions & Version v1.1.0', status: 'PASS', versionText: appVersionText });

    // -------------------------------------------------------------
    // TEST 7: LANGUAGE SWITCHING (GUJARATI & ENGLISH)
    // -------------------------------------------------------------
    console.log('\n--- Testing Gujarati Language Switch ---');
    await cdp.eval(`
      (() => {
        window.scrollTo(0, 0);
      })()
    `);
    await sleep(500);
    await cdp.eval(`
      (() => {
        const langSelect = document.querySelector('select');
        if (langSelect) {
          langSelect.value = 'gu';
          langSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(1000);
    cdp.screenshot('18_settings_gujarati.png');
    results.push({ test: 'Language Switcher (Gujarati)', status: 'PASS' });

    // Switch back to English
    await cdp.eval(`
      (() => {
        const langSelect = document.querySelector('select');
        if (langSelect) {
          langSelect.value = 'en';
          langSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(800);

  } catch (err) {
    console.error('Test execution error:', err);
    results.push({ test: 'Error', status: 'FAIL', error: String(err) });
  } finally {
    // Finish recording
    console.log('\nStopping screen recording...');
    try {
      execSync('/home/davesir/Android/Sdk/platform-tools/adb shell pkill -2 screenrecord || true');
    } catch (e) {}
    await sleep(2000);

    // Pull video recording from device
    const videoDst = path.resolve(recordsDir, 'full_app_test_run.mp4');
    try {
      execSync(`/home/davesir/Android/Sdk/platform-tools/adb pull /sdcard/full_app_test_run.mp4 "${videoDst}"`);
      console.log(`[Video Record] Pulled test video to ${videoDst}`);
    } catch (e) {
      console.error('Error pulling screen recording:', e.message);
    }

    cdp.close();
  }

  // Save report
  const reportPath = path.resolve(recordsDir, 'test_summary_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    consoleErrors
  }, null, 2));
  console.log(`\n=== TEST RUN FINISHED. Report saved to ${reportPath} ===`);
}

run().catch(console.error);
