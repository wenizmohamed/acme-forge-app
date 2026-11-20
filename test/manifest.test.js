import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as entry from '../src/index.js';
import { FORGE_SCOPES } from '../src/catalog.js';

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

  const handlers = [...manifest.matchAll(/handler:\s*index\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  assert.ok(handlers.length >= 6);
  for (const fn of handlers) {
    assert.equal(typeof entry[fn], 'function', `Expected src/index.js to export function ${fn}`);
  }
});

test('manifest.yml least-privilege scopes match FORGE_SCOPES catalog 1-to-1 with zero admin wildcards', () => {
  const manifest = fs.readFileSync(path.join(root, 'manifest.yml'), 'utf-8');
  const block = manifest.match(/scopes:\s*\r?\n((?:\s+-\s+[^\r\n]+\r?\n?)+)/);
  assert.ok(block, 'Expected permissions.scopes block in manifest.yml');

  const manifestScopes = [...block[1].matchAll(/-\s+([^\s#]+)/g)].map((m) => m[1].trim());
  const catalogScopes = FORGE_SCOPES.map((s) => s.scope);

  assert.deepEqual(manifestScopes, catalogScopes);
  assert.equal(manifestScopes.length, 8);
  for (const scope of manifestScopes) {
    assert.doesNotMatch(scope, /admin|manage:jira-configuration|\*/i, `Unexpected overly broad scope: ${scope}`);
  }
});

test('rovo:agent actions cross-reference valid action modules and function keys in manifest.yml', () => {
  const manifest = fs.readFileSync(path.join(root, 'manifest.yml'), 'utf-8');
  const actionsBlock = manifest.match(/actions:\s*\r?\n((?:\s+-\s+[^\r\n]+\r?\n?)+)/);
  assert.ok(actionsBlock, 'Expected rovo:agent actions list');

  const agentActions = [...actionsBlock[1].matchAll(/-\s+([a-z0-9-]+)/g)].map((m) => m[1]);
  assert.deepEqual(agentActions, [
    'approve-decision-card',
    'hold-decision-card',
    'query-acme-signals',
    'list-decision-audit-log'
  ]);

  for (const actKey of agentActions) {
    assert.match(manifest, new RegExp(`-\\s+key:\\s*${actKey}\\b`), `Missing action module declaration for ${actKey}`);
  }
});

test('root MIT LICENSE file exists for GitHub license detection', () => {
  const licensePath = path.join(root, 'LICENSE');
  assert.equal(fs.existsSync(licensePath), true, 'Expected root LICENSE file');
  const lic = fs.readFileSync(licensePath, 'utf-8');
  assert.match(lic, /MIT License/);
  assert.match(lic, /Permission is hereby granted, free of charge/);
});

test('static/main-ui assets stay synced with root GitHub Pages assets and contain Rank-1 panels', () => {
  const staticHtml = fs.readFileSync(path.join(root, 'static', 'main-ui', 'index.html'), 'utf-8');
  const rootHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
  assert.equal(staticHtml, rootHtml, 'Root index.html must match static/main-ui/index.html (run npm run sync:ui)');

  const staticAdapter = fs.readFileSync(path.join(root, 'static', 'main-ui', 'forge-bridge-adapter.js'), 'utf-8');
  const rootAdapter = fs.readFileSync(path.join(root, 'forge-bridge-adapter.js'), 'utf-8');
  assert.equal(staticAdapter, rootAdapter, 'Root forge-bridge-adapter.js must match static/main-ui/forge-bridge-adapter.js');

  assert.match(staticHtml, /forge-bridge-adapter\.js/);
  assert.match(staticHtml, /id="teamwork-scope-inspector"/);
  assert.match(staticHtml, /id="export-brief-md"/);
  assert.match(staticHtml, /id="export-brief-json"/);
  assert.doesNotMatch(staticHtml, /gemini-2\.0-flash|gemini-2\.5-/, 'Legacy Gemini model references must not exist');
});

test('validate-manifest.mjs CLI exits cleanly with verified summary', () => {
  const out = execFileSync(process.execPath, [path.join(root, 'scripts', 'validate-manifest.mjs')], {
    encoding: 'utf-8'
  });
  assert.match(out, /Manifest validation PASSED/);
  assert.match(out, /8 least-privilege scopes/);
  assert.match(out, /MIT LICENSE present/);
});
