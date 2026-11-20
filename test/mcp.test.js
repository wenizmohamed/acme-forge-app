import test from 'node:test';
import assert from 'node:assert/strict';
import { createAcmeService } from '../src/index.js';
import { createMemoryStore } from '../src/storage.js';
import { MCP_PROTOCOL_VERSION, validateMcpToolArguments } from '../src/mcp.js';

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
  assert.equal(callBody.result.validation.valid, true);
  assert.equal(callBody.result.validation.canonicalTool, 'acme_approve_decision');
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
  assert.equal(aliasBody.result.validation.canonicalTool, 'acme_query_signals');
  assert.equal(aliasBody.result.structuredContent.decisionCards.length, 4);
});

test('MCP tools/call executes acme_hold_decision and category-filtered acme_query_signals', async () => {
  const svc = createStubService();

  const holdRes = await svc.mcpHandler({
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'acme_hold_decision', arguments: { cardId: 'DEC-004', rationale: 'Hold for board' } }
    })
  });
  const holdBody = JSON.parse(holdRes.body);
  assert.equal(holdBody.result.isError, false);
  assert.equal(holdBody.result.structuredContent.status, 'HELD');

  const queryRes = await svc.mcpHandler({
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'acme_query_signals', arguments: { category: 'budget' } }
    })
  });
  const queryBody = JSON.parse(queryRes.body);
  assert.equal(queryBody.result.structuredContent.decisionCards.length, 1);
  assert.equal(queryBody.result.structuredContent.decisionCards[0].id, 'DEC-001');
});

test('MCP handler returns JSON-RPC error codes for invalid JSON, bad envelope, unknown method, and unknown tool', async () => {
  const svc = createStubService();

  const badJson = await svc.mcpHandler({ body: '{broken json' });
  assert.equal(badJson.statusCode, 400);
  assert.equal(JSON.parse(badJson.body).error.code, -32700);

  const badEnvelope = await svc.mcpHandler({ body: JSON.stringify({ jsonrpc: '1.0', id: 8, method: 'tools/list' }) });
  assert.equal(JSON.parse(badEnvelope.body).error.code, -32600);

  const badMethod = await svc.mcpHandler({ body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'resources/read' }) });
  assert.equal(JSON.parse(badMethod.body).error.code, -32601);

  const unknownTool = await svc.mcpHandler({
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: { name: 'nonexistent_tool', arguments: {} }
    })
  });
  assert.equal(JSON.parse(unknownTool.body).error.code, -32602);
});

test('MCP schema validation rejects missing required cardId on acme_approve_decision and acme_hold_decision', async () => {
  const svc = createStubService();

  const missingApprove = await svc.mcpHandler({
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: { name: 'acme_approve_decision', arguments: {} }
    })
  });
  const approveErr = JSON.parse(missingApprove.body);
  assert.equal(approveErr.error.code, -32602);
  assert.match(approveErr.error.message, /Missing required parameter "cardId"/);

  const missingHold = await svc.mcpHandler({
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: { name: 'acme_hold_decision', arguments: { cardId: '   ' } }
    })
  });
  assert.equal(JSON.parse(missingHold.body).error.code, -32602);
});

test('MCP schema validation rejects invalid enum values and out-of-range numeric bounds', async () => {
  const svc = createStubService();

  const badCat = await svc.mcpHandler({
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: { name: 'acme_query_signals', arguments: { category: 'crypto' } }
    })
  });
  const badCatBody = JSON.parse(badCat.body);
  assert.equal(badCatBody.error.code, -32602);
  assert.match(badCatBody.error.message, /must be one of/);

  const badLimitHigh = await svc.mcpHandler({
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/call',
      params: { name: 'acme_get_audit_log', arguments: { limit: 250 } }
    })
  });
  assert.equal(JSON.parse(badLimitHigh.body).error.code, -32602);

  const badLimitZero = validateMcpToolArguments('acme_get_audit_log', { limit: 0 });
  assert.equal(badLimitZero.valid, false);
  assert.match(badLimitZero.errors[0], />= 1/);
});

test('validateMcpToolArguments rejects non-object arguments and wrong property types', () => {
  const arrayArgs = validateMcpToolArguments('acme_query_signals', ['budget']);
  assert.equal(arrayArgs.valid, false);
  assert.match(arrayArgs.errors[0], /must be a JSON object/);

  const wrongType = validateMcpToolArguments('acme_get_audit_log', { limit: 'ten' });
  assert.equal(wrongType.valid, false);
  assert.match(wrongType.errors[0], /must be a finite number/);

  const wrongCardType = validateMcpToolArguments('acme_approve_decision', { cardId: 12345 });
  assert.equal(wrongCardType.valid, false);
  assert.match(wrongCardType.errors[0], /must be a string/);
});
