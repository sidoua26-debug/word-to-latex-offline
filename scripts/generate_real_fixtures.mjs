import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const outputDir = path.resolve('tests/fixtures/real');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const testCases = [
  {
    id: 'case_01_pythagoras',
    type: 'math',
    latex: 'x^2 + y^2 = z^2',
    name: '1. Pythagorean equation',
  },
  {
    id: 'case_02_fraction',
    type: 'math',
    latex: '\\frac{a + b}{c}',
    name: '2. Fraction',
  },
  {
    id: 'case_03_sqrt',
    type: 'math',
    latex: '\\sqrt{x^2 + 1}',
    name: '3. Square root with exponent',
  },
  {
    id: 'case_04_integral',
    type: 'math',
    latex: '\\int_{0}^{1} x^2 dx',
    name: '4. Definite integral with limits',
  },
  {
    id: 'case_05_summation',
    type: 'math',
    latex: '\\sum_{i=1}^{n} i',
    name: '5. Summation with index and bound',
  },
  {
    id: 'case_06_matrix',
    type: 'math',
    latex: '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}',
    name: '6. 2x2 matrix',
  },
  {
    id: 'case_07_system',
    type: 'math',
    latex: '\\begin{cases} 2x + y = 5 \\\\ x - 3y = 2 \\end{cases}',
    name: '7. System of two equations',
  },
  {
    id: 'case_08_french_math',
    type: 'html',
    html: `
      <div style="font-family: serif; font-size: 22px; line-height: 1.6; max-width: 650px;">
        <p>Soit <span class="math">f</span> une fonction continue sur l'intervalle <span class="math">[0, 1]</span>. On considère l'intégrale suivante :</p>
        <div style="text-align: center; margin: 16px 0;" class="display-math">I = \\int_{0}^{1} f(x) dx</div>
        <p>Calculer la valeur moyenne de <span class="math">f</span>.</p>
      </div>
    `,
    name: '8. French paragraph containing mathematics',
  },
  {
    id: 'case_09_french_accents',
    type: 'html',
    html: `
      <div style="font-family: sans-serif; font-size: 22px; line-height: 1.6; max-width: 650px;">
        <h2 style="font-size: 26px; margin-bottom: 8px;">Documentation Français</h2>
        <p>Voici des caractères accentués : é, è, à, ç, œ, ù.</p>
        <p>L'élève étudie attentivement le théorème où apparaît le paramètre déjà défini.</p>
      </div>
    `,
    name: '9. French text with é è à ç œ ù',
  },
  {
    id: 'case_10_table_math',
    type: 'html',
    html: `
      <table style="border-collapse: collapse; font-family: serif; font-size: 20px; margin: 10px;">
        <thead>
          <tr style="border-bottom: 2px solid black; border-top: 2px solid black;">
            <th style="padding: 8px 24px; text-align: left;">Fonction</th>
            <th style="padding: 8px 24px; text-align: left;">Dérivée</th>
            <th style="padding: 8px 24px; text-align: left;">Primitive</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="padding: 8px 24px;"><span class="math">f(x) = x^2</span></td>
            <td style="padding: 8px 24px;"><span class="math">f'(x) = 2x</span></td>
            <td style="padding: 8px 24px;"><span class="math">F(x) = \\frac{x^3}{3}</span></td>
          </tr>
          <tr style="border-bottom: 2px solid black;">
            <td style="padding: 8px 24px;"><span class="math">g(x) = \\sin(x)</span></td>
            <td style="padding: 8px 24px;"><span class="math">g'(x) = \\cos(x)</span></td>
            <td style="padding: 8px 24px;"><span class="math">G(x) = -\\cos(x)</span></td>
          </tr>
        </tbody>
      </table>
    `,
    name: '10. Table containing mathematical expressions',
  },
];

async function generateAll() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Rendering 10 real test fixture images...');

  for (const tc of testCases) {
    let pageContent = '';
    if (tc.type === 'math') {
      pageContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
          <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
        </head>
        <body style="background: white; padding: 30px; margin: 0; display: inline-block;">
          <div id="target" style="font-size: 32px; display: inline-block;"></div>
          <script>
            katex.render(${JSON.stringify(tc.latex)}, document.getElementById('target'), { displayMode: true, throwOnError: false });
          </script>
        </body>
        </html>
      `;
    } else {
      pageContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
          <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
        </head>
        <body style="background: white; padding: 30px; margin: 0; display: inline-block;">
          <div id="target" style="display: inline-block;">
            ${tc.html}
          </div>
          <script>
            document.querySelectorAll('.math').forEach(el => {
              katex.render(el.textContent, el, { throwOnError: false });
            });
            document.querySelectorAll('.display-math').forEach(el => {
              katex.render(el.textContent, el, { displayMode: true, throwOnError: false });
            });
          </script>
        </body>
        </html>
      `;
    }

    await page.setContent(pageContent);
    await page.waitForTimeout(500); // ensure fonts render
    const target = page.locator('#target');
    const screenshot = await target.screenshot({ type: 'png' });
    const targetPath = path.join(outputDir, `${tc.id}.png`);
    fs.writeFileSync(targetPath, screenshot);
    console.log(`✓ Generated ${targetPath} (${screenshot.length} bytes)`);
  }

  await browser.close();
  console.log('✓ All 10 real fixtures generated successfully.');
}

generateAll().catch(console.error);
