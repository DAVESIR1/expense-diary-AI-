const { getPageWsUrl, CDPClient } = require('./cdp-client.cjs');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log('=== RUNNING DEEP COMPREHENSIVE ANDROID EMULATOR TEST ===');
  const recordsDir = path.resolve(__dirname, '../records/emulator_test');

  // Start video recording
  spawn('/home/davesir/Android/Sdk/platform-tools/adb', [
    'shell', 'screenrecord', '--size', '720x1560', '/sdcard/all_screens_deep_test.mp4'
  ]);

  const wsUrl = await getPageWsUrl();
  const cdp = new CDPClient(wsUrl);
  await cdp.connect();

  const setInput = async (selector, value) => {
    return cdp.eval(`
      (() => {
        const inp = document.querySelector(${JSON.stringify(selector)});
        if (!inp) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, ${JSON.stringify(value)});
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `);
  };

  const clickByText = async (tag, text) => {
    return cdp.eval(`
      (() => {
        const els = Array.from(document.querySelectorAll(${JSON.stringify(tag)}));
        const el = els.find(e => e.innerText && e.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
        if (el) {
          el.click();
          return true;
        }
        return false;
      })()
    `);
  };

  try {
    // -------------------------------------------------------------
    // 1. HOME SCREEN & TRANSACTIONS
    // -------------------------------------------------------------
    console.log('\n[1/6] Testing Home Screen...');
    await clickByText('button', 'Home');
    await sleep(1000);
    cdp.screenshot('20_home_screen.png');

    // Add Expense Transaction
    console.log('Adding Expense: 650 Organic Groceries...');
    await clickByText('button', 'Expense');
    await sleep(1000);
    cdp.screenshot('21_add_transaction_modal.png');

    await setInput('input[type="number"], input[placeholder*="0.00"]', '650');
    await setInput('input[placeholder*="Grocery"], input[placeholder*="Title"]', 'Organic Groceries');
    await clickByText('button', 'Groceries');
    await clickByText('button', 'UPI');
    await setInput('input[placeholder*="Vendor"]', 'FreshMart');
    await sleep(500);
    await clickByText('button', 'Save');
    await sleep(1200);
    cdp.screenshot('22_home_after_expense.png');

    // Add Income Transaction
    console.log('Adding Income: 50000 Consulting Project...');
    await clickByText('button', 'Income');
    await sleep(1000);
    // Switch to Income tab inside modal
    await clickByText('button', 'Add Income');
    await sleep(500);
    await setInput('input[type="number"], input[placeholder*="0.00"]', '50000');
    await setInput('input[placeholder*="Grocery"], input[placeholder*="Title"]', 'Consulting Project');
    await clickByText('button', 'Salary');
    await clickByText('button', 'Bank Transfer');
    await clickByText('button', 'Save');
    await sleep(1200);
    cdp.screenshot('23_home_after_income.png');

    // Test Search & Filter
    console.log('Testing Search & Filter...');
    await setInput('input[placeholder*="Title / Description"]', 'Organic');
    await sleep(800);
    cdp.screenshot('24_home_filtered_search.png');
    // Clear search
    await setInput('input[placeholder*="Title / Description"]', '');
    await sleep(500);

    // -------------------------------------------------------------
    // 2. DIARY SCREEN: JOURNAL & BORROWED/LENT & PIN SETUP
    // -------------------------------------------------------------
    console.log('\n[2/6] Testing Diary Screen...');
    await clickByText('button', 'Diary');
    await sleep(1200);
    cdp.screenshot('25_diary_personal_journal.png');

    // Add Journal Entry
    console.log('Adding Journal Entry...');
    await clickByText('button', 'Add Entry');
    await sleep(800);
    await setInput('input[placeholder*="Title"], input[placeholder*="शीर्षક"]', 'Phase 2 Testing Day');
    await cdp.eval(`
      (() => {
        const ta = document.querySelector('textarea');
        if (ta) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          setter.call(ta, 'Testing every screen and function on Android emulator. All components type-safe, responsive, and working seamlessly.');
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(500);
    await clickByText('button', 'Save');
    await sleep(1000);
    cdp.screenshot('26_diary_with_entry.png');

    // Test Diary PIN Setup Card
    console.log('Testing Diary Custom PIN Setup...');
    await clickByText('button', 'Diary PIN');
    await sleep(600);
    await setInput('input[placeholder*="New 4-digit PIN"]', '5678');
    await setInput('input[placeholder*="Confirm PIN"]', '5678');
    await clickByText('button', 'Save PIN');
    await sleep(1200);
    cdp.screenshot('27_diary_pin_setup_saved.png');

    // Test Money Borrowed / Lent Tab
    console.log('Testing Money Borrowed / Lent Tab...');
    await clickByText('button', 'Borrowed');
    await sleep(1000);
    cdp.screenshot('28_borrowed_lent_summary.png');

    // Add Lent Record
    console.log('Adding Lent Record: Vikram 5000...');
    await clickByText('button', 'Add Record');
    await sleep(800);
    await setInput('input[placeholder*="Name"], input[placeholder*="Person"]', 'Vikram');
    await setInput('input[placeholder*="Mobile"], input[type="tel"]', '9825012345');
    await setInput('input[type="number"], input[placeholder*="Amount"]', '5000');
    await setInput('input[placeholder*="Notes"]', 'Laptop repair advance');
    await sleep(500);
    await clickByText('button', 'Save');
    await sleep(1000);
    cdp.screenshot('29_borrowed_lent_list.png');

    // Add Borrowed Record
    console.log('Adding Borrowed Record: Meera 2500...');
    await clickByText('button', 'Add Record');
    await sleep(800);
    await clickByText('button', 'Borrowed');
    await setInput('input[placeholder*="Name"], input[placeholder*="Person"]', 'Meera');
    await setInput('input[type="number"], input[placeholder*="Amount"]', '2500');
    await setInput('input[placeholder*="Notes"]', 'Office supplies reimbursement');
    await sleep(500);
    await clickByText('button', 'Save');
    await sleep(1000);
    cdp.screenshot('30_borrowed_lent_both.png');

    // -------------------------------------------------------------
    // 3. REPORTS SCREEN
    // -------------------------------------------------------------
    console.log('\n[3/6] Testing Reports Screen...');
    await clickByText('button', 'Report');
    await sleep(1500);
    cdp.screenshot('31_report_screen_box.png');

    console.log('Switching to Minimal Report layout...');
    await clickByText('button', 'Minimal');
    await sleep(800);
    cdp.screenshot('32_report_screen_minimal.png');

    console.log('Switching to Yearly Report period...');
    await clickByText('button', 'This Year');
    await sleep(800);
    cdp.screenshot('33_report_period_yearly.png');

    // -------------------------------------------------------------
    // 4. SETTINGS & NATIVE PERMISSIONS
    // -------------------------------------------------------------
    console.log('\n[4/6] Testing Settings Screen...');
    await clickByText('button', 'Settings');
    await sleep(1500);
    cdp.screenshot('36_settings_top.png');

    // Scroll to Native Permissions
    console.log('Inspecting Native Permissions...');
    await cdp.eval('window.scrollTo(0, 800)');
    await sleep(800);
    cdp.screenshot('37_settings_permissions.png');

    // Trigger SMS permission request via NativeBridgeService
    console.log('Triggering SMS Permission Request via NativeBridge...');
    await clickByText('button', 'Grant');
    await sleep(1500);
    cdp.screenshot('38_settings_sms_permission_dialog.png');

    // Dismiss permission dialog if appeared by tapping "While using the app" or "Allow"
    try {
      execSync('/home/davesir/Android/Sdk/platform-tools/adb shell input tap 540 1800 || true');
    } catch (e) {}
    await sleep(1000);

    // Scroll to footer to verify Version
    await cdp.eval('window.scrollTo(0, document.body.scrollHeight)');
    await sleep(800);
    cdp.screenshot('39_settings_version_bottom.png');

    // -------------------------------------------------------------
    // 5. GUJARATI LANGUAGE AUDIT
    // -------------------------------------------------------------
    console.log('\n[5/6] Testing Gujarati Language...');
    await cdp.eval('window.scrollTo(0, 0)');
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
    cdp.screenshot('40_settings_gujarati_full.png');

    // View Home in Gujarati
    await clickByText('button', 'હોમ');
    await sleep(1000);
    cdp.screenshot('41_home_gujarati.png');

    // Switch back to English
    await clickByText('button', 'સેટિંગ્સ');
    await sleep(800);
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

    // -------------------------------------------------------------
    // 6. MULTI-RESTORE & OFFLINE REMINDER MODALS
    // -------------------------------------------------------------
    console.log('\n[6/6] Testing Multi-Restore Modal...');
    await cdp.eval('window.scrollTo(0, 400)');
    await sleep(500);
    await clickByText('button', 'Multi-File / Folder Restore');
    await sleep(1000);
    cdp.screenshot('42_multi_restore_modal.png');

    // Close multi-restore modal
    await clickByText('button', 'Cancel');
    await sleep(800);

    console.log('Testing Offline Reminder Modal trigger...');
    await cdp.eval(`
      (() => {
        // Trigger offline reminder modal directly in DOM if state is reachable
        window.dispatchEvent(new CustomEvent('test-offline-reminder'));
      })()
    `);
    await sleep(1000);
    cdp.screenshot('43_final_state.png');

    console.log('\n=== ALL SCREEN TESTS EXECUTED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Error during deep test:', err);
  } finally {
    console.log('Stopping screen recording...');
    try {
      execSync('/home/davesir/Android/Sdk/platform-tools/adb shell pkill -2 screenrecord || true');
    } catch (e) {}
    await sleep(2000);

    const videoDst = path.resolve(recordsDir, 'all_screens_deep_test.mp4');
    try {
      execSync(`/home/davesir/Android/Sdk/platform-tools/adb pull /sdcard/all_screens_deep_test.mp4 "${videoDst}"`);
      console.log(`[Video Record] Pulled test video to ${videoDst}`);
    } catch (e) {
      console.error('Error pulling screen recording:', e.message);
    }

    cdp.close();
  }
}

run().catch(console.error);
