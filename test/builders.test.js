import test from 'node:test';
import assert from 'node:assert/strict';
import { DECISION_CARDS, SEED_AUDIT_LOG, MARKET_SIGNALS } from '../src/catalog.js';
import {
  buildJiraIssuePayload,
  buildConfluenceDecisionBlock,
  buildConfluenceCreatePagePayload,
  buildConfluenceAppendPagePayload,
  buildAuditEntry,
  buildRovoDecisionCardResponse,
  buildTeamworkGraphLinks,
  buildExecutiveBoardBrief
} from '../src/builders.js';

test('buildJiraIssuePayload produces valid Jira Cloud REST API v3 ADF document', () => {
  const card = DECISION_CARDS[0];
  const payload = buildJiraIssuePayload(card, {
    projectKey: 'acme',
    actor: 'Weni Executive',
    rationale: 'Approved in Q3 growth sync',
    timestamp: '2026-11-19T08:00:00.000Z'
  });

  assert.equal(payload.fields.project.key, 'ACME');
  assert.equal(payload.fields.issuetype.name, 'Task');
  assert.match(payload.fields.summary, /^\[ACME Decision DEC-001\]/);
  assert.ok(payload.fields.labels.includes('acme-decisions-layer'));
  assert.equal(payload.fields.description.type, 'doc');
  assert.equal(payload.fields.description.version, 1);
  assert.ok(Array.isArray(payload.fields.description.content));
  assert.equal(payload.fields.description.content[0].type, 'heading');
  assert.equal(payload.fields.description.content[2].type, 'bulletList');
});

test('buildConfluenceCreatePagePayload produces valid Confluence REST API v2 storage XHTML', () => {
  const card = DECISION_CARDS[1];
  const payload = buildConfluenceCreatePagePayload(
    card,
    { key: 'ACME-205', browseUrl: 'https://acme.atlassian.net/browse/ACME-205' },
    { spaceId: '987654321', actor: 'CMO', timestamp: '2026-11-19T09:00:00.000Z' }
  );

  assert.equal(payload.spaceId, '987654321');
  assert.equal(payload.status, 'current');
  assert.equal(payload.parentId, undefined);
  assert.match(payload.title, /DEC-002/);
  assert.match(payload.title, /ACME-205/);
  assert.equal(payload.body.representation, 'storage');
  assert.match(payload.body.value, /ac:structured-macro ac:name="status"/);
  assert.match(payload.body.value, /ACME-205/);
});

test('buildConfluenceCreatePagePayload attaches parentId when provided and escapes XML entities', () => {
  const xssCard = {
    ...DECISION_CARDS[0],
    title: 'Shift <budget> & "search" \'now\'',
    body: 'Verify <script>alert(1)</script> escaping'
  };
  const payload = buildConfluenceCreatePagePayload(
    xssCard,
    { key: 'ACME-209' },
    { spaceId: '111', parentId: '4021000', actor: 'CISO & Board', rationale: 'Safe <xml>' }
  );

  assert.equal(payload.parentId, '4021000');
  assert.doesNotMatch(payload.body.value, /<script>/);
  assert.match(payload.body.value, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(payload.body.value, /CISO &amp; Board/);
});

test('buildConfluenceAppendPagePayload increments page version and prepends new record', () => {
  const card = DECISION_CARDS[2];
  const existing = {
    id: '555123',
    title: 'ACME Executive Decision Log',
    version: { number: 7 },
    body: { storage: { value: '<p>Earlier records</p>' } }
  };
  const payload = buildConfluenceAppendPagePayload(
    existing,
    card,
    { key: 'ACME-206' },
    { actor: 'Regional VP', timestamp: '2026-11-19T09:15:00.000Z' }
  );

  assert.equal(payload.id, '555123');
  assert.equal(payload.version.number, 8);
  assert.match(payload.body.value, /DEC-003/);
  assert.ok(payload.body.value.endsWith('<p>Earlier records</p>'));
});

test('buildTeamworkGraphLinks and buildRovoDecisionCardResponse include Jira, Confluence, Graph, and Goal ARIs', () => {
  const card = DECISION_CARDS[0];
  const links = buildTeamworkGraphLinks({
    cloudId: 'cloud-123',
    jiraIssueKey: 'ACME-301',
    confluencePageId: '777888',
    card
  });

  const types = links.map((l) => l.type);
  assert.ok(types.includes('forge-app'));
  assert.ok(types.includes('jira-issue'));
  assert.ok(types.includes('confluence-page'));
  assert.ok(types.includes('teamwork-graph-edge'));
  assert.ok(types.includes('teamwork-goal'));

  assert.ok(links.some((l) => l.ari === 'ari:cloud:jira:cloud-123:issue/ACME-301'));
  assert.ok(links.some((l) => l.ari === 'ari:cloud:confluence:cloud-123:page/777888'));
  assert.ok(links.some((l) => l.ari.startsWith('ari:cloud:graph:cloud-123:relationship/decision-lineage/DEC-001')));

  const auditEntry = buildAuditEntry({
    card,
    status: 'APPROVED',
    actor: 'Exec',
    jiraResult: { status: 'CREATED', key: 'ACME-301' },
    confluenceResult: { status: 'CREATED', id: '777888' },
    cloudId: 'cloud-123',
    timestamp: '2026-11-19T10:00:00.000Z'
  });

  const rovoCard = buildRovoDecisionCardResponse({
    card,
    status: 'APPROVED',
    auditEntry,
    jiraResult: { status: 'CREATED', key: 'ACME-301' },
    confluenceResult: { status: 'CREATED', id: '777888' },
    cloudId: 'cloud-123'
  });

  assert.equal(rovoCard.ok, true);
  assert.equal(rovoCard.status, 'APPROVED');
  assert.equal(rovoCard.execution.auditLogPersisted, true);
  assert.match(rovoCard.summary, /ACME-301/);
  assert.match(rovoCard.summary, /#777888/);
});

test('buildAuditEntry records HELD status with skipped Atlassian artifacts and graph lineage edge', () => {
  const entry = buildAuditEntry({
    card: DECISION_CARDS[3],
    status: 'HELD',
    actor: 'CFO',
    rationale: 'Deferred to Q4 board review',
    jiraResult: { status: 'SKIPPED' },
    confluenceResult: { status: 'SKIPPED' },
    cloudId: 'site-99',
    timestamp: '2026-11-20T10:00:00.000Z'
  });

  assert.equal(entry.status, 'HELD');
  assert.equal(entry.jiraIssueKey, null);
  assert.equal(entry.confluencePageId, null);
  assert.equal(entry.jiraStatus, 'SKIPPED');
  assert.equal(entry.confluenceStatus, 'SKIPPED');
  assert.ok(entry.teamworkGraphEdges.some((e) => e.startsWith('ari:cloud:graph:site-99:relationship/decision-lineage/DEC-004')));
});

test('buildConfluenceDecisionBlock renders code fallback when browseUrl is absent', () => {
  const html = buildConfluenceDecisionBlock(DECISION_CARDS[0], { key: 'ACME-404' }, { timestamp: '2026-11-20T10:00:00.000Z' });
  assert.match(html, /<code>ACME-404<\/code>/);
  assert.match(html, /DEC-001/);
});

test('buildExecutiveBoardBrief compiles markdown and json governance packs with ADF, XHTML, KVS receipts, and scopes', () => {
  const brief = buildExecutiveBoardBrief({
    decisionCards: DECISION_CARDS,
    decisionStates: {
      'DEC-001': { status: 'APPROVED', jiraIssueKey: 'ACME-610', confluencePageId: '4022610', updatedAt: '2026-11-20T11:00:00.000Z' },
      'DEC-004': { status: 'HELD', rationale: 'Wait for Q4', updatedAt: '2026-11-20T11:05:00.000Z' }
    },
    auditLog: SEED_AUDIT_LOG,
    signals: MARKET_SIGNALS,
    cloudId: 'site-board',
    generatedAt: '2026-11-20T12:00:00.000Z'
  });

  assert.equal(brief.schemaVersion, 'acme.executive-board-brief/v1');
  assert.equal(brief.summary.approvedCount, 1);
  assert.equal(brief.summary.heldCount, 1);
  assert.equal(brief.summary.pendingCount, 2);
  assert.equal(brief.summary.leastPrivilegeScopeCount, 8);
  assert.equal(brief.json.decisions.length, 4);
  assert.equal(brief.json.decisions[0].jiraAdfPayload.fields.description.type, 'doc');
  assert.match(brief.json.decisions[0].confluenceXhtmlPayload.body.value, /ac:structured-macro/);
  assert.match(brief.markdown, /# ACME Executive Board Brief/);
  assert.match(brief.markdown, /ACME-610/);
  assert.match(brief.markdown, /ari:cloud:graph:site-board:relationship\/decision-lineage\/DEC-001/);
  assert.match(brief.markdown, /storage:app/);
});
