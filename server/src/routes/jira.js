import { requireAdmin } from '../auth.js';
import { config } from '../config.js';
import { featuresContainer, revisionsContainer } from '../db.js';
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
You MUST structure the description field using the following sections in order, using markdown headings (e.g. h3 or h4) and bullet points:
1. **Description**: A clear description of the epic.
2. **Value**: The business and user value this epic delivers.
3. **T-Shirt Size**: Suggested size (S, M, L, XL) with brief justification.
4. **Acceptance Criteria**: Concrete criteria that must be met to mark this epic complete.
5. **Priority (Suggested)**: Suggested priority and why.
6. **Delivery Date**: Suggested timeframe or target release if applicable.
7. **Compliance Label**: Any compliance labels or considerations.
8. **Dependencies**: Any known dependencies or blockers.

You MUST return a valid JSON object only with this exact shape (do NOT wrap the JSON in markdown code blocks like \`\`\`json):
{
  "summary": "Clear, concise title for the Epic",
  "description": "The full Epic content structured with the required sections in markdown format",
  "labels": ["Extract any Compliance Labels or relevant tags here"],
  "priority": "Highest" | "High" | "Medium" | "Low" | "Lowest"
}`;

  const STANDALONE_TASK_SYSTEM_PROMPT = `You are a Jira Technical Lead.
Given the roadmap feature details, generate a single, high-quality standalone Jira Task.
Return a valid JSON object only with this exact shape (do NOT wrap the JSON in markdown code blocks like \`\`\`json):
{
  "summary": "Clear, concise title for the Task",
  "description": "Detailed description of the task requirements and technical steps in plain text or simple markdown",
  "labels": ["array of labels, including category and tags"],
  "priority": "Highest" | "High" | "Medium" | "Low" | "Lowest"
}`;

  const CHILD_TASK_SYSTEM_PROMPT = `You are a Jira Technical Lead.
Given the details of a roadmap feature and the generated Jira Epic summary and description, generate a list of child Tasks required to implement the feature.
Do not generate stories or sub-tasks, only standard Tasks. Provide brief technical descriptions for each task so delivery teams understand the work required.

You MUST return a valid JSON object only with this exact shape (do NOT wrap the JSON in markdown code blocks like \`\`\`json):
{
  "childTasks": [
    {
      "summary": "Clear, technical summary of the task",
      "description": "Technical details and description of what needs to be done"
    }
  ]
}`;

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
          featureId: { type: 'string' },
          jiraType: { type: 'string', enum: ['epic', 'task'] },
          generateChildTasks: { type: 'boolean' }
        },
        required: ['featureId', 'jiraType']
      }
    }
  }, async (request, reply) => {
    const { featureId, jiraType, generateChildTasks } = request.body;

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
          const taskPrompt = `Feature Details:\n${featureText}\n\nGenerated Epic Summary: ${epicResult.summary}\nGenerated Epic Description: ${epicResult.description}`;
          const taskData = await callAzureOpenAI(CHILD_TASK_SYSTEM_PROMPT, taskPrompt, request);
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

  // ── 2. GET /epics — Fetch Jira Epics ───────────────────────────────────────
  fastify.get('/epics', {
    preHandler: [requireAdmin, checkConfigured]
  }, async (request, reply) => {
    try {
      const jql = encodeURIComponent(`issuetype = Epic AND project = "${config.jira.projectKey}" ORDER BY created DESC`);
      // Jira migrated /search to /search/jql
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

  // Helper: map our priority string to Jira priority ID (best effort, Jira instances vary)
  // Usually: Highest (1), High (2), Medium (3), Low (4), Lowest (5)
  const mapPriority = (priorityName) => {
    const p = priorityName.toLowerCase();
    if (p === 'highest' || p === 'critical') return '1';
    if (p === 'high') return '2';
    if (p === 'medium') return '3';
    if (p === 'low') return '4';
    if (p === 'lowest') return '5';
    return '3'; // default medium
  };

  // Helper: parse inline markdown elements like **bold** into ADF text nodes
  const parseInline = (text) => {
    const parts = [];
    const regex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          text: text.substring(lastIndex, match.index)
        });
      }
      parts.push({
        type: "text",
        text: match[1],
        marks: [{ type: "strong" }]
      });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push({
        type: "text",
        text: text.substring(lastIndex)
      });
    }
    return parts.length > 0 ? parts : [{ type: "text", text }];
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
        // Empty line closes any open list
        closeList();
        continue;
      }

      // Check for Headings: e.g. ### Title
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

      // Check for bullet list items: e.g. - Item, * Item, or • Item
      const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
      if (bulletMatch) {
        if (currentList && currentList.type !== 'bulletList') {
          closeList();
        }
        if (!currentList) {
          currentList = { type: 'bulletList', items: [] };
        }
        currentList.items.push(bulletMatch[1]);
        continue;
      }

      // Check for ordered list items: e.g. 1. Item
      const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (orderedMatch) {
        if (currentList && currentList.type !== 'orderedList') {
          closeList();
        }
        if (!currentList) {
          currentList = { type: 'orderedList', items: [] };
        }
        currentList.items.push(orderedMatch[2]);
        continue;
      }

      // Regular paragraph line
      closeList();
      
      // Merge consecutive text lines into one paragraph block
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
          featureId: { type: 'string' },
          jiraType: { type: 'string', enum: ['epic', 'task'] },
          parentEpicKey: { type: 'string' }, // Optional, if jiraType === 'task'
          epic: {
            type: 'object',
            properties: {
              summary: { type: 'string', maxLength: 500 },
              description: { type: 'string', maxLength: 32000 },
              labels: { type: 'array', maxItems: 50, items: { type: 'string', maxLength: 100 } },
              priority: { type: 'string' }
            },
            required: ['summary']
          },
          childTasks: {
            type: 'array',
            maxItems: 20,
            items: {
              type: 'object',
              properties: {
                summary: { type: 'string', maxLength: 500 },
                description: { type: 'string', maxLength: 32000 }
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
      // 1. Create the main Epic or Task
      const issuePayload = {
        fields: {
          project: { key: config.jira.projectKey },
          summary: epic.summary,
          description: buildADF(epic.description || ''),
          issuetype: { name: jiraType === 'epic' ? 'Epic' : 'Task' },
          priority: { id: mapPriority(epic.priority || 'Medium') },
          labels: epic.labels || []
        }
      };

      // If it's a task and has a parent epic, link it
      if (jiraType === 'task' && parentEpicKey) {
        // In Jira Cloud, the standard way to link a child to an epic is the "parent" field.
        // Some older instances use "customfield_10014" (Epic Link), but "parent" is the modern v3 way.
        issuePayload.fields.parent = { key: parentEpicKey };
      }

      // If it's an Epic, sometimes Jira requires a custom field for "Epic Name". 
      // In newer Jira Cloud, "Summary" is used and Epic Name is deprecated, but just in case, we'll try without it first.
      
      const mainIssueRes = await callJiraAPI('/rest/api/3/issue', {
        method: 'POST',
        body: JSON.stringify(issuePayload)
      });
      
      const mainIssueKey = mainIssueRes.key;
      let createdChildKeys = [];

      // 2. Create child tasks (if epic)
      if (jiraType === 'epic' && Array.isArray(childTasks) && childTasks.length > 0) {
        const bulkPayload = {
          issueUpdates: childTasks.map(task => ({
            fields: {
              project: { key: config.jira.projectKey },
              summary: task.summary,
              description: buildADF(task.description || ''),
              issuetype: { name: 'Task' },
              parent: { key: mainIssueKey }
            }
          }))
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
      const { resource: feature } = await featuresContainer.item(featureId, featureId).read();
      const now = new Date().toISOString();
      
      const patchOps = [
        { op: 'set', path: '/jira_issue_key', value: mainIssueKey },
        { op: 'set', path: '/updated_at', value: now }
      ];

      if (createdChildKeys && createdChildKeys.length > 0) {
        patchOps.push({ op: 'set', path: '/jira_child_keys', value: createdChildKeys });
      } else {
        // If pushing as a single task or no children, clear the child keys field
        patchOps.push({ op: 'set', path: '/jira_child_keys', value: [] });
      }
      
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

      return {
        issueKey: mainIssueKey,
        childKeys: createdChildKeys
      };

    } catch (err) {
      request.log.error(err, 'Error pushing to Jira');
      return reply.code(500).send({ error: 'Failed to push to Jira. Check server logs for details.' });
    }
  });

}
