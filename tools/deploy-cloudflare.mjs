#!/usr/bin/env node
/**
 * Deploy Cyber Michelangelo to Cloudflare Pages using the Direct Upload API.
 *
 * No dependencies, no build step — the repository *is* the site.
 *
 * Required environment variables:
 *   CLOUDFLARE_API_TOKEN   token with "Account → Cloudflare Pages → Edit"
 *   CLOUDFLARE_ACCOUNT_ID  your Cloudflare account id
 *
 * Optional:
 *   CF_PAGES_PROJECT       project name (default: cyber-michelangelo)
 *   CF_PAGES_BRANCH        branch label for the deployment (default: main)
 *
 * Usage:
 *   node tools/deploy-cloudflare.mjs --dry-run     # list files only
 *   node tools/deploy-cloudflare.mjs               # upload & deploy
 *
 * The script creates the Pages project on first run (direct upload mode),
 * uploads every static file and prints the deployment URL.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.cloudflare.com/client/v4';

const EXCLUDE_DIRS = new Set(['.git', '.tools', 'node_modules', 'research', '.dsh-tmp', '.vscode', '.idea']);
const EXCLUDE_FILES = new Set(['.gitignore', '.DS_Store', 'Thumbs.db']);
const EXCLUDE_EXT = new Set(['.log']);

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const project = process.env.CF_PAGES_PROJECT || 'cyber-michelangelo';
const branch = process.env.CF_PAGES_BRANCH || 'main';
const dryRun = process.argv.includes('--dry-run');

function log(...args) {
  console.log('[deploy]', ...args);
}

async function collectFiles(dir = ROOT, rel = '', out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      await collectFiles(absPath, relPath, out);
    } else if (entry.isFile()) {
      if (EXCLUDE_FILES.has(entry.name)) continue;
      if (EXCLUDE_EXT.has(path.extname(entry.name).toLowerCase())) continue;
      out.push(relPath);
    }
  }
  return out;
}

async function api(pathname, options = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, ok: res.ok, body };
}

async function ensureProject() {
  const existing = await api(`/accounts/${accountId}/pages/projects/${project}`);
  if (existing.ok) {
    log(`project "${project}" already exists`);
    return;
  }
  if (existing.status !== 404) {
    throw new Error(`could not check project: ${existing.status} ${JSON.stringify(existing.body)}`);
  }
  log(`creating Pages project "${project}" (direct upload)`);
  const created = await api(`/accounts/${accountId}/pages/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: project, production_branch: branch }),
  });
  if (!created.ok) {
    throw new Error(`project creation failed: ${created.status} ${JSON.stringify(created.body)}`);
  }
}

async function deploy(files) {
  const form = new FormData();
  let totalBytes = 0;
  for (const relPath of files) {
    const data = await readFile(path.join(ROOT, relPath));
    totalBytes += data.byteLength;
    form.append(relPath, new Blob([data]), path.posix.basename(relPath));
  }
  log(`uploading ${files.length} files (${(totalBytes / 1024).toFixed(0)} KiB)…`);
  const res = await api(`/accounts/${accountId}/pages/projects/${project}/deployments`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    throw new Error(`deployment failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const result = res.body && res.body.result ? res.body.result : {};
  log(`deployment id: ${result.id || '(unknown)'}`);
  log(`deployment url: ${result.url || '(no url returned)'}`);
  if (result.latest_stage && result.latest_stage.name) {
    log(`stage: ${result.latest_stage.name} ${result.latest_stage.status || ''}`);
  }
  return result;
}

async function main() {
  const files = (await collectFiles()).sort();
  log(`root: ${ROOT}`);
  log(`${files.length} static files:`);
  for (const file of files) log('  ' + file);

  if (dryRun) {
    log('dry run — nothing uploaded');
    return;
  }
  if (!token || !accountId) {
    console.error('[deploy] missing CLOUDFLARE_API_TOKEN and/or CLOUDFLARE_ACCOUNT_ID');
    console.error('        create a token with "Account → Cloudflare Pages → Edit" and retry.');
    process.exitCode = 1;
    return;
  }
  await ensureProject();
  await deploy(files);
  log('done ✔');
}

main().catch((err) => {
  console.error('[deploy] failed:', err && err.message ? err.message : err);
  process.exitCode = 1;
});
