# ACME Decisions Layer & Command Center (Atlassian Codegeist 2026)

Enterprise Strategic Intelligence, **Rovo Executive Decisions Agent**, **Jira Cloud REST v3 Issue Dispatcher**, **Confluence Cloud REST v2 Decision Governance Publisher**, **Forge KVS Persistent Audit Log**, and **MCP JSON-RPC 2.0 Webtrigger Server** built on **Atlassian Forge (`nodejs22.x`)**.

- **Atlassian Forge App ID:** `ari:cloud:ecosystem::app/1ccdf603-166b-400f-b0d9-6f6dab65f91a`
- **Live Interactive Preview (GitHub Pages):** [https://wenizmohamed.github.io/acme-forge-app/](https://wenizmohamed.github.io/acme-forge-app/)
- **Demo Video:** [https://youtu.be/EGcZE_zgaHE](https://youtu.be/EGcZE_zgaHE)

---

## Architecture

```text
Jira Global Page / Confluence Global Page / Confluence Macro (static/main-ui/)
        │
        ├── Inside Atlassian Cloud iframe  ──► @forge/bridge invoke() ──► src/index.js (@forge/resolver)
        └── Outside Forge (GitHub Pages)   ──► forge-bridge-adapter.js (transparent localStorage preview mirror)

Rovo Agent (acme-decisions-agent) ──► Rovo Actions (manifest.yml) ──► src/index.js
External MCP Clients              ──► Forge Webtrigger (JSON-RPC) ──► src/mcp.js
                                                                          │
                   ┌──────────────────────────────────────────────────────┼──────────────────────────────┐
                   ▼                                                      ▼                              ▼
   api.asUser().requestJira()                           api.asUser().requestConfluence()           @forge/kvs
   POST /rest/api/3/issue (ADF)                         POST /wiki/api/v2/pages (or PUT append)    acme:decision-audit-log
                                                                                                   acme:decision-states
                                                                                                   acme:workspace-config
```

## Forge Modules (`manifest.yml`)

| Module | Key | Purpose |
| --- | --- | --- |
| `rovo:agent` | `acme-decisions-agent` | ACME Executive Decisions Agent with 4 actions & executive conversation starters |
| `action` | `approve-decision-card` | Approves a card -> creates Jira v3 issue + Confluence v2 Decision Page + KVS audit record + Teamwork Graph ARIs |
| `action` | `hold-decision-card` | Defers a card to weekly executive review with rationale persisted in `@forge/kvs` |
| `action` | `query-acme-signals` | Returns live market signals (SOV, search velocity, ROAS, cardholders) + pending/executed cards |
| `action` | `list-decision-audit-log` | Returns the persisted Forge KVS Decision Audit Log with Jira & Confluence links |
| `jira:globalPage` | `acme-command-center-page` | Full Command Center & Decisions Layer Custom UI embedded in Jira |
| `confluence:globalPage` | `acme-confluence-decisions-page` | Executive Decisions Layer page in Confluence (`/acme-decisions`) |
| `confluence:macro` | `acme-executive-scorecard` | Embeddable Executive Scorecard & Decisions macro on any Confluence page |
| `webtrigger` | `acme-mcp-endpoint` | JSON-RPC 2.0 MCP endpoint (`initialize`, `tools/list`, `tools/call`) exposing 4 ACME tools |

## Permissions & Scopes

- `storage:app` (`@forge/kvs` persistent audit log & workspace config)
- `read:jira-work`, `write:jira-work` (Jira Cloud REST API v3 issue creation & project discovery)
- `read:page:confluence`, `write:page:confluence`, `read:space:confluence` (Confluence Cloud REST API v2 page create/append & space discovery)
- `read:confluence-content.all`, `write:confluence-content`

## Local Verification & Testing

```bash
npm install
npm run sync:ui
npm run verify        # runs manifest integrity validator + full Node.js unit test suite
```

## Deploying to Atlassian Cloud (Forge CLI)

```bash
npm install -g @forge/cli
forge login
forge lint
forge deploy
forge install --product jira
forge install --product confluence
```

## Live Preview vs. Live Forge Runtime

When opened inside Jira or Confluence, `forge-bridge-adapter.js` detects the Forge Custom UI bridge and invokes live resolvers (`getBootstrap`, `approveDecision`, `holdDecision`, `getAuditLog`, `querySignals`, `saveWorkspaceConfig`). When opened directly on GitHub Pages (`https://wenizmohamed.github.io/acme-forge-app/`), it displays a clear **GitHub Pages Preview · Forge Bridge Ready** badge, persists decisions in `localStorage`, and provides an inline **Inspect Forge / MCP Payloads** drawer so judges can inspect the exact Jira REST v3 ADF and Confluence REST v2 storage-format payloads live.
