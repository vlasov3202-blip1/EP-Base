import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { extname } from 'node:path';

const rootEntries = await readdir('.', { withFileTypes: true });
const frontendFiles = rootEntries
  .filter(entry => entry.isFile() && ['.html', '.css', '.js'].includes(extname(entry.name)))
  .map(entry => entry.name)
  .sort();

await rm('dist', { recursive: true, force: true });
await mkdir('dist/scripts', { recursive: true });

for (const file of frontendFiles) {
  await cp(file, `dist/${file}`);
}
await cp('server', 'dist/server', { recursive: true });
await cp('scripts/serve.mjs', 'dist/scripts/serve.mjs');
await cp('package.json', 'dist/package.json');
await cp('package-lock.json', 'dist/package-lock.json');

console.log(`EINEIRO: собраны ${frontendFiles.length} frontend-файлов + server runtime в dist/`);
