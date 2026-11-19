/**
 * Live Atlassian Cloud REST API v3 (Jira) and REST API v2 (Confluence) adapters.
 * Uses `api.asUser().requestJira` and `api.asUser().requestConfluence` with Forge `route`.
 */

import api, { route } from '@forge/api';
import {
  buildJiraIssuePayload,
  buildConfluenceCreatePagePayload,
  buildConfluenceAppendPagePayload
} from './builders.js';

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

/**
 * Resolves a valid Jira project key: uses requested/configured key if available,
 * otherwise discovers the first accessible Jira project via `/rest/api/3/project/search`.
 */
export async function resolveJiraProjectKey(preferredKey, apiClient = api) {
  if (preferredKey && String(preferredKey).trim()) {
    return String(preferredKey).trim().toUpperCase();
  }
  try {
    const res = await apiClient
      .asUser()
      .requestJira(route`/rest/api/3/project/search?maxResults=5`, {
        headers: { Accept: 'application/json' }
      });
    if (res.ok) {
      const data = await safeParseJson(res);
      const first = (data.values || [])[0];
      if (first?.key) return first.key;
    }
  } catch {
    // Fall through to default ACME key
  }
  return 'ACME';
}

/**
 * Creates a live Jira issue via `POST /rest/api/3/issue` using `api.asUser().requestJira`.
 */
export async function createJiraDecisionIssue(card, options = {}, apiClient = api) {
  const projectKey = await resolveJiraProjectKey(options.projectKey, apiClient);
  const payload = buildJiraIssuePayload(card, { ...options, projectKey });

  try {
    const res = await apiClient.asUser().requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await safeParseJson(res);

    if (!res.ok) {
      return {
        status: 'ERROR',
        httpStatus: res.status,
        key: null,
        error:
          data.errorMessages?.join('; ') ||
          JSON.stringify(data.errors || {}) ||
          `Jira API returned HTTP ${res.status}`,
        requestPayload: payload
      };
    }

    return {
      status: 'CREATED',
      httpStatus: res.status,
      id: data.id || null,
      key: data.key,
      self: data.self || null,
      browseUrl: options.siteUrl ? `${options.siteUrl.replace(/\/$/, '')}/browse/${data.key}` : `/browse/${data.key}`,
      projectKey,
      requestPayload: payload
    };
  } catch (err) {
    return {
      status: 'ERROR',
      key: null,
      error: String(err?.message || err),
      requestPayload: payload
    };
  }
}

/**
 * Resolves a Confluence Space ID via `GET /wiki/api/v2/spaces?limit=5` if none configured.
 */
export async function resolveConfluenceSpaceId(preferredSpaceId, apiClient = api) {
  if (preferredSpaceId && String(preferredSpaceId).trim()) {
    return String(preferredSpaceId).trim();
  }
  try {
    const res = await apiClient
      .asUser()
      .requestConfluence(route`/wiki/api/v2/spaces?limit=5`, {
        headers: { Accept: 'application/json' }
      });
    if (res.ok) {
      const data = await safeParseJson(res);
      const first = (data.results || [])[0];
      if (first?.id) return String(first.id);
    }
  } catch {
    // No accessible Confluence space
  }
  return '';
}

/**
 * Creates a new Confluence Decision Governance page (`POST /wiki/api/v2/pages`)
 * or appends to an existing Decision Log page (`PUT /wiki/api/v2/pages/{id}`)
 * using `api.asUser().requestConfluence`.
 */
export async function publishConfluenceDecisionPage(card, jiraResult = {}, options = {}, apiClient = api) {
  const targetPageId = String(options.decisionLogPageId || '').trim();

  // Mode 1: Append to an existing Confluence Decision Log page
  if (targetPageId) {
    try {
      const getRes = await apiClient
        .asUser()
        .requestConfluence(route`/wiki/api/v2/pages/${targetPageId}?body-format=storage`, {
          headers: { Accept: 'application/json' }
        });

      if (getRes.ok) {
        const existingPage = await safeParseJson(getRes);
        const updatePayload = buildConfluenceAppendPagePayload(existingPage, card, jiraResult, options);
        const putRes = await apiClient
          .asUser()
          .requestConfluence(route`/wiki/api/v2/pages/${targetPageId}`, {
            method: 'PUT',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatePayload)
          });

        const updated = await safeParseJson(putRes);
        if (putRes.ok) {
          return {
            status: 'APPENDED',
            httpStatus: putRes.status,
            id: String(updated.id || targetPageId),
            title: updated.title || updatePayload.title,
            version: updated.version?.number || updatePayload.version.number,
            webUrl: updated._links?.webui || `/wiki/pages/${targetPageId}`,
            requestPayload: updatePayload
          };
        }
        return {
          status: 'ERROR',
          httpStatus: putRes.status,
          id: targetPageId,
          error: updated.message || `Confluence PUT returned HTTP ${putRes.status}`,
          requestPayload: updatePayload
        };
      }
    } catch (err) {
      return {
        status: 'ERROR',
        id: targetPageId,
        error: String(err?.message || err)
      };
    }
  }

  // Mode 2: Create a dedicated Confluence Decision Record page via REST API v2
  const spaceId = await resolveConfluenceSpaceId(options.spaceId, apiClient);
  const createPayload = buildConfluenceCreatePagePayload(card, jiraResult, {
    ...options,
    spaceId
  });

  if (!spaceId) {
    return {
      status: 'SKIPPED_NO_SPACE',
      id: null,
      error: 'No Confluence spaceId configured or accessible via /wiki/api/v2/spaces.',
      requestPayload: createPayload
    };
  }

  try {
    const res = await apiClient.asUser().requestConfluence(route`/wiki/api/v2/pages`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createPayload)
    });

    const data = await safeParseJson(res);
    if (!res.ok) {
      return {
        status: 'ERROR',
        httpStatus: res.status,
        id: null,
        error: data.message || data.errors?.[0]?.title || `Confluence API returned HTTP ${res.status}`,
        requestPayload: createPayload
      };
    }

    return {
      status: 'CREATED',
      httpStatus: res.status,
      id: String(data.id),
      spaceId: String(data.spaceId || spaceId),
      title: data.title || createPayload.title,
      webUrl: data._links?.webui || `/wiki/spaces/${spaceId}/pages/${data.id}`,
      requestPayload: createPayload
    };
  } catch (err) {
    return {
      status: 'ERROR',
      id: null,
      error: String(err?.message || err),
      requestPayload: createPayload
    };
  }
}
