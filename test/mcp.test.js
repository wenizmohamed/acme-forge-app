import test from 'node:test';
import assert from 'node:assert/strict';
import { createAcmeService } from '../src/index.js';
import { createMemoryStore } from '../src/storage.js';
import { MCP_PROTOCOL_VERSION } from '../src/mcp.js';

function createStubService() {
  const store = createMemoryStore();
  const apiClient = {
    asUser() {
      return {
        async requestJira() {
          return { ok: true, status: 201, async json() { return { id: '1', key: 'ACME-900' }; } };
        },
        async requestConfluence(routeVal) {
          const p = String(routeVal?.value ?? routeVal);
          if (p.includes('/spaces')) {
            return { ok: true, status: 200, async json() { return { results: [{ id: '777' }] }; } };
          }
          return { ok: true, status: 200, async json() { return { id: '888', title: 'Decision', _links: { webui: '/wiki/pages/888' } }; } };
        }
      };
    }
  };
  return createAcmeService({ apiClient, store, now: () => '2026-11-19T16:00:00.000Z' });
}

test('MCP initialize and tools/list return valid JSON-RPC 2.0 responses', async () => {
  const svc = createStubService();

  const initRes = await svc.mcpHandler({
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  });
  assert.equal(initRes.statusCode, 200);
  const initBody = JSON.parse(initRes.body);
  assert.equal(initBody.result.protocolVersion, MCP_PROTOCOL_VERSION);
  assert.equal(initBody.result.serverInfo.name, 'acme-decisions-layer-forge-mcp');

  const listRes = await svc.mcpHandler({
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  });
  const listBody = JSON.parse(listRes.body);
  assert.equal(listBody.result.tools.length, 4);
  const names = listBody.result.tools.map((t) => t.name);
  assert.deepEqual(names, [
    'acme_query_signals',
    'acme_approve_decision',
    'acme_hold_decision',
    'acme_get_audit_log'
  ]);
});

test('MCP tools/call executes acme_approve_decision and acme_get_audit_log end-to-end', async () => {
  const svc = createStubService();

  const callRes = await svc.mcpHandler({
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'acme_approve_decision', arguments: { cardId: 'DEC-001' } }
    })
  });
  const callBody = JSON.parse(callRes.body);
  assert.equal(callBody.result.isError, false);
  assert.equal(callBody.result.structuredContent.execution.jira.key, 'ACME-900');
  assert.equal(callBody.result.structuredContent.execution.confluence.id, '888');

  const logRes = await svc.mcpHandler({
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'acme_get_audit_log', arguments: { limit: 5 } }
    })
  });
  const logBody = JSON.parse(logRes.body);
  assert.equal(logBody.result.structuredContent.entries[0].jiraIssueKey, 'ACME-900');

  // Verify concise aliases (get_active_decisions & approve_decision) work cleanly too
  const aliasRes = await svc.mcpHandler({
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'get_active_decisions', arguments: { category: 'all' } }
    })
  });
  const aliasBody = JSON.parse(aliasRes.body);
  assert.equal(aliasBody.result.isError, false);
  assert.equal(aliasBody.result.structuredContent.decisionCards.length, 4);
});

test('MCP handler returns JSON-RPC error codes for invalid JSON and unknown tools', async () => {
  const svc = createStubService();

  const badJson = await svc.mcpHandler({ body: '{broken json' });
  assert.equal(badJson.statusCode, 400);
  assert.equal(JSON.parse(badJson.body).error.code, -32700);

  const unknownTool = await svc.mcpHandler({
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: { name: 'nonexistent_tool', arguments: {} }
    })
  });
  assert.equal(JSON.parse(unknownTool.body).error.code, -32602);
});
