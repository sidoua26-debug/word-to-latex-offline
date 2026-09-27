import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const SAMPLE_DOCX = join(ROOT, 'sample-paper.docx');
const SCREENSHOTS_DIR = join(ROOT, 'assets', 'screenshots');

if (!existsSync(SCREENSHOTS_DIR)) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

console.log('Starting Playwright Chromium browser to capture 1280x800 screenshots...');

const context = await chromium.launchPersistentContext('', {
  headless: false,
  viewport: { width: 1280, height: 800 },
  args: [
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
  ],
});

try {
  // Determine extension ID
  const extPage = await context.newPage();
  await extPage.goto('chrome://extensions');
  const extId = await extPage.evaluate(async () => {
    const manager = document.querySelector('extensions-manager');
    const itemList = manager.shadowRoot.querySelector('extensions-item-list');
    const items = itemList.shadowRoot.querySelectorAll('extensions-item');
    for (const item of items) {
      const name = item.shadowRoot.querySelector('#name')?.textContent;
      if (name?.includes('Word to LaTeX')) {
        return item.id;
      }
    }
    return null;
  });

  if (!extId) {
    throw new Error('Could not locate extension ID on chrome://extensions');
  }

  console.log(`Located Extension ID: ${extId}`);
  await extPage.close();

  const popupUrl = `chrome-extension://${extId}/popup.html`;

  // Helper to frame the popup inside a realistic 1280x800 browser canvas
  async function captureFramedPopup(page, outFileName, description) {
    // Inject styling so popup is presented elegantly centered inside a 1280x800 canvas
    await page.evaluate(() => {
      document.documentElement.style.height = '100%';
      document.body.style.display = 'flex';
      document.body.style.alignItems = 'center';
      document.body.style.justifyContent = 'center';
      document.body.style.height = '100vh';
      document.body.style.margin = '0';
      document.body.style.background = 'radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 100%)';

      const container = document.querySelector('.container');
      if (container) {
        container.style.width = '460px';
        container.style.borderRadius = '16px';
        container.style.background = '#ffffff';
        container.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)';
        container.style.padding = '24px';
      }
    });

    // Capture screenshot at exactly 1280x800
    const outPath = join(SCREENSHOTS_DIR, outFileName);
    await page.screenshot({ path: outPath });
    console.log(`✓ Saved screenshot: ${outFileName} (1280x800) — ${description}`);
  }

  // --- SCREENSHOT 1: Upload tab with sample .docx selected, ready for conversion ---
  console.log('Capturing Screenshot 1: Upload tab with file selected...');
  const page1 = await context.newPage();
  await page1.goto(popupUrl);
  await page1.waitForLoadState('domcontentloaded');

  // Select file in input
  const fileInput = await page1.$('#docx-file');
  await fileInput.setInputFiles(SAMPLE_DOCX);
  await page1.waitForTimeout(500);

  await captureFramedPopup(
    page1,
    '1-upload-file-selected.png',
    'Upload File tab with sample-paper.docx selected, Convert button active'
  );
  await page1.close();

  // --- SCREENSHOT 2: Output view after successful conversion with "Copied!" notification ---
  console.log('Capturing Screenshot 2: Successful conversion output & Copied confirmation...');
  const page2 = await context.newPage();
  await page2.goto(popupUrl);
  await page2.waitForLoadState('domcontentloaded');

  const fileInput2 = await page2.$('#docx-file');
  await fileInput2.setInputFiles(SAMPLE_DOCX);
  await page2.click('#convert-btn');

  // Wait for conversion output to appear
  await page2.waitForSelector('#output-wrapper:not([hidden])', { timeout: 15000 });
  // Wait for the Copied toast to show
  await page2.waitForTimeout(800);

  await captureFramedPopup(
    page2,
    '2-conversion-output-copied.png',
    'LaTeX fragment output with package headers and Copied! toast notification'
  );
  await page2.close();

  // --- SCREENSHOT 3: Paste Content tab with table and converted output ---
  console.log('Capturing Screenshot 3: Paste Content tab with table conversion...');
  const page3 = await context.newPage();
  await page3.goto(popupUrl);
  await page3.waitForLoadState('domcontentloaded');

  // Switch to paste tab
  await page3.click('#tab-paste');
  await page3.waitForTimeout(300);

  // Populate contenteditable with rich table HTML
  const sampleTableHtml = `
    <h3>Experimental Benchmarks</h3>
    <p>Performance comparison across test suites:</p>
    <table border="1" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th>Benchmark Suite</th>
          <th>Baseline</th>
          <th>Optimized</th>
          <th>Speedup</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Docx Parser</td>
          <td>142 ms</td>
          <td>38 ms</td>
          <td><b>3.7x</b></td>
        </tr>
        <tr>
          <td>AST Compaction</td>
          <td>95 ms</td>
          <td>22 ms</td>
          <td><b>4.3x</b></td>
        </tr>
      </tbody>
    </table>
  `.trim();

  await page3.evaluate((html) => {
    const pasteInput = document.getElementById('paste-input');
    pasteInput.innerHTML = html;
    pasteInput.dispatchEvent(new Event('input', { bubbles: true }));
  }, sampleTableHtml);

  await page3.waitForTimeout(400);

  // Click convert paste button
  await page3.click('#convert-paste-btn');

  // Wait for conversion output
  await page3.waitForSelector('#output-wrapper:not([hidden])', { timeout: 15000 });
  await page3.waitForTimeout(800);

  await captureFramedPopup(
    page3,
    '3-paste-table-converted.png',
    'Paste Content tab with rich table structure converted to LaTeX longtable/booktabs'
  );
  await page3.close();

  console.log('✓ All 3 live store screenshots captured successfully!');
} catch (err) {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
} finally {
  await context.close();
}
