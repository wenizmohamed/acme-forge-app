import test from 'node:test';
import assert from 'node:assert/strict';
import { DECISION_CARDS } from '../src/catalog.js';
import {
  buildJiraIssuePayload,
  buildConfluenceCreatePagePayload,
  buildConfluenceAppendPagePayload,
  buildAuditEntry,
  buildRovoDecisionCardResponse,
  buildTeamworkGraphLinks
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
  assert.match(payload.title, /DEC-002/);
  assert.match(payload.title, /ACME-205/);
  assert.equal(payload.body.representation, 'storage');
  assert.match(payload.body.value, /ac:structured-macro ac:name="status"/);
  assert.match(payload.body.value, /ACME-205/);
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

test('buildTeamworkGraphLinks and buildRovoDecisionCardResponse include Jira, Confluence, and Goal ARIs', () => {
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
  assert.ok(types.includes('teamwork-goal'));

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
