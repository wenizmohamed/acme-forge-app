import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as entry from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

test('manifest.yml declares Rovo Agent, Actions, Jira/Confluence modules, KVS scope, and valid handlers', () => {
  const manifest = fs.readFileSync(path.join(root, 'manifest.yml'), 'utf-8');

  assert.match(manifest, /rovo:agent:/);
  assert.match(manifest, /key:\s*acme-decisions-agent/);
  assert.match(manifest, /action:/);
  assert.match(manifest, /jira:globalPage:/);
  assert.match(manifest, /confluence:globalPage:/);
  assert.match(manifest, /\n\s+macro:/);
  assert.match(manifest, /webtrigger:/);
  assert.match(manifest, /-\s*storage:app/);
  assert.match(manifest, /-\s*write:jira-work/);
  assert.match(manifest, /-\s*write:page:confluence/);
  assert.match(manifest, /name:\s*nodejs22\.x/);

  // Every handler declared in manifest.yml must be exported by src/index.js
  const handlers = [...manifest.matchAll(/handler:\s*index\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  assert.ok(handlers.length >= 6);
  for (const fn of handlers) {
    assert.equal(typeof entry[fn], 'function', `Expected src/index.js to export function ${fn}`);
  }
});

test('static/main-ui/index.html and root index.html stay in sync and include forge-bridge-adapter.js', () => {
  const staticHtml = fs.readFileSync(path.join(root, 'static', 'main-ui', 'index.html'), 'utf-8');
  const rootHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
  assert.equal(staticHtml, rootHtml, 'Root index.html must match static/main-ui/index.html (run npm run sync:ui)');
  assert.match(staticHtml, /forge-bridge-adapter\.js/);
  assert.doesNotMatch(staticHtml, /gemini-2\.0-flash/, 'Legacy Gemini 2.0 model reference must not exist');
});
