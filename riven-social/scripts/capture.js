const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../public/assets/screens');

async function capture() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // iPhone 15 Pro dimensions (approximate logical pixels)
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 3 });

  console.log('Navigating to local Riven app...');

  // 1. Syllabus Screenshot
  try {
    await page.goto('http://localhost:5173/syllabus', { waitUntil: 'networkidle0', timeout: 30000 });
    // Try to click around if needed or just wait.
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(OUT_DIR, 'syllabus.png') });
    console.log('✅ Captured Syllabus');
  } catch (e) {
    console.error('❌ Failed to capture Syllabus:', e.message);
  }

  // 2. AI Gen Screenshot
  try {
    await page.goto('http://localhost:5173/create', { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(OUT_DIR, 'ai-gen.png') });
    console.log('✅ Captured AI Gen');
  } catch (e) {
    console.error('❌ Failed to capture AI Gen:', e.message);
  }

  await browser.close();
  console.log('Capture complete!');
}

capture();
