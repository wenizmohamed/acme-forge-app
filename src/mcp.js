/**
 * Model Context Protocol (MCP) JSON-RPC 2.0 handler exposed via Forge Webtrigger.
 * Allows external AI clients & Rovo-compatible MCP hosts to discover and execute
 * ACME Decisions Layer tools (`acme_query_signals`, `acme_approve_decision`,
 * `acme_hold_decision`, `acme_get_audit_log`).
 */

import { MCP_TOOLS, FORGE_APP_ID } from './catalog.js';

export const MCP_PROTOCOL_VERSION = '2025-03-26';

export function buildMcpHttpResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': ['application/json'],
      'X-Forge-App-Id': [FORGE_APP_ID]
    },
    body: JSON.stringify(payload)
  };
}

export async function handleMcpRequest(req, handlers) {
  let body;
  try {
    body = typeof req?.body === 'string' ? JSON.parse(req.body || '{}') : req?.body || {};
  } catch {
    return buildMcpHttpResponse(400, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error: invalid JSON body' }
    });
  }

  const id = body.id ?? null;
  const method = body.method;
  const params = body.params || {};

  if (method === 'initialize') {
    return buildMcpHttpResponse(200, {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: 'acme-decisions-layer-forge-mcp',
          version: '2.0.0',
          appId: FORGE_APP_ID
        }
      }
    });
  }

  if (method === 'tools/list') {
    return buildMcpHttpResponse(200, {
      jsonrpc: '2.0',
      id,
      result: { tools: MCP_TOOLS }
    });
  }

  if (method === 'tools/call') {
    const toolName = params.name;
    const args = params.arguments || {};

    const dispatch = {
      acme_query_signals: handlers.queryAcmeSignals,
      get_active_decisions: handlers.queryAcmeSignals,
      acme_approve_decision: handlers.approveDecisionCard,
      approve_decision: handlers.approveDecisionCard,
      acme_hold_decision: handlers.holdDecisionCard,
      hold_decision: handlers.holdDecisionCard,
      acme_get_audit_log: handlers.listDecisionAuditLog,
      get_audit_log: handlers.listDecisionAuditLog
    };

    const fn = dispatch[toolName];
    if (!fn) {
      return buildMcpHttpResponse(200, {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: `Unknown MCP tool: ${toolName}` }
      });
    }

    try {
      const result = await fn(args);
      return buildMcpHttpResponse(200, {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result,
          isError: result?.ok === false
        }
      });
    } catch (err) {
      return buildMcpHttpResponse(200, {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: String(err?.message || err) }
      });
    }
  }

  return buildMcpHttpResponse(200, {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${String(method || '')}` }
  });
}
