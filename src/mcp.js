/**
 * Model Context Protocol (MCP) JSON-RPC 2.0 handler exposed via Forge Webtrigger.
 * Allows external AI clients & Rovo-compatible MCP hosts to discover and execute
 * ACME Decisions Layer tools (`acme_query_signals`, `acme_approve_decision`,
 * `acme_hold_decision`, `acme_get_audit_log`) with strict JSON Schema validation.
 */

import { MCP_TOOLS, FORGE_APP_ID } from './catalog.js';

export const MCP_PROTOCOL_VERSION = '2025-03-26';

export const MCP_TOOL_ALIASES = {
  acme_query_signals: 'acme_query_signals',
  get_active_decisions: 'acme_query_signals',
  acme_approve_decision: 'acme_approve_decision',
  approve_decision: 'acme_approve_decision',
  acme_hold_decision: 'acme_hold_decision',
  hold_decision: 'acme_hold_decision',
  acme_get_audit_log: 'acme_get_audit_log',
  get_audit_log: 'acme_get_audit_log'
};

export function resolveCanonicalToolName(toolName) {
  return MCP_TOOL_ALIASES[String(toolName || '').trim()] || null;
}

/**
 * Validates MCP `tools/call` arguments against the authoritative tool JSON Schema.
 */
export function validateMcpToolArguments(toolName, args) {
  const canonicalName = resolveCanonicalToolName(toolName);
  if (!canonicalName) {
    return {
      valid: false,
      canonicalName: null,
      errors: [`Unknown MCP tool: ${String(toolName || '')}`]
    };
  }

  const toolDef = MCP_TOOLS.find((t) => t.name === canonicalName);
  const schema = toolDef?.inputSchema || { type: 'object', properties: {} };

  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return {
      valid: false,
      canonicalName,
      errors: ['arguments must be a JSON object']
    };
  }

  const errors = [];
  const required = schema.required || [];
  for (const field of required) {
    const val = args[field];
    if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
      errors.push(`Missing required parameter "${field}"`);
    }
  }

  const properties = schema.properties || {};
  for (const [key, propSchema] of Object.entries(properties)) {
    if (args[key] === undefined || args[key] === null) continue;
    const val = args[key];

    if (propSchema.type === 'string' && typeof val !== 'string') {
      errors.push(`Parameter "${key}" must be a string`);
      continue;
    }
    if (propSchema.type === 'number' && (typeof val !== 'number' || Number.isNaN(val))) {
      errors.push(`Parameter "${key}" must be a finite number`);
      continue;
    }
    if (Array.isArray(propSchema.enum) && !propSchema.enum.includes(val)) {
      errors.push(`Parameter "${key}" must be one of [${propSchema.enum.join(', ')}]`);
    }
    if (typeof propSchema.minimum === 'number' && val < propSchema.minimum) {
      errors.push(`Parameter "${key}" must be >= ${propSchema.minimum}`);
    }
    if (typeof propSchema.maximum === 'number' && val > propSchema.maximum) {
      errors.push(`Parameter "${key}" must be <= ${propSchema.maximum}`);
    }
  }

  return {
    valid: errors.length === 0,
    canonicalName,
    checkedFields: Object.keys(properties),
    errors
  };
}

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

  if (!body || typeof body !== 'object' || Array.isArray(body) || body.jsonrpc !== '2.0') {
    return buildMcpHttpResponse(200, {
      jsonrpc: '2.0',
      id: body?.id ?? null,
      error: { code: -32600, message: 'Invalid Request: expected JSON-RPC 2.0 envelope' }
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
          version: '2.1.0',
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
    const args = params.arguments ?? {};

    const validation = validateMcpToolArguments(toolName, args);
    if (!validation.valid) {
      return buildMcpHttpResponse(200, {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: validation.canonicalName
            ? `Invalid params for ${validation.canonicalName}: ${validation.errors.join('; ')}`
            : `Unknown MCP tool: ${String(toolName || '')}`,
          data: {
            tool: validation.canonicalName || String(toolName || ''),
            errors: validation.errors
          }
        }
      });
    }

    const dispatch = {
      acme_query_signals: handlers.queryAcmeSignals,
      acme_approve_decision: handlers.approveDecisionCard,
      acme_hold_decision: handlers.holdDecisionCard,
      acme_get_audit_log: handlers.listDecisionAuditLog
    };

    const fn = dispatch[validation.canonicalName];
    try {
      const result = await fn(args);
      return buildMcpHttpResponse(200, {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result,
          validation: {
            valid: true,
            canonicalTool: validation.canonicalName,
            checkedFields: validation.checkedFields
          },
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
