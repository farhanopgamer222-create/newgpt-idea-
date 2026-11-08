import JSZip from 'jszip';
import { promises as fs } from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const zip = new JSZip();
const folders = ['src', 'public', 'android', 'scripts'];
const rootFiles = ['package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'open-next.config.ts', 'wrangler.jsonc', 'drizzle.config.ts', 'eslint.config.mjs', 'postcss.config.mjs', 'README.md', '.env.example', '.gitignore'];
let count = 0;
const secretPattern = new RegExp(['sk', 'or', 'v1'].join('-') + '-[a-f0-9]{48,}', 'i');
async function add(relative) {
  const name = relative.split(path.sep).join('/');
  if (name.includes('farhangpt-source.zip') || name.split('/').some(part => part === 'node_modules' || part === '.next' || part === '.open-next' || part === '.wrangler' || part === 'build' || part === '.env' || (part.startsWith('.env.') && part !== '.env.example') || /\.(keystore|jks|log|tsbuildinfo)$/.test(part))) return;
  const full = path.join(root, relative);
  const stat = await fs.stat(full);
  if (stat.isDirectory()) { for (const entry of await fs.readdir(full)) await add(path.join(relative, entry)); return; }
  const data = await fs.readFile(full);
  if (!/\.(png|jpg|jpeg|webp|woff2|apk|zip)$/.test(name) && secretPattern.test(data.toString('utf8'))) throw new Error('Refusing to package a file containing an API credential: ' + name);
  zip.file('farhangpt/' + name, data); count++;
}
for (const file of rootFiles) { try { await add(file); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
for (const folder of folders) await add(folder);
await fs.mkdir(path.join(root, 'public/downloads'), { recursive: true });
const output = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 7 } });
await fs.writeFile(path.join(root, 'public/downloads/farhangpt-source.zip'), output);
console.log(`Packaged ${count} source files (${Math.round(output.length / 1024)} KB). No private environment files or credentials included.`);
