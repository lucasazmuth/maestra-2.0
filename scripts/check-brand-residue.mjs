import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const scanRoots = ['src', 'public', 'supabase/functions'];
const textExtensions = new Set(['.ts', '.tsx', '.scss', '.css', '.html', '.json', '.md', '.js', '.svg']);
const forbidden = [
  ['nome antigo', /Maestra Manager/g],
  ['fonte proprietária antiga', /SpotifyMixUI(?:Title)?/g],
  ['CDN tipográfico antigo', /encore\.scdn\.co\/fonts/g],
  ['violeta antigo', /#BE81EC/gi],
  ['hover antigo', /#A95FE0/gi],
  ['lavanda antiga', /#D3A6F2/gi],
  ['RGB antigo', /190\s*,\s*129\s*,\s*236/g],
  ['asset legado importado', /assets\/maestra-logo\.svg/g],
];

const failures = [];

async function walk(dir) {
  const entries = await readdir(join(root, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

for (const dir of scanRoots) {
  for (const file of await walk(dir)) {
    if (file.includes('/__tests__/') || /\.test\.[^.]+$/.test(file)) continue;
    const ext = file.slice(file.lastIndexOf('.'));
    if (!textExtensions.has(ext)) continue;
    const source = await readFile(join(root, file), 'utf8');
    for (const [label, pattern] of forbidden) {
      pattern.lastIndex = 0;
      if (pattern.test(source)) failures.push(`${relative(root, join(root, file))}: ${label}`);
    }
  }
}

const helperPaths = [
  'supabase/functions/_shared/brevo.ts',
  'supabase/functions/activation-nudges/brevo.ts',
  'supabase/functions/generate-reminders/brevo.ts',
  'supabase/functions/send-email-hook/brevo.ts',
  'supabase/functions/send-team-invite/brevo.ts',
  'supabase/functions/weekly-report/brevo.ts',
];
const helpers = await Promise.all(helperPaths.map((path) => readFile(join(root, path), 'utf8')));
if (helpers.some((source) => source !== helpers[0])) failures.push('helpers Brevo locais fora de sincronia');

const requiredAssets = [
  'public/favicon.ico',
  'public/favicon16.png',
  'public/favicon32.png',
  'public/apple-touch-icon.png',
  'public/logo192.png',
  'public/logo512.png',
  'public/brand/maestra-wordmark-light.png',
];
for (const asset of requiredAssets) {
  try {
    if ((await stat(join(root, asset))).size < 100) failures.push(`${asset}: asset vazio`);
  } catch {
    failures.push(`${asset}: asset ausente`);
  }
}

const symbol = await readFile(join(root, 'src/assets/brand/maestra-symbol.svg'), 'utf8');
const wordmark = await readFile(join(root, 'src/assets/brand/maestra-wordmark.svg'), 'utf8');
if (!symbol.includes('#C97EF3') || !symbol.includes('178.721')) failures.push('símbolo oficial não reconhecido');
if (!wordmark.includes('currentColor') || !wordmark.includes('viewBox="240 29 620 121"')) {
  failures.push('wordmark oficial não reconhecido');
}

if (failures.length) {
  console.error('Verificação de marca falhou:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('Marca validada: sem referências legadas nas superfícies ativas.');
