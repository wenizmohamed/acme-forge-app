import test from 'node:test';
import assert from 'node:assert/strict';
import { createAcmeService } from '../src/index.js';
import { createMemoryStore, KVS_KEYS } from '../src/storage.js';

function createMockAtlassianApi({
  jiraKey = 'ACME-501',
  confluenceSpaceId = '990011',
  confluencePageId = '880022',
  existingPage = null
} = {}) {
  const calls = [];

  const mockResponse = (ok, status, data) => ({
    ok,
    status,
    async json() {
      return data;
    }
  });

  const apiClient = {
    asUser() {
      return {
        async requestJira(routeVal, init = {}) {
          const pathStr = String(routeVal?.value ?? routeVal);
          const body = init.body ? JSON.parse(init.body) : null;
          calls.push({ product: 'jira', method: init.method || 'GET', path: pathStr, body });

          if (pathStr.includes('/rest/api/3/project/search')) {
            return mockResponse(true, 200, { values: [{ key: 'ACME' }] });
          }
          if (pathStr.includes('/rest/api/3/issue') && init.method === 'POST') {
            return mockResponse(true, 201, {
              id: '10501',
              key: jiraKey,
              self: `https://acme.atlassian.net/rest/api/3/issue/10501`
            });
          }
          return mockResponse(404, 404, { errorMessages: ['Not mocked'] });
        },
        async requestConfluence(routeVal, init = {}) {
          const pathStr = String(routeVal?.value ?? routeVal);
          const body = init.body ? JSON.parse(init.body) : null;
          calls.push({ product: 'confluence', method: init.method || 'GET', path: pathStr, body });

          if (pathStr.includes('/wiki/api/v2/spaces')) {
            return mockResponse(true, 200, { results: [{ id: confluenceSpaceId, key: 'EXEC' }] });
          }
          if (pathStr.includes('/wiki/api/v2/pages/') && (init.method || 'GET') === 'GET') {
            return mockResponse(true, 200, existingPage || {
              id: confluencePageId,
              title: 'ACME Decision Log',
              version: { number: 3 },
              body: { storage: { value: '<p>Previous</p>' } }
            });
          }
          if (pathStr.includes('/wiki/api/v2/pages/') && init.method === 'PUT') {
            return mockResponse(true, 200, {
              id: confluencePageId,
              title: body.title,
              version: { number: body.version.number },
              _links: { webui: `/wiki/spaces/EXEC/pages/${confluencePageId}` }
            });
          }
          if (pathStr.includes('/wiki/api/v2/pages') && init.method === 'POST') {
            return mockResponse(true, 200, {
              id: confluencePageId,
              spaceId: body.spaceId,
              title: body.title,
              _links: { webui: `/wiki/spaces/EXEC/pages/${confluencePageId}` }
            });
          }
          return mockResponse(false, 404, { message: 'Not mocked' });
        }
      };
    }
  };

  return { apiClient, calls };
}

test('approveDecisionCard calls Jira v3 POST, Confluence v2 POST, and persists to Forge KVS', async () => {
  const store = createMemoryStore();
  const { apiClient, calls } = createMockAtlassianApi({
    jiraKey: 'ACME-777',
    confluenceSpaceId: '445566',
    confluencePageId: '998877'
  });

  const svc = createAcmeService({
    apiClient,
    store,
    now: () => '2026-11-19T12:00:00.000Z'
  });

  const result = await svc.approveDecisionCard(
    { cardId: 'DEC-001', rationale: 'Scale paid search now' },
    { cloudId: 'site-abc', accountId: 'acct-weni' }
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'APPROVED');
  assert.equal(result.execution.jira.status, 'CREATED');
  assert.equal(result.execution.jira.key, 'ACME-777');
  assert.equal(result.execution.confluence.status, 'CREATED');
  assert.equal(result.execution.confluence.id, '998877');
  assert.equal(result.execution.auditLogPersisted, true);

  // Verify Jira POST and Confluence POST were actually called
  assert.ok(calls.some((c) => c.product === 'jira' && c.method === 'POST' && c.path.includes('/rest/api/3/issue')));
  assert.ok(calls.some((c) => c.product === 'confluence' && c.method === 'POST' && c.path.includes('/wiki/api/v2/pages')));

  // Verify KVS persistence
  const audit = await store.get(KVS_KEYS.AUDIT_LOG);
  assert.ok(Array.isArray(audit));
  assert.equal(audit[0].cardId, 'DEC-001');
  assert.equal(audit[0].jiraIssueKey, 'ACME-777');
  assert.equal(audit[0].confluencePageId, '998877');

  const states = await store.get(KVS_KEYS.DECISION_STATES);
  assert.equal(states['DEC-001'].status, 'APPROVED');
  assert.equal(states['DEC-001'].jiraIssueKey, 'ACME-777');
});

test('approveDecisionCard appends to existing Confluence Decision Log page when decisionLogPageId is configured', async () => {
  const store = createMemoryStore();
  const { apiClient, calls } = createMockAtlassianApi({
    jiraKey: 'ACME-778',
    confluencePageId: '334455'
  });
  const svc = createAcmeService({ apiClient, store, now: () => '2026-11-19T13:00:00.000Z' });

  await svc.updateWorkspaceConfig({ projectKey: 'GROWTH', decisionLogPageId: '334455' });
  const res = await svc.approveDecisionCard({ cardId: 'DEC-002' }, { cloudId: 'site-abc' });

  assert.equal(res.execution.confluence.status, 'APPENDED');
  assert.equal(res.execution.confluence.version, 4);
  const putCall = calls.find((c) => c.product === 'confluence' && c.method === 'PUT');
  assert.ok(putCall, 'Expected Confluence PUT call for page append');
  assert.equal(putCall.body.version.number, 4);
  assert.match(putCall.body.body.value, /DEC-002/);
});

test('holdDecisionCard skips Jira/Confluence creation and persists HELD status to Forge KVS', async () => {
  const store = createMemoryStore();
  const { apiClient, calls } = createMockAtlassianApi();
  const svc = createAcmeService({ apiClient, store, now: () => '2026-11-19T14:00:00.000Z' });

  const res = await svc.holdDecisionCard({
    cardId: 'DEC-004',
    rationale: 'Wait for Q4 CRM budget unlock'
  });

  assert.equal(res.ok, true);
  assert.equal(res.status, 'HELD');
  assert.equal(calls.length, 0);

  const logRes = await svc.listDecisionAuditLog({ limit: 10 });
  assert.equal(logRes.entries[0].cardId, 'DEC-004');
  assert.equal(logRes.entries[0].status, 'HELD');
  assert.equal(logRes.entries[0].rationale, 'Wait for Q4 CRM budget unlock');
});

test('getBootstrap and queryAcmeSignals reflect persisted KVS states', async () => {
  const store = createMemoryStore();
  const { apiClient } = createMockAtlassianApi({ jiraKey: 'ACME-888', confluencePageId: '112233' });
  const svc = createAcmeService({ apiClient, store, now: () => '2026-11-19T15:00:00.000Z' });

  await svc.approveDecisionCard({ cardId: 'DEC-003' }, { cloudId: 'site-xyz' });
  const boot = await svc.getBootstrap({}, { cloudId: 'site-xyz' });

  assert.equal(boot.ok, true);
  assert.equal(boot.mode, 'FORGE_LIVE');
  assert.equal(boot.mcpTools.length, 4);
  const dec3 = boot.decisionCards.find((c) => c.id === 'DEC-003');
  assert.equal(dec3.status, 'APPROVED');
  assert.equal(dec3.jiraIssueKey, 'ACME-888');
  assert.equal(dec3.confluencePageId, '112233');
});
