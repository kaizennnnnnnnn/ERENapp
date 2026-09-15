const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  await page.setViewport({ width: 1660, height: 1400, deviceScaleFactor: 1 });
  let ok = false;
  for (let a = 0; a < 8 && !ok; a++) {
    await page.goto('http://localhost:3000/wxgal', { waitUntil: 'networkidle0', timeout: 120000 });
    ok = await page.evaluate(() => document.querySelectorAll('#zoom > div').length === 5).catch(() => false);
    if (!ok) await new Promise(r => setTimeout(r, 1500));
  }
  await page.evaluate(() => window.dispatchEvent(new Event('eren:app-ready')));
  await new Promise(r => setTimeout(r, 1200));
  const out = process.argv[2] || 'scripts/wx_gal';
  for (const id of ['zoom', 'skies', 'real']) {
    const box = await page.evaluate((i) => {
      const e = document.getElementById(i); const r = e.getBoundingClientRect();
      return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
    }, id);
    await page.screenshot({ path: `${out}_${id}.png`, captureBeyondViewport: true,
      clip: { x: box.x, y: box.y, width: Math.min(box.width, 1640), height: box.height } });
  }
  console.log('ready=' + ok);
  if (errs.length) console.log('ERRORS:\n' + errs.slice(0, 8).join('\n'));
  await browser.close();
})();
