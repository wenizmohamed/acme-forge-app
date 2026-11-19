/**
 * Static Atlassian Forge manifest & module integrity validator.
 * Verifies manifest.yml structure, scopes, Rovo agent/action cross-references,
 * function handler exports in src/index.js, and static resource paths.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const manifestPath = path.join(root, 'manifest.yml');
const manifestText = fs.readFileSync(manifestPath, 'utf-8');

const errors = [];

const requiredModules = [
  'rovo:agent:',
  'action:',
  'jira:globalPage:',
  'confluence:globalPage:',
  'macro:',
  'webtrigger:',
  'function:'
];

for (const mod of requiredModules) {
  if (!manifestText.includes(mod)) {
    errors.push(`Missing required Forge module block: ${mod}`);
  }
}

const requiredScopes = [
  'storage:app',
  'read:jira-work',
  'write:jira-work',
  'read:page:confluence',
  'write:page:confluence',
  'read:space:confluence'
];

for (const scope of requiredScopes) {
  if (!manifestText.includes(`- ${scope}`)) {
    errors.push(`Missing required OAuth/Forge scope: ${scope}`);
  }
}

if (!/runtime:\s*\r?\n\s*name:\s*nodejs22\.x/.test(manifestText)) {
  errors.push('Expected app.runtime.name to be nodejs22.x');
}

if (!/id:\s*ari:cloud:ecosystem::app\/1ccdf603-166b-400f-b0d9-6f6dab65f91a/.test(manifestText)) {
  errors.push('Missing or modified Atlassian Forge App ID');
}

// Verify every handler referenced in manifest.yml exists in src/index.js
const handlerMatches = [...manifestText.matchAll(/handler:\s*index\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
if (handlerMatches.length === 0) {
  errors.push('No function handlers declared in manifest.yml');
}

const indexSource = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf-8');
for (const fnName of handlerMatches) {
  const exportRe = new RegExp(`export\\s+(const|async\\s+function|function)\\s+${fnName}\\b`);
  if (!exportRe.test(indexSource)) {
    errors.push(`Handler index.${fnName} declared in manifest.yml is not exported by src/index.js`);
  }
}

// Verify resource path exists
const resourcePathMatch = manifestText.match(/path:\s*(.+)/);
if (resourcePathMatch) {
  const resDir = path.join(root, resourcePathMatch[1].trim());
  if (!fs.existsSync(path.join(resDir, 'index.html'))) {
    errors.push(`Resource directory missing index.html: ${resourcePathMatch[1].trim()}`);
  }
}

if (errors.length > 0) {
  console.error('Manifest validation FAILED:');
  for (const err of errors) console.error('  -', err);
  process.exit(1);
}

console.log(
  `Manifest validation PASSED: ${requiredModules.length} module families, ${requiredScopes.length} core scopes, ${handlerMatches.length} verified handlers.`
);
