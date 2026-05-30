import { requireAdmin } from '../auth.js';
import { config } from '../config.js';
import { featuresContainer, revisionsContainer, metadataConfigsContainer, jiraDraftsContainer } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export default async function jiraRoutes(fastify, options) {
  // Check if Jira and AI Foundry are configured before enabling routes
  const checkConfigured = async (request, reply) => {
    if (!config.jira.configured) {
      return reply.code(503).send({ error: 'Jira integration is not configured on the server.' });
    }
  };

  const checkAIConfigured = async (request, reply) => {
    if (!config.ai.configured) {
      return reply.code(503).send({ error: 'Azure OpenAI completions are not configured on the server.' });
    }
  };

  const EPIC_SYSTEM_PROMPT = `Role & Purpose
You are an Agile Epic Creation Agent.
Your responsibility is to create high-quality Jira Epics that are clear, value-driven, and suitable for use by delivery teams, Product Owners, and leadership.

Given the roadmap feature details, generate a structured Jira Epic.
You MUST structure the description field using the following sections in order. Use ## for section headings, - for bullet points, and **bold** for emphasis within paragraphs. Do NOT use tables, nested lists, or code blocks.
1. **Description**: A clear description of the epic.
2. **Value**: The business and user value this epic delivers.
3. **T-Shirt Size**: Suggested size (S, M, L, XL) with brief justification.
4. **Acceptance Criteria**: Concrete criteria that must be met to mark this epic complete.
5. **Priority (Suggested)**: Suggested priority and why.
6. **Delivery Date**: Suggested timeframe or target release if applicable.
7. **Compliance Label**: Any compliance labels or considerations.
8. **Dependencies**: Any known dependencies or blockers.

Do NOT use em-dashes (—) anywhere in the output. Use a colon, comma, or rewrite the sentence instead.

You MUST return a valid JSON object only with this exact shape (do NOT wrap the JSON in markdown code blocks like \`\`\`json):
{
  "summary": "Clear, concise title for the Epic",
  "description": "The full Epic content structured with the required sections in markdown format",
  "labels": ["Extract any Compliance Labels or relevant tags here"],
  "priority": "Highest" | "High" | "Medium" | "Low" | "Lowest"
}`;

  const STANDALONE_TASK_SYSTEM_PROMPT = `You are a Jira Technical Lead.
Given the roadmap feature details, generate a single, high-quality standalone Jira Task.
Do NOT use em-dashes (—) anywhere in the output. Use a colon, comma, or rewrite the sentence instead.
Return a valid JSON object only with this exact shape (do NOT wrap the JSON in markdown code blocks like \`\`\`json):
{
  "summary": "Clear, concise title for the Task",
  "description": "Detailed description of the task requirements and technical steps. Use ## for section headings, - for bullet points, and **bold** for key terms.",
  "labels": ["array of labels, including category and tags"],
  "priority": "Highest" | "High" | "Medium" | "Low" | "Lowest"
}`;

  // Build child task system prompt dynamically based on granularity and acceptance criteria preferences
  function buildChildTaskSystemPrompt(granularity, acceptanceCriteria) {
    const granularityHints = {
      high:     'Generate 3–5 high-level tasks that cover the major work areas.',
      balanced: 'Generate around 7–9 well-balanced tasks that cover the epic thoroughly.',
      detailed: 'Generate 10–15 detailed, granular tasks that break down the work precisely.'
    };
    const hint = granularityHints[granularity] || granularityHints.balanced;
    const acLine = acceptanceCriteria
      ? '\nFor each task, include a brief set of acceptance criteria at the end of its description.'
      : '';

    return `You are a Jira Technical Lead.
Given the details of a roadmap feature and the generated Jira Epic summary and description, generate a list of child Tasks required to implement the feature.
Do not generate stories or sub-tasks, only standard Tasks. Provide brief technical descriptions for each task so delivery teams understand the work required.
Do NOT use em-dashes (—) anywhere in the output. Use a colon, comma, or rewrite the sentence instead.
${hint}${acLine}

You MUST return a valid JSON object only with this exact shape (do NOT wrap the JSON in markdown code blocks like \`\`\`json):
{
  "childTasks": [
    {
      "summary": "Clear, technical summary of the task",
      "description": "Technical details and description of what needs to be done"
    }
  ]
}`;
  }

  // Helper to call Azure OpenAI Chat Completions endpoint
  async function callAzureOpenAI(systemPrompt, userMessage, request) {
    const { endpoint, apiKey, deployment } = config.ai;
    const base = endpoint.replace(/\/$/, '');

    // Construct standard v1 chat completions endpoint matching the curl format
    let url = '';
    if (base.includes('/openai/v1/chat/completions')) {
      url = base;
    } else if (base.includes('/openai/v1')) {
      url = `${base}/chat/completions`;
    } else {
      url = `${base}/openai/v1/chat/completions`;
    }

    const headers = {
      'Content-Type': 'application/json',
      'api-key': apiKey
    };

    const body = {
      model: deployment,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' }
    };

    request.log.info({ url, model: deployment }, 'Calling Azure OpenAI Chat Completions');

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      request.log.error({ status: response.status, body: errText }, 'Azure OpenAI API error');
      throw new Error(`Azure OpenAI error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const outputText = data.choices?.[0]?.message?.content ?? '';

    let parsedOutput;
    try {
      const text = outputText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedOutput = JSON.parse(text);
    } catch (e) {
      request.log.error({ outputText }, 'Azure OpenAI did not return valid JSON');
      throw new Error('Azure OpenAI did not return valid JSON');
    }
    return parsedOutput;
  }

  // ── 1. POST /preview — AI Foundry Generation ─────────────────────────────────
  fastify.post('/preview', {
    preHandler: [requireAdmin, checkConfigured, checkAIConfigured],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        properties: {
          featureId:          { type: 'string' },
          jiraType:           { type: 'string', enum: ['epic', 'task'] },
          generateChildTasks: { type: 'boolean' },
          granularity:        { type: 'string', enum: ['high', 'balanced', 'detailed'] },
          extraContext:       { type: 'string', maxLength: 2000 },
          acceptanceCriteria: { type: 'boolean' }
        },
        required: ['featureId', 'jiraType']
      }
    }
  }, async (request, reply) => {
    const {
      featureId, jiraType, generateChildTasks,
      granularity, extraContext, acceptanceCriteria
    } = request.body;

    let feature;
    try {
      const { resource } = await featuresContainer.item(featureId, featureId).read();
      feature = resource;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Feature not found' });
      throw err;
    }

    const featureText = `
Title: ${feature.title}
Description: ${(feature.description || '').replace(/<[^>]+>/g, '')}
Internal Notes: ${(feature.internal_notes || '').replace(/<[^>]+>/g, '')}
Priority: ${feature.priority}
Tags: ${(feature.tags || []).join(', ')}
Category: ${feature.category_name || 'None'}
    `.trim();

    try {
      let epicResult = null;
      let childTasks = [];

      if (jiraType === 'epic') {
        epicResult = await callAzureOpenAI(EPIC_SYSTEM_PROMPT, featureText, request);

        // Generate Child Tasks if requested
        if (generateChildTasks) {
          const taskUserMsg = `Feature Details:\n${featureText}\n\nGenerated Epic Summary: ${epicResult.summary}\nGenerated Epic Description: ${epicResult.description}${extraContext ? '\n\nAdditional Context:\n' + extraContext : ''}`;
          const taskData = await callAzureOpenAI(
            buildChildTaskSystemPrompt(granularity, acceptanceCriteria !== false),
            taskUserMsg,
            request
          );
          childTasks = taskData.childTasks || [];
        }
      } else {
        epicResult = await callAzureOpenAI(STANDALONE_TASK_SYSTEM_PROMPT, featureText, request);
      }

      return {
        epic: epicResult,
        childTasks
      };

    } catch (err) {
      request.log.error(err, 'Error generating Jira preview');
      return reply.code(500).send({ error: 'Failed to generate preview via Azure OpenAI completions' });
    }
  });

  const jiraAuthHeader = `Basic ${Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64')}`;
  const jiraBaseUrl = config.jira.baseUrl.replace(/\/$/, '');

  // Helper to call Jira API
  async function callJiraAPI(path, options = {}) {
    const url = `${jiraBaseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': jiraAuthHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Jira API error: ${response.status} ${errText}`);
    }

    return response.json();
  }

  // ── GET /config — Fetch Jira configuration ──────────────────────────────────
  fastify.get('/config', {
    preHandler: [requireAdmin]
  }, async (request, reply) => {
    return {
      baseUrl: config.jira.baseUrl || ''
    };
  });

  // ── GET /labels — Fetch available Jira labels ──────────────────────────────
  fastify.get('/labels', {
    preHandler: [requireAdmin, checkConfigured]
  }, async (request, reply) => {
    try {
      const data = await callJiraAPI('/rest/api/3/label?maxResults=1000&startAt=0');
      return { labels: data.values || [] };
    } catch (err) {
      request.log.error(err, 'Error fetching Jira labels');
      return reply.code(500).send({ error: 'Failed to fetch labels from Jira' });
    }
  });

  // ── GET /issues — Fetch Jira issue summaries by key list ─────────────────
  fastify.get('/issues', {
    preHandler: [requireAdmin, checkConfigured]
  }, async (request, reply) => {
    const { keys } = request.query;
    if (!keys) return { issues: [] };

    const keyList = String(keys).split(',').map(k => k.trim()).filter(Boolean).slice(0, 30);
    if (!keyList.length) return { issues: [] };

    try {
      const jql = encodeURIComponent(`issuekey in (${keyList.join(',')}) ORDER BY issuekey ASC`);
      const data = await callJiraAPI(`/rest/api/3/search/jql?jql=${jql}&fields=summary&maxResults=30`);
      return {
        issues: (data.issues || []).map(i => ({
          key: i.key,
          summary: i.fields?.summary || ''
        }))
      };
    } catch (err) {
      request.log.error(err, 'Error fetching Jira issue summaries');
      return reply.code(500).send({ error: 'Failed to fetch issues from Jira' });
    }
  });

  // ── 2. GET /epics — Fetch Jira Epics ───────────────────────────────────────
  fastify.get('/epics', {
    preHandler: [requireAdmin, checkConfigured]
  }, async (request, reply) => {
    try {
      const jql = encodeURIComponent(`issuetype = Epic AND project = "${config.jira.projectKey}" ORDER BY created DESC`);
      const data = await callJiraAPI(`/rest/api/3/search/jql?jql=${jql}&maxResults=50&fields=summary,issuetype`);

      return data.issues.map(i => ({
        key: i.key,
        summary: i.fields.summary
      }));
    } catch (err) {
      request.log.error(err, 'Error fetching Jira epics');
      return reply.code(500).send({ error: 'Failed to fetch Epics from Jira' });
    }
  });

  // Helper: map our priority string to Jira priority ID
  // Usually: Highest (1), High (2), Medium (3), Low (4), Lowest (5)
  // NOTE: Verify these IDs against your Jira instance via GET /rest/api/3/priority
  const mapPriority = (priorityName) => {
    const p = (priorityName || '').toLowerCase();
    if (p === 'highest' || p === 'critical') return '1';
    if (p === 'high') return '2';
    if (p === 'medium') return '3';
    if (p === 'low') return '4';
    if (p === 'lowest') return '5';
    return '3'; // default medium
  };

  // Helper: parse inline markdown into ADF text nodes.
  // Handles: ***bold italic***, **bold**, *italic*, _italic_, `code`
  const parseInline = (text) => {
    // Split on inline patterns (capturing group keeps delimiters in array)
    const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g;
    const rawParts = text.split(regex);
    const parts = [];

    for (const part of rawParts) {
      if (!part) continue;
      if (part.startsWith('***') && part.endsWith('***') && part.length > 6) {
        parts.push({ type: 'text', text: part.slice(3, -3), marks: [{ type: 'strong' }, { type: 'em' }] });
      } else if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        parts.push({ type: 'text', text: part.slice(2, -2), marks: [{ type: 'strong' }] });
      } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        parts.push({ type: 'text', text: part.slice(1, -1), marks: [{ type: 'em' }] });
      } else if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
        parts.push({ type: 'text', text: part.slice(1, -1), marks: [{ type: 'em' }] });
      } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        parts.push({ type: 'text', text: part.slice(1, -1), marks: [{ type: 'code' }] });
      } else {
        parts.push({ type: 'text', text: part });
      }
    }

    return parts.length > 0 ? parts : [{ type: 'text', text }];
  };

  // Helper: build ADF (Atlassian Document Format) for Jira v3 descriptions
  const buildADF = (text) => {
    const content = [];
    const lines = text.split('\n');

    let currentList = null; // { type: 'bulletList' | 'orderedList', items: [] }

    const closeList = () => {
      if (currentList) {
        content.push({
          type: currentList.type,
          content: currentList.items.map(itemText => ({
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: parseInline(itemText)
              }
            ]
          }))
        });
        currentList = null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        closeList();
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        closeList();
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];
        content.push({
          type: "heading",
          attrs: { level },
          content: parseInline(headingText)
        });
        continue;
      }

      // Horizontal rule: --- / *** / ___
      if (line === '---' || line === '***' || line === '___') {
        closeList();
        content.push({ type: 'rule' });
        continue;
      }

      const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
      if (bulletMatch) {
        if (currentList && currentList.type !== 'bulletList') closeList();
        if (!currentList) currentList = { type: 'bulletList', items: [] };
        currentList.items.push(bulletMatch[1]);
        continue;
      }

      const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (orderedMatch) {
        if (currentList && currentList.type !== 'orderedList') closeList();
        if (!currentList) currentList = { type: 'orderedList', items: [] };
        currentList.items.push(orderedMatch[2]);
        continue;
      }

      closeList();

      let paragraphText = line;
      while (i + 1 < lines.length && lines[i + 1].trim() !== '') {
        const nextLine = lines[i + 1].trim();
        if (nextLine.match(/^(#{1,6})\s+/) || nextLine.match(/^[-*•]\s+/) || nextLine.match(/^(\d+)\.\s+/)) {
          break;
        }
        paragraphText += ' ' + nextLine;
        i++;
      }

      content.push({
        type: "paragraph",
        content: parseInline(paragraphText)
      });
    }

    closeList();

    if (content.length === 0) {
      content.push({
        type: "paragraph",
        content: [{ type: "text", text: "" }]
      });
    }

    return {
      type: "doc",
      version: 1,
      content
    };
  };

  // ── 3. POST /push — Push to Jira ───────────────────────────────────────────
  fastify.post('/push', {
    preHandler: [requireAdmin, checkConfigured],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        properties: {
          featureId:    { type: 'string' },
          jiraType:     { type: 'string', enum: ['epic', 'task'] },
          parentEpicKey: { type: 'string' },
          epic: {
            type: 'object',
            properties: {
              summary:     { type: 'string', maxLength: 500 },
              description: { type: 'string', maxLength: 32000 },
              labels:      { type: 'array', maxItems: 50, items: { type: 'string', maxLength: 100 } },
              priority:    { type: 'string' }
            },
            required: ['summary']
          },
          childTasks: {
            type: 'array',
            maxItems: 20,
            items: {
              type: 'object',
              properties: {
                summary:     { type: 'string', maxLength: 500 },
                description: { type: 'string', maxLength: 32000 },
                pts:         { type: 'integer', minimum: 0, maximum: 100 },
                priority:    { type: 'string' },
                labels:      { type: 'array', items: { type: 'string', maxLength: 100 } }
              }
            }
          }
        },
        required: ['featureId', 'jiraType', 'epic']
      }
    }
  }, async (request, reply) => {
    const { featureId, jiraType, epic, childTasks, parentEpicKey } = request.body;

    try {
      // 0. Read the Feature from Cosmos DB to get the owner/team
      const { resource: feature } = await featuresContainer.item(featureId, featureId).read();
      if (!feature) {
        return reply.code(404).send({ error: 'Feature not found' });
      }

      // Resolve Jira reporter based on owner mapping
      let reporterAccountId = null;
      if (feature.owner) {
        try {
          const configId = `owner:${feature.owner.trim()}`;
          const { resource: mapping } = await metadataConfigsContainer.item(configId, configId).read();
          if (mapping && mapping.jira_reporter_email) {
            const email = mapping.jira_reporter_email.trim();
            const users = await callJiraAPI(`/rest/api/3/user/search?query=${encodeURIComponent(email)}`);
            if (Array.isArray(users) && users.length > 0) {
              const match = users.find(u => u.emailAddress?.toLowerCase() === email.toLowerCase()) || users[0];
              reporterAccountId = match.accountId;
              request.log.info({ email, accountId: reporterAccountId }, 'Found Jira user for reporter mapping');
            } else {
              request.log.warn({ email }, 'Jira user search returned no results for email');
            }
          }
        } catch (e) {
          if (e.statusCode !== 404 && e.code !== 404) {
            request.log.error(e, 'Failed to fetch Jira reporter mapping');
          }
        }
      }

      // 1. Create the main Epic or Task
      const issuePayload = {
        fields: {
          project:     { key: config.jira.projectKey },
          summary:     epic.summary,
          description: buildADF(epic.description || ''),
          issuetype:   { name: jiraType === 'epic' ? 'Epic' : 'Task' },
          priority:    { id: mapPriority(epic.priority || 'Medium') },
          labels:      epic.labels || []
        }
      };

      if (reporterAccountId) {
        issuePayload.fields.reporter = { id: reporterAccountId };
      }

      if (jiraType === 'task' && parentEpicKey) {
        issuePayload.fields.parent = { key: parentEpicKey };
      }

      const mainIssueRes = await callJiraAPI('/rest/api/3/issue', {
        method: 'POST',
        body: JSON.stringify(issuePayload)
      });

      const mainIssueKey = mainIssueRes.key;
      let createdChildKeys = [];

      // 2. Create child tasks (if epic)
      if (jiraType === 'epic' && Array.isArray(childTasks) && childTasks.length > 0) {
        const bulkPayload = {
          issueUpdates: childTasks.map(task => {
            const fields = {
              project:     { key: config.jira.projectKey },
              summary:     task.summary,
              description: buildADF(task.description || ''),
              issuetype:   { name: 'Task' },
              parent:      { key: mainIssueKey }
            };
            if (reporterAccountId) fields.reporter = { id: reporterAccountId };
            if (task.priority) fields.priority = { id: mapPriority(task.priority) };
            if (Array.isArray(task.labels) && task.labels.length > 0) fields.labels = task.labels;
            // Only include story points if the custom field ID is configured via env var
            if (config.jira.storyPointsFieldId && task.pts != null) {
              fields[config.jira.storyPointsFieldId] = task.pts;
            }
            return { fields };
          })
        };

        const bulkRes = await callJiraAPI('/rest/api/3/issue/bulk', {
          method: 'POST',
          body: JSON.stringify(bulkPayload)
        });

        if (bulkRes.issues) {
          createdChildKeys = bulkRes.issues.map(i => i.key);
        }
      }

      // 3. Update the Cosmos DB feature to save the Jira Issue Key, child keys, and write revision
      const now = new Date().toISOString();

      const patchOps = [
        { op: 'set', path: '/jira_issue_key', value: mainIssueKey },
        { op: 'set', path: '/updated_at', value: now },
        { op: 'set', path: '/jira_child_keys', value: createdChildKeys || [] }
      ];

      await featuresContainer.item(featureId, featureId).patch(patchOps);

      await revisionsContainer.items.create({
        id: uuidv4(),
        feature_id: featureId,
        action: 'updated',
        changes: {
          jira_issue_key: {
            old: feature.jira_issue_key || null,
            new: mainIssueKey
          },
          jira_child_keys: {
            old: feature.jira_child_keys || [],
            new: createdChildKeys || []
          }
        },
        user_id: request.user?.email || 'admin',
        created_at: now
      });

      // 4. Clear any saved draft for this feature (non-critical — swallow errors)
      try {
        await jiraDraftsContainer.item(`draft::${featureId}`, featureId).delete();
      } catch (err) {
        if (err.code !== 404) request.log.warn(err, 'Failed to clear Jira draft after push');
      }

      return {
        issueKey: mainIssueKey,
        childKeys: createdChildKeys
      };

    } catch (err) {
      request.log.error(err, 'Error pushing to Jira');
      return reply.code(500).send({ error: 'Failed to push to Jira. Check server logs for details.' });
    }
  });

  // ── 4. POST /draft — Save a Jira draft ────────────────────────────────────
  fastify.post('/draft', {
    preHandler: [requireAdmin],
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        properties: {
          featureId:  { type: 'string' },
          epicData:   { type: 'object' },
          childTasks: { type: 'array' },
          config:     { type: 'object' }
        },
        required: ['featureId']
      }
    }
  }, async (request, reply) => {
    const { featureId, epicData, childTasks, config: generationConfig } = request.body;

    // Verify the feature exists before saving a draft for it
    try {
      await featuresContainer.item(featureId, featureId).read();
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Feature not found' });
      throw err;
    }

    const now = new Date().toISOString();
    const doc = {
      id:         `draft::${featureId}`,
      featureId,
      epicData:   epicData || {},
      childTasks: Array.isArray(childTasks) ? childTasks : [],
      config:     generationConfig || {},
      createdAt:  now,
      updatedAt:  now
    };
    try {
      await jiraDraftsContainer.items.upsert(doc);
      return { ok: true, savedAt: now };
    } catch (err) {
      request.log.error(err, 'Error saving Jira draft');
      return reply.code(500).send({ error: 'Failed to save draft' });
    }
  });

  // ── 5. GET /draft/:featureId — Fetch a saved Jira draft ───────────────────
  fastify.get('/draft/:featureId', {
    preHandler: [requireAdmin]
  }, async (request, reply) => {
    const { featureId } = request.params;
    try {
      const { resource } = await jiraDraftsContainer
        .item(`draft::${featureId}`, featureId).read();
      return resource;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Draft not found' });
      throw err;
    }
  });

  // ── 6. DELETE /draft/:featureId — Discard a saved Jira draft ─────────────
  fastify.delete('/draft/:featureId', {
    preHandler: [requireAdmin]
  }, async (request, reply) => {
    const { featureId } = request.params;
    try {
      await jiraDraftsContainer.item(`draft::${featureId}`, featureId).delete();
      return { ok: true };
    } catch (err) {
      if (err.code === 404) return { ok: true }; // Idempotent
      throw err;
    }
  });

  // ── 7. POST /link/:featureId — Link an existing Jira issue to a feature ──
  fastify.post('/link/:featureId', {
    preHandler: [requireAdmin, checkConfigured],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        properties: {
          issueKey: { type: 'string' },
          role:     { type: 'string', enum: ['primary', 'child'] }
        },
        required: ['issueKey', 'role']
      }
    }
  }, async (request, reply) => {
    const { featureId } = request.params;
    const { issueKey, role } = request.body;

    // 1. Validate the issue exists in Jira
    let issueData;
    try {
      issueData = await callJiraAPI(`/rest/api/3/issue/${issueKey}?fields=summary,issuetype`);
    } catch (err) {
      if (err.message?.includes('404')) {
        return reply.code(404).send({ error: 'Issue not found in Jira' });
      }
      throw err;
    }

    // 2. If linking as primary epic, fetch its children
    let childKeys = [];
    if (role === 'primary' && issueData.fields?.issuetype?.name === 'Epic') {
      try {
        const jql = encodeURIComponent(`parent = "${issueKey}"`);
        const childData = await callJiraAPI(
          `/rest/api/3/search/jql?jql=${jql}&fields=summary&maxResults=50`
        );
        childKeys = (childData.issues || []).map(i => i.key);
      } catch (err) {
        request.log.warn(err, 'Failed to fetch child tasks for linked epic — continuing without them');
      }
    }

    // 3. Read the current feature
    let feature;
    try {
      const { resource } = await featuresContainer.item(featureId, featureId).read();
      feature = resource;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Feature not found' });
      throw err;
    }

    // 4. Guard: a child key cannot be the same as the current primary
    if (role === 'child' && feature.jira_issue_key === issueKey) {
      return reply.code(400).send({ error: 'Key is already the primary issue' });
    }

    // 5. Build patch ops
    const now = new Date().toISOString();
    const patchOps = [{ op: 'set', path: '/updated_at', value: now }];
    let responseChildKeys;

    if (role === 'primary') {
      patchOps.push({ op: 'set', path: '/jira_issue_key',   value: issueKey });
      patchOps.push({ op: 'set', path: '/jira_child_keys',  value: childKeys });
      responseChildKeys = childKeys;
    } else {
      const existing = Array.isArray(feature.jira_child_keys) ? feature.jira_child_keys : [];
      if (existing.includes(issueKey)) {
        // Already linked — idempotent return, no patch needed
        return { ok: true, issueKey, role, summary: issueData.fields?.summary || '', childKeys: existing };
      }
      const newChildren = [...existing, issueKey];
      patchOps.push({ op: 'set', path: '/jira_child_keys', value: newChildren });
      responseChildKeys = newChildren;
    }

    await featuresContainer.item(featureId, featureId).patch(patchOps);

    // 6. Write revision
    await revisionsContainer.items.create({
      id: uuidv4(),
      feature_id: featureId,
      action: 'updated',
      changes: {
        jira_issue_key: {
          old: feature.jira_issue_key || null,
          new: role === 'primary' ? issueKey : (feature.jira_issue_key || null)
        },
        jira_child_keys: {
          old: feature.jira_child_keys || [],
          new: responseChildKeys
        }
      },
      user_id: request.user?.email || 'admin',
      created_at: now
    });

    return { ok: true, issueKey, role, summary: issueData.fields?.summary || '', childKeys: responseChildKeys };
  });

  // ── 8. DELETE /link/:featureId — Unlink Jira issues from a feature ──────
  fastify.delete('/link/:featureId', {
    preHandler: [requireAdmin]
  }, async (request, reply) => {
    const { featureId } = request.params;
    const { issueKey } = request.query;

    let feature;
    try {
      const { resource } = await featuresContainer.item(featureId, featureId).read();
      feature = resource;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Feature not found' });
      throw err;
    }

    const now = new Date().toISOString();

    // If a specific issueKey is provided, remove only that key
    if (issueKey) {
      const trimmedKey = issueKey.trim();

      // Unlinking the parent epic also removes all child keys (they depend on it)
      if (feature.jira_issue_key === trimmedKey) {
        const patchOps = [
          { op: 'set', path: '/jira_issue_key', value: '' },
          { op: 'set', path: '/jira_child_keys', value: [] },
          { op: 'set', path: '/updated_at', value: now }
        ];
        await featuresContainer.item(featureId, featureId).patch(patchOps);

        await revisionsContainer.items.create({
          id: uuidv4(),
          feature_id: featureId,
          action: 'updated',
          changes: {
            jira_issue_key: { old: feature.jira_issue_key, new: null },
            jira_child_keys: { old: feature.jira_child_keys || [], new: [] }
          },
          user_id: request.user?.email || 'admin',
          created_at: now
        });

        return { ok: true, removed: [trimmedKey, ...(feature.jira_child_keys || [])] };
      }

      // Unlink a specific child task
      const childKeys = Array.isArray(feature.jira_child_keys) ? feature.jira_child_keys : [];
      if (childKeys.includes(trimmedKey)) {
        const newChildren = childKeys.filter(k => k !== trimmedKey);
        const patchOps = [
          { op: 'set', path: '/jira_child_keys', value: newChildren },
          { op: 'set', path: '/updated_at', value: now }
        ];
        await featuresContainer.item(featureId, featureId).patch(patchOps);

        await revisionsContainer.items.create({
          id: uuidv4(),
          feature_id: featureId,
          action: 'updated',
          changes: {
            jira_child_keys: { old: childKeys, new: newChildren }
          },
          user_id: request.user?.email || 'admin',
          created_at: now
        });

        return { ok: true, removed: [trimmedKey] };
      }

      return reply.code(400).send({ error: 'Issue key is not linked to this feature' });
    }

    // No specific key — unlink everything
    if (!feature.jira_issue_key && (!feature.jira_child_keys || feature.jira_child_keys.length === 0)) {
      return { ok: true, message: 'No Jira links to remove' };
    }

    const patchOps = [
      { op: 'set', path: '/jira_issue_key', value: '' },
      { op: 'set', path: '/jira_child_keys', value: [] },
      { op: 'set', path: '/updated_at', value: now }
    ];

    await featuresContainer.item(featureId, featureId).patch(patchOps);

    await revisionsContainer.items.create({
      id: uuidv4(),
      feature_id: featureId,
      action: 'updated',
      changes: {
        jira_issue_key: { old: feature.jira_issue_key || null, new: null },
        jira_child_keys: { old: feature.jira_child_keys || [], new: [] }
      },
      user_id: request.user?.email || 'admin',
      created_at: now
    });

    return { ok: true };
  });

}
