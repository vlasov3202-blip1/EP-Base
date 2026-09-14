import { readFile } from 'node:fs/promises';

const html = await readFile('index.html', 'utf8');
const css = await readFile('styles.css', 'utf8');
const js = await readFile('app.js', 'utf8');

const checks = [
  ['viewport', html.includes('name="viewport"')],
  ['application shell', html.includes('id="app"')],
  ['mobile layout', css.includes('@media (max-width: 760px)')],
  ['local persistence', js.includes('localStorage')],
  ['safe output escaping', js.includes('escapeHtml') || js.includes('const esc=v=>String')],
];

const failed = checks.filter(([, result]) => !result);
for (const [name, result] of checks) {
  console.log(`${result ? '✓' : '✗'} ${name}`);
}

if (failed.length) process.exit(1);
