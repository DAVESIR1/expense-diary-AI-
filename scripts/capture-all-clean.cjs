const { getPageWsUrl, CDPClient } = require('./cdp-client.cjs');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const url = await getPageWsUrl();
  const cdp = new CDPClient(url);
  await cdp.connect();

  const closeModals = async () => {
    await cdp.eval(`
      (() => {
        const closeBtns = Array.from(document.querySelectorAll('button')).filter(b => 
          b.querySelector('svg.lucide-x') || 
          b.innerText === 'Cancel' || 
          b.innerText === 'Close' || 
          b.innerText === 'રદ કરો'
        );
        closeBtns.forEach(b => b.click());
      })()
    `);
    await sleep(600);
  };

  const navTo = async (tabName) => {
    await cdp.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('nav button, header button, div button'));
        const b = btns.find(btn => btn.innerText && btn.innerText.trim().toLowerCase() === ${JSON.stringify(tabName.toLowerCase())});
        if (b) b.click();
      })()
    `);
    await sleep(1000);
  };

  console.log('1. Closing modals...');
  await closeModals();

  console.log('2. Capturing Home Screen...');
  await navTo('Home');
  await sleep(600);
  cdp.screenshot('clean_01_home.png');

  console.log('3. Capturing Diary - Journal...');
  await navTo('Diary');
  await sleep(600);
  cdp.screenshot('clean_02_diary_journal.png');

  console.log('4. Capturing Diary - Money Borrowed / Lent...');
  await cdp.eval(`
    (() => {
      const blBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Borrowed') || b.innerText.includes('Lent'));
      if (blBtn) blBtn.click();
    })()
  `);
  await sleep(600);
  cdp.screenshot('clean_03_diary_borrowed_lent.png');

  console.log('5. Capturing Reports Screen...');
  await navTo('Report');
  await sleep(600);
  cdp.screenshot('clean_04_reports.png');

  console.log('6. Capturing Settings Screen (Top)...');
  await navTo('Settings');
  await sleep(600);
  cdp.screenshot('clean_05_settings_top.png');

  console.log('7. Capturing Settings Screen (Permissions & Info)...');
  await cdp.eval('window.scrollTo(0, 1000)');
  await sleep(600);
  cdp.screenshot('clean_06_settings_permissions.png');

  await cdp.eval('window.scrollTo(0, document.body.scrollHeight)');
  await sleep(600);
  cdp.screenshot('clean_07_settings_version.png');

  cdp.close();
  console.log('All clean screenshots captured!');
}

run().catch(console.error);
