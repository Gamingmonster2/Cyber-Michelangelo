/**
 * Syntax check for every source module.
 * Uses `node --check` with inherited stdio (no pipes) so it also works under
 * confined sandboxes. Run: node tests/syntax.mjs
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const abs = path.join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (entry.endsWith('.js') || entry.endsWith('.mjs')) out.push(abs);
  }
  return out;
}

const files = walk(projectRoot).filter((f) => !f.includes('node_modules') && !f.includes('research-site'));
let failed = 0;
for (const file of files) {
  const res = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (res.status !== 0) {
    failed += 1;
    console.error(`✗ syntax error: ${path.relative(projectRoot, file)}`);
  }
}
console.log(`${files.length - failed}/${files.length} modules parse cleanly`);
process.exitCode = failed ? 1 : 0;
