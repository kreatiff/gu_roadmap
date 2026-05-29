# Plan: Redesign Push-to-Jira Flow (Hybrid Architecture)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing 3-step compact `PushToJiraModal` with a 4-step full-screen wizard (Setup → Generate → Review → Done), add AI-guided generation controls (granularity, extra context, acceptance criteria), and implement draft persistence so admins can save generated Jira tasks for later without pushing.

**Architecture:**
- **Backend:** Extend existing Fastify `/api/jira` routes with granular AI prompting, new `/draft` CRUD endpoints, and a dedicated Cosmos DB `jira_drafts` container (partitioned by `featureId`) for ephemeral draft state. Keep `jira_issue_key` and `jira_child_keys` on the feature document.
- **Frontend:** Rewrite `PushToJiraModal` as a full-screen two-pane takeover with stepper navigation, simulated streaming UI during AI generation, and a master/detail task reviewer.

**Tech Stack:** React 19 + Vite, Fastify 5, Azure Cosmos DB for NoSQL, Azure OpenAI Chat Completions, native `fetch()` to Jira Cloud REST API v3.

---

## Design Fidelity Guideline

**Reuse existing styles and components wherever possible.** The app has its own established design language (CSS custom properties like `--gu-red`, `--bg-primary`, `--border-color`, etc., and shared components like `ConfirmDialog`, `StringAutocomplete`). The supplied design is a reference for **layout and flow**, not a pixel-perfect spec. Priorities:

1. Use the app's existing CSS variables and component patterns.
2. Adopt the design's **structural layout** (full-screen takeover, two-pane, stepper, master/detail).
3. Skip design-specific flourishes that don't fit the app's style (AI orb animation, conic gradients, JetBrains Mono font, sparkle accents on success icon, etc.).
4. Reuse the existing button/input/label/badge styles from other admin pages.

---

## Architectural Decision: Hybrid Storage

**Permanent Jira linkage** (`jira_issue_key`, `jira_child_keys`) stays on the `features` document. This is required for public/admin list views to render the Jira badge without cross-container joins.

**Ephemeral draft state** (`epicData`, `childTasks`, generation config) lives in a new **`jira_drafts`** Cosmos DB container, partitioned by `featureId`. This keeps feature documents lean, prevents non-admin data leakage, and isolates admin-only workflow state.

**Document shape in `jira_drafts`:**
```json
{
  "id": "draft::<featureId>",
  "featureId": "<featureId>",
  "epicData": { "summary": "...", "description": "...", "labels": [], "priority": "High" },
  "childTasks": [{ "summary": "...", "description": "...", "pts": 3, "priority": "Medium", "labels": [] }],
  "config": { "jiraType": "epic", "granularity": "balanced", "extraContext": "...", "acceptanceCriteria": true, "defaultPts": 3 },
  "createdAt": "2026-05-28T...",
  "updatedAt": "2026-05-28T..."
}
```

---

## File Map

| File | Responsibility |
|------|----------------|
| `server/src/db.js` | Add `jiraDraftsContainer` export and `jira_drafts` container bootstrap in `initDb()` |
| `server/src/routes/jira.js` | Extend `/preview` with granularity/extraContext/acceptanceCriteria; add `POST /draft`, `GET /draft/:featureId`, `DELETE /draft/:featureId`; update `/push` schema for `pts`/`priority` on child tasks, priority name→ID mapping, custom field handling, and clear draft on success |
| `server/src/routes/features.js` | Cascade-delete draft when a feature is deleted; strip `jira_draft`/`jira_draft_at` from non-admin responses (if any legacy fields exist) |
| `server/src/config.js` | Add optional `JIRA_STORY_POINTS_FIELD_ID` env var |
| `.env.example` | Add optional `JIRA_STORY_POINTS_FIELD_ID` template |
| `client/src/api/jira.js` | Add `saveJiraDraft(data)`, `fetchJiraDraft(featureId)`, `discardJiraDraft(featureId)` helpers |
| `client/src/components/PushToJiraModal/PushToJiraModal.jsx` | Full rewrite: 4-step full-screen wizard with two-pane layout, draft resume banner, simulated streaming UI, master/detail task reviewer |
| `client/src/components/PushToJiraModal/PushToJiraModal.module.css` | Full rewrite: full-screen takeover layout, two-pane grid, stepper, footer, badge/chip styles |
| `client/src/pages/admin/AdminFeatureFormPage/AdminFeatureFormPage.jsx` | Load `jira_draft`/`jira_draft_at` into form state, show "Draft saved" badge on Push button, wire `onDraftChange` and `onPushSuccess` callbacks |

---

## Pre-Implementation Checklist

Before any code changes, verify the following in the target Jira instance (`griffith.atlassian.net`, project `LTD`):

1. **Story Points custom field ID.** Run: `GET /rest/api/3/field` and find the field whose name is "Story Points" (or "Story point estimate"). Note its `id` (e.g., `customfield_10016`). If it doesn't exist or isn't on the Task/Epic create screen, the story points UI must be hidden/optional.
2. **Priority IDs.** Confirm the numeric priority IDs: `1=Highest`, `2=High`, `3=Medium`, `4=Low`, `5=Lowest`. If they differ, update `mapPriority()`.

---

## Task Breakdown

### Task 1: Bootstrap `jira_drafts` container

**Files:**
- Modify: `server/src/db.js`

- [ ] **Step 1: Add container export and bootstrap**

Add `jiraDraftsContainer` to the exports and create it in `initDb()` with partition key `/featureId`.

```js
// server/src/db.js — add after line 31
export const jiraDraftsContainer = database.container("jira_drafts");

// Inside initDb() — add to Promise.all array
    db.containers.createIfNotExists({
      id: "jira_drafts",
      partitionKey: { paths: ["/featureId"] },
    }),
```

- [ ] **Step 2: Verify server starts cleanly**

Run: `npm run dev` (from root, starts both client and server via `concurrently`).
Expected: Server logs `✅ Cosmos DB "..." ready — all containers initialised.` with no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/db.js
git commit -m "chore(db): add jira_drafts container"
```

---

### Task 2: Extend backend preview endpoint

**Files:**
- Modify: `server/src/routes/jira.js`

- [ ] **Step 1: Update Fastify schema for `/preview` to accept new fields**

Add `granularity`, `extraContext`, and `acceptanceCriteria` to the schema, or add `additionalProperties: true` to allow them without explicit schema properties (safer for forward-compatibility).

```js
// In the /preview schema (lines 128-138)
schema: {
  body: {
    type: 'object',
    properties: {
      featureId: { type: 'string' },
      jiraType: { type: 'string', enum: ['epic', 'task'] },
      generateChildTasks: { type: 'boolean' },
      granularity: { type: 'string', enum: ['high', 'balanced', 'detailed'] },
      extraContext: { type: 'string', maxLength: 2000 },
      acceptanceCriteria: { type: 'boolean' }
    },
    required: ['featureId', 'jiraType']
  }
}
```

- [ ] **Step 2: Update `CHILD_TASK_SYSTEM_PROMPT` to support granularity and acceptance criteria**

Replace the static `CHILD_TASK_SYSTEM_PROMPT` string with a template function that injects the granularity hint and acceptance criteria instruction.

```js
// Replace lines 53-65 with:
function buildChildTaskSystemPrompt(granularity, acceptanceCriteria) {
  const granularityHints = {
    high: 'Generate 3–5 high-level tasks that cover the major work areas.',
    balanced: 'Generate around 7–9 well-balanced tasks that cover the epic thoroughly.',
    detailed: 'Generate 10–15 detailed, granular tasks that break down the work precisely.'
  };
  const hint = granularityHints[granularity] || granularityHints.balanced;
  const acLine = acceptanceCriteria ? '\nFor each task, include a brief set of acceptance criteria.' : '';

  return `You are a Jira Technical Lead.
Given the details of a roadmap feature and the generated Jira Epic summary and description, generate a list of child Tasks required to implement the feature.
Do not generate stories or sub-tasks, only standard Tasks. Provide brief technical descriptions for each task so delivery teams understand the work required.
${hint}${acLine}

You MUST return a valid JSON object only with this exact shape (do NOT wrap the JSON in markdown code blocks like \`\`\`json):
{
  "childTasks": [
    {
      "summary": "Clear, technical summary of the task",
      "description": "Technical details and description of what needs to be done"${acceptanceCriteria ? ',\n      "acceptanceCriteria": "Brief acceptance criteria for this task"' : ''}
    }
  ]
}`;
}
```

- [ ] **Step 3: Update `/preview` handler to use new fields**

Destructuring at line 140 becomes:
```js
const { featureId, jiraType, generateChildTasks, granularity, extraContext, acceptanceCriteria } = request.body;
```

At line 168, replace the static prompt call with:
```js
const taskPrompt = `Feature Details:\n${featureText}\n\nGenerated Epic Summary: ${epicResult.summary}\nGenerated Epic Description: ${epicResult.description}${extraContext ? '\n\nAdditional Context:\n' + extraContext : ''}`;
const taskData = await callAzureOpenAI(buildChildTaskSystemPrompt(granularity, acceptanceCriteria), taskPrompt, request);
```

- [ ] **Step 4: Add `priority` mapping helper for names → IDs**

The existing `mapPriority` maps names → IDs. Ensure it handles all cases and add a comment about verifying IDs in the target Jira instance.

```js
// Lines 243-251 — confirm this matches your Jira instance
const mapPriority = (priorityName) => {
  const p = (priorityName || '').toLowerCase();
  if (p === 'highest' || p === 'critical') return '1';
  if (p === 'high') return '2';
  if (p === 'medium') return '3';
  if (p === 'low') return '4';
  if (p === 'lowest') return '5';
  return '3';
};
```

- [ ] **Step 5: Run the server and verify `/preview` still works**

Test manually via the existing UI or curl. The response shape should remain `{ epic: {...}, childTasks: [...] }`.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/jira.js
git commit -m "feat(jira): add granularity, extraContext, acceptanceCriteria to /preview"
```

---

### Task 3: Update `/push` to accept child task metadata

**Files:**
- Modify: `server/src/routes/jira.js`
- Modify: `server/src/config.js`
- Modify: `.env.example`

- [ ] **Step 1: Update Fastify schema for `/push` body**

Expand the `childTasks` item schema to allow `pts`, `priority`, and `labels`.

```js
// In the /push schema (lines 412-422)
childTasks: {
  type: 'array',
  maxItems: 20,
  items: {
    type: 'object',
    properties: {
      summary: { type: 'string', maxLength: 500 },
      description: { type: 'string', maxLength: 32000 },
      pts: { type: 'integer', minimum: 0, maximum: 100 },
      priority: { type: 'string' },
      labels: { type: 'array', items: { type: 'string', maxLength: 100 } }
    }
  }
}
```

- [ ] **Step 2: Pass `pts` and `priority` to Jira bulk create payload**

In the bulk create loop (around lines 496-510), add the optional fields:

```js
const bulkPayload = {
  issueUpdates: childTasks.map(task => {
    const fields = {
      project: { key: config.jira.projectKey },
      summary: task.summary,
      description: buildADF(task.description || ''),
      issuetype: { name: 'Task' },
      parent: { key: mainIssueKey }
    };
    if (reporterAccountId) fields.reporter = { id: reporterAccountId };
    if (task.priority) fields.priority = { id: mapPriority(task.priority) };
    if (Array.isArray(task.labels) && task.labels.length > 0) fields.labels = task.labels;
    // Only include story points if the custom field is known to exist
    if (config.jira.storyPointsFieldId && task.pts != null) {
      fields[config.jira.storyPointsFieldId] = task.pts;
    }
    return { fields };
  })
};
```

- [ ] **Step 3: Add `storyPointsFieldId` to server config (conditional)**

In `server/src/config.js`, add an optional `JIRA_STORY_POINTS_FIELD_ID` env var:

```js
// In the jira config block
storyPointsFieldId: process.env.JIRA_STORY_POINTS_FIELD_ID || null,
```

Add it to `.env.example` as an optional field:
```env
# Optional: Jira custom field ID for Story Points (e.g. customfield_10016)
# JIRA_STORY_POINTS_FIELD_ID=
```

If the env var is not set, the story points field is silently omitted from create payloads.

- [ ] **Step 4: Test `/push` with the new payload shape**

Manually test pushing an epic with child tasks that include `pts` and `priority`. Verify in Jira that priorities are set correctly.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/jira.js server/src/config.js .env.example
git commit -m "feat(jira): accept pts, priority, labels per child task in /push"
```

---

### Task 4: Add draft CRUD endpoints

**Files:**
- Modify: `server/src/routes/jira.js`

- [ ] **Step 1: Import `jiraDraftsContainer`**

Add to the import at line 3:
```js
import { featuresContainer, revisionsContainer, metadataConfigsContainer, jiraDraftsContainer } from '../db.js';
```

- [ ] **Step 2: Add `POST /api/jira/draft`**

```js
fastify.post('/draft', {
  preHandler: [requireAdmin, checkConfigured],
  config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  schema: {
    body: {
      type: 'object',
      properties: {
        featureId: { type: 'string' },
        epicData: { type: 'object' },
        childTasks: { type: 'array' },
        config: { type: 'object' }
      },
      required: ['featureId']
    }
  }
}, async (request, reply) => {
  const { featureId, epicData, childTasks, config: generationConfig } = request.body;
  const now = new Date().toISOString();
  const doc = {
    id: `draft::${featureId}`,
    featureId,
    epicData: epicData || {},
    childTasks: Array.isArray(childTasks) ? childTasks : [],
    config: generationConfig || {},
    createdAt: now,
    updatedAt: now
  };

  try {
    // Upsert — Cosmos DB replace is fine here since we always send the full document
    await jiraDraftsContainer.items.upsert(doc);
    return { ok: true, savedAt: now };
  } catch (err) {
    request.log.error(err, 'Error saving Jira draft');
    return reply.code(500).send({ error: 'Failed to save draft' });
  }
});
```

- [ ] **Step 3: Add `GET /api/jira/draft/:featureId`**

```js
fastify.get('/draft/:featureId', {
  preHandler: [requireAdmin, checkConfigured]
}, async (request, reply) => {
  const { featureId } = request.params;
  try {
    const { resource } = await jiraDraftsContainer.item(`draft::${featureId}`, featureId).read();
    return resource;
  } catch (err) {
    if (err.code === 404) return reply.code(404).send({ error: 'Draft not found' });
    throw err;
  }
});
```

- [ ] **Step 4: Add `DELETE /api/jira/draft/:featureId`**

```js
fastify.delete('/draft/:featureId', {
  preHandler: [requireAdmin, checkConfigured]
}, async (request, reply) => {
  const { featureId } = request.params;
  try {
    await jiraDraftsContainer.item(`draft::${featureId}`, featureId).delete();
    return { ok: true };
  } catch (err) {
    if (err.code === 404) return { ok: true }; // Idempotent delete
    throw err;
  }
});
```

- [ ] **Step 5: Clear draft on successful `/push`**

After the Cosmos feature patch in `/push` (around line 538), add:

```js
// Clear any existing draft for this feature
try {
  await jiraDraftsContainer.item(`draft::${featureId}`, featureId).delete();
} catch (err) {
  if (err.code !== 404) request.log.warn(err, 'Failed to clear draft after push');
}
```

- [ ] **Step 6: Test draft endpoints with curl**

```bash
# Save draft
curl -X POST http://localhost:3000/api/jira/draft \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"featureId":"test-id","epicData":{"summary":"Test"},"childTasks":[],"config":{}}'

# Fetch draft
curl http://localhost:3000/api/jira/draft/test-id -H "Cookie: ..."

# Delete draft
curl -X DELETE http://localhost:3000/api/jira/draft/test-id -H "Cookie: ..."
```

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/jira.js
git commit -m "feat(jira): add draft CRUD endpoints (POST, GET, DELETE)"
```

---

### Task 5: Cascade-delete drafts when a feature is deleted

**Files:**
- Modify: `server/src/routes/features.js`

- [ ] **Step 1: Import `jiraDraftsContainer`**

```js
// Line 1 — add to existing imports
import { featuresContainer, categoriesContainer, stagesContainer, revisionsContainer, votesContainer, jiraDraftsContainer } from '../db.js';
```

- [ ] **Step 2: Add draft deletion to `DELETE /:id`**

In the cascade-delete block (after revisions deletion, around line 654), add:

```js
// Cascade-delete any Jira draft
const { resources: drafts } = await jiraDraftsContainer.items
  .query(
    { query: 'SELECT c.id FROM c WHERE c.featureId = @fid', parameters: [{ name: '@fid', value: id }] },
    { enableCrossPartitionQuery: true }
  )
  .fetchAll();
await Promise.all(drafts.map(async (d) => {
  try {
    await jiraDraftsContainer.item(d.id, id).delete();
  } catch (err) {
    cascadeErrors.push({ type: 'jira_draft', id: d.id, error: err.message });
    request.log.error({ err }, `Failed to cascade-delete Jira draft ${d.id} for feature ${id}`);
  }
}));
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/features.js
git commit -m "feat(features): cascade-delete jira_drafts on feature delete"
```

---

### Task 6: Add frontend API helpers for drafts

**Files:**
- Modify: `client/src/api/jira.js`

- [ ] **Step 1: Add draft methods**

```js
// Add to client/src/api/jira.js
export const saveJiraDraft = (data) => {
  return api('/api/jira/draft', { method: 'POST', body: JSON.stringify(data) });
};

export const fetchJiraDraft = (featureId) => {
  return api(`/api/jira/draft/${featureId}`);
};

export const discardJiraDraft = (featureId) => {
  return api(`/api/jira/draft/${featureId}`, { method: 'DELETE' });
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api/jira.js
git commit -m "feat(api): add jira draft client methods"
```

---

### Task 7: Update AdminFeatureFormPage to load and display draft state

**Files:**
- Modify: `client/src/pages/admin/AdminFeatureFormPage/AdminFeatureFormPage.jsx`

- [ ] **Step 1: Add `fetchJiraDraft` to imports**

```js
import { fetchJiraConfig, fetchJiraDraft } from '../../../api/jira';
```

- [ ] **Step 2: Add `jiraDraft` state**

```js
// Around line 53
const [jiraDraft, setJiraDraft] = useState(null);
```

- [ ] **Step 3: Fetch draft on mount**

In the `Promise.all` at line 124, add:
```js
fetchJiraDraft(id).catch(() => null)
```

Then in the fetch handler (around line 142), add:
```js
if (jiraConf && /^https:\/\//i.test(jiraConf.baseUrl)) {
  setJiraBaseUrl(jiraConf.baseUrl);
}
```

After that, add:
```js
const draftRes = await fetchJiraDraft(id).catch(() => null);
if (draftRes && draftRes.featureId) {
  setJiraDraft(draftRes);
}
```

> Note: This means fetching the draft twice (once in Promise.all, once after). Better: remove `fetchJiraDraft(id)` from the `Promise.all` and only fetch it after `jiraConf`, since it's independent.

- [ ] **Step 4: Add draft indicator to the Push button**

In the Jira card (around line 620), update the button:

```jsx
<button
  type="button"
  className={styles.jiraBtn}
  onClick={() => setShowJiraModal(true)}
>
  <JiraLogo size={20} className={styles.jiraBtnIcon} />
  <span>{formData.jira_issue_key ? 'Push to Jira / Update Issues' : 'Push to Jira'}</span>
  {jiraDraft && <span className={styles.draftBadge}> · Draft saved</span>}
</button>
```

Add `.draftBadge` styling to `AdminFeatureFormPage.module.css` (or reuse an existing muted text style).

- [ ] **Step 5: Wire `onDraftChange` and `onPushSuccess` callbacks to the modal**

Replace the `PushToJiraModal` invocation (lines 296-304) with:

```jsx
<PushToJiraModal
  feature={formData}
  featureId={id}
  jiraBaseUrl={jiraBaseUrl}
  onClose={() => setShowJiraModal(false)}
  onPushSuccess={(key, childKeys) => {
    setFormData(prev => ({ ...prev, jira_issue_key: key, jira_child_keys: Array.isArray(childKeys) ? childKeys : [] }));
    setJiraDraft(null); // Clear local draft state on push
  }}
  onDraftChange={(draft) => {
    setJiraDraft(draft); // null = no draft; object = draft exists
  }}
/>
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/AdminFeatureFormPage/AdminFeatureFormPage.jsx client/src/pages/admin/AdminFeatureFormPage/AdminFeatureFormPage.module.css
git commit -m "feat(admin): load jira draft state, show badge, wire modal callbacks"
```

---

### Task 8: Rewrite PushToJiraModal (full-screen 4-step wizard)

**Files:**
- Rewrite: `client/src/components/PushToJiraModal/PushToJiraModal.jsx`
- Rewrite: `client/src/components/PushToJiraModal/PushToJiraModal.module.css`

This is the largest task. Break it down into sub-tasks internally.

#### State Shape

```js
const [step, setStep] = useState(1); // 1=Setup, 2=Generate, 3=Review, 4=Done
const [jiraType, setJiraType] = useState('epic');
const [granularity, setGranularity] = useState('balanced');
const [defaultPts, setDefaultPts] = useState(3);
const [acceptanceCriteria, setAcceptanceCriteria] = useState(true);
const [extraContext, setExtraContext] = useState('');
const [parentEpicKey, setParentEpicKey] = useState('');
const [availableEpics, setAvailableEpics] = useState([]);

const [epicData, setEpicData] = useState({ summary: '', description: '', labels: [], priority: 'Medium' });
const [childTasks, setChildTasks] = useState([]);
const [selectedTaskIdx, setSelectedTaskIdx] = useState(0);

const [streamedCount, setStreamedCount] = useState(0);
const [streamProgress, setStreamProgress] = useState(0);
const [isLoading, setIsLoading] = useState(false);

const [resultKeys, setResultKeys] = useState({ issueKey: '', childKeys: [] });
const [draftLoaded, setDraftLoaded] = useState(false);
```

#### Mount / Draft Resume Logic

```js
useEffect(() => {
  // On mount, check for an existing draft
  if (featureId) {
    fetchJiraDraft(featureId)
      .then(draft => {
        if (draft && draft.epicData) {
          setDraftLoaded(true);
          // Pre-populate state from draft
          setEpicData(draft.epicData);
          setChildTasks(draft.childTasks || []);
          setJiraType(draft.config?.jiraType || 'epic');
          setGranularity(draft.config?.granularity || 'balanced');
          setExtraContext(draft.config?.extraContext || '');
          setAcceptanceCriteria(draft.config?.acceptanceCriteria ?? true);
          setDefaultPts(draft.config?.defaultPts || 3);
        }
      })
      .catch(() => { /* no draft, start fresh */ });
  }
  document.body.style.overflow = 'hidden';
  return () => { document.body.style.overflow = 'unset'; };
}, [featureId]);
```

#### Step 1 — Setup (two-pane)

- **Left pane:** Feature title card (read-only) → Epic / Task type cards (clickable, styled as cards not radios) → AI Foundry section: toggle switch for "Generate child tasks", granularity segmented control (High / Balanced / Detailed), default story points grid (0,1,2,3,5,8,13), acceptance criteria checkbox, extra context textarea.
- **Right pane:** Feature summary card → "Jira items to be created" tree preview (1 Epic + estimated N Tasks based on granularity) → 3-stat row (estimated tasks, estimated points, cost) → warning notice about AI-generated content.
- **Footer:** Cancel button → **Generate with AI** button (disabled if jiraType=task and no parent epic selected).

#### Step 2 — Generate (two-pane, streaming simulation)

- On entering: call `generateJiraPreview({ featureId, jiraType, generateChildTasks: true, granularity, extraContext, acceptanceCriteria })`.
- While loading: animate `streamProgress` from 0→100 over ~3s (or until API returns, whichever is longer). Use a `useEffect` timer.
- Once API returns: start a `revealTimer` interval that increments `streamedCount` every ~300ms until all tasks are revealed.
- **Left pane:** Progress timeline with 6 milestones (Understanding feature → Planning structure → Drafting epic → Generating tasks → Refining details → Ready for review). Show done/active/pending states.
- **Right pane:** Epic draft card with blinking cursor animation while loading. Once API returns, show epic summary + description. Below, show task cards: revealed tasks show summary + description skeleton; currently streaming task shows shimmer; pending tasks show placeholder.
- **Footer:** "Keep working" tip | Stop & discard (calls `discardJiraDraft(featureId)`, closes modal) | Keep partial (jumps to Step 3 with whatever was revealed).

> **Important:** The "Stop & discard" button is purely cosmetic in terms of the API (the data is already loaded), but it should still call `discardJiraDraft` to clear any previously saved draft.

#### Step 3 — Review (master/detail)

- **Auto-save on entry:** When Step 2 completes and the user lands on Step 3, immediately call `saveJiraDraft({ featureId, epicData, childTasks, config: { jiraType, granularity, extraContext, acceptanceCriteria, defaultPts } })` and notify parent via `onDraftChange`.
- **Left pane (340px):**
  - Epic header with AI-drafted badge, priority badge, label chips.
  - Scrollable task list. Each row: drag handle (visual only, no DnD library needed for MVP), checkbox, task summary, story points pill, priority badge.
  - Clicking a row selects it (`selectedTaskIdx`).
  - "Remove" button per row.
  - "Add task" button: appends a blank task `{ summary: '', description: '', pts: defaultPts, priority: 'Medium', labels: [] }`.
- **Right pane (detail editor):**
  - Summary input
  - Description textarea
  - Meta row: Story points grid (same as Step 1), priority dropdown (Highest→Lowest), assignee placeholder (future), labels chips + add input.
  - Sprint placeholder (future).
  - "AI suggestion" card placeholder (future).
- **Footer:** "N tasks ready · M pts" | ← Back (to Step 1, with confirmation if edits exist) | **Save for later** (calls `saveJiraDraft` with current state, notifies parent, closes modal) | **Push N items to Jira →**

#### Step 4 — Success (two-pane)

- **Left pane:** Success icon (reuse `CheckCircle` from lucide-react, no sparkle accents). Heading: "Pushed to Jira". Receipt card: feature title, project key, epic key link, task count, total points, sync status.
- **Right pane:** Created issues list. Epic card with key, summary, type icon, Open link. Below, each child task card with key, summary, points, Open link.
- **Footer:** "N issues live" | Push another feature (button, but disabled/placeholder since modal is scoped) | Done (closes modal) | **Open epic in Jira ↗**

#### CSS Structure

```css
/* PushToJiraModal.module.css */
.takeover { position: fixed; inset: 0; z-index: 1000; display: flex; flex-direction: column; }
.scrim { position: absolute; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(2px); pointer-events: none; }
.window { position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; background: var(--bg-primary, #fff); }
.topbar { height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; border-bottom: 1px solid var(--border-color); background: #fff; }
.stepper { height: 48px; display: flex; align-items: center; justify-content: center; gap: 8px; border-bottom: 1px solid var(--border-color); background: #fff; }
.content { flex: 1; display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; }
.leftPane { padding: 28px 32px; background: var(--bg-secondary, #fafaf7); border-right: 1px solid var(--border-color); overflow: auto; }
.rightPane { padding: 28px 32px; background: #fff; overflow: auto; }
.footer { height: 60px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; border-top: 1px solid var(--border-color); background: #fff; }

/* Step-specific overrides */
.step2Layout .content { grid-template-columns: 320px 1fr; }
.step3Layout .content { grid-template-columns: 340px 1fr; }
.step4Layout .content { grid-template-columns: 420px 1fr; }
```

- [ ] **Step 1: Write the component skeleton and CSS**
- [ ] **Step 2: Implement Step 1 (Setup)**
- [ ] **Step 3: Implement Step 2 (Generate + streaming simulation)**
- [ ] **Step 4: Implement Step 3 (Review + master/detail)**
- [ ] **Step 5: Implement Step 4 (Success)**
- [ ] **Step 6: Implement draft resume banner**
- [ ] **Step 7: Test full flow end-to-end**
- [ ] **Step 8: Commit**

```bash
git add client/src/components/PushToJiraModal/
git commit -m "feat(jira): rewrite PushToJiraModal as 4-step full-screen wizard"
```

---

### Task 9: Verification

- [ ] **Step 1: Backend checklist**
  - `POST /api/jira/preview` accepts `granularity`, `extraContext`, `acceptanceCriteria` and returns expected shape.
  - `POST /api/jira/push` accepts `pts`, `priority`, `labels` per child task and creates issues correctly.
  - `POST /api/jira/draft` upserts a draft document.
  - `GET /api/jira/draft/:featureId` returns the saved draft.
  - `DELETE /api/jira/draft/:featureId` removes the draft.
  - After successful push, draft is automatically cleared.
  - Deleting a feature cascade-deletes its draft.
  - Non-admin feature list/single endpoints do NOT expose draft data (not applicable since drafts are in separate container, but verify).

- [ ] **Step 2: Frontend checklist**
  - Open feature edit page → click "Push to Jira" → full-screen takeover appears.
  - Step 1: type cards respond to click; granularity segmented control changes; story points grid highlights; Generate button is active.
  - Clicking **Generate with AI** → Step 2 animates: progress bar fills, tasks appear one-by-one.
  - Step 3: clicking a task row loads it in the detail pane; editing summary/description updates state; Remove button removes from list; Add task appends a blank task.
  - **Push N items to Jira** → Step 4: receipt shows correct epic key link; task list shows all created keys with Open links.
  - **Done** / **Open epic in Jira** closes the modal; parent component reflects `jira_issue_key` update and removes draft badge.
  - Closing at any step via ✕ button → `onClose` fires correctly; if on Step 3 with unsaved edits, show a `ConfirmDialog` (reuse existing component) asking "You have unsaved draft changes. Discard them?"
  - **Draft save:** After Step 2 completes, close the modal → reopen → "Resume draft" banner appears → clicking Resume jumps to Step 3 with previously generated content pre-loaded.
  - **Discard draft:** Click "Discard & restart" from the resume banner → modal clears to Step 1; parent button loses the "Draft saved" badge.
  - **Save for later:** In Step 3, click "Save for later" → draft saved, modal closes; "Draft saved" badge appears on the Push button.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "test(jira): verify redesigned push-to-jira flow and draft persistence"
```

---

## Spec Coverage Checklist

| Requirement | Task |
|-------------|------|
| Full-screen takeover modal with two-pane layout | Task 8 |
| 4-step wizard (Setup → Generate → Review → Done) | Task 8 |
| Granularity control (high / balanced / detailed) | Task 2 |
| Extra context textarea | Task 2 |
| Acceptance criteria toggle | Task 2 |
| AI streaming simulation in Step 2 | Task 8 |
| Master/detail task reviewer in Step 3 | Task 8 |
| Story points per task | Task 3 |
| Priority per task | Task 3 |
| Draft persistence (save/resume/discard) | Tasks 1, 4, 6, 7, 8 |
| Draft stored in isolated `jira_drafts` container | Task 1 |
| Draft badge on parent page | Task 7 |
| Auto-clear draft on successful push | Task 4 |
| Cascade-delete draft on feature delete | Task 5 |
| Push button reflects draft state in real time | Tasks 7, 8 |

---

## Post-Implementation Notes

- **Future enhancement:** Add a `jira_drafts` admin page or tab to see all features with saved drafts across the project.
- **Future enhancement:** Implement actual drag-and-drop reordering in Step 3 if task order matters for Jira bulk create (currently it doesn't, since Jira's bulk API preserves the array order but doesn't expose a sort field).
- **Future enhancement:** Add a "Regenerate this task with AI" button in the Step 3 detail pane.
- **Future enhancement:** Add stale draft detection — compare `draft.updatedAt` to `feature.updated_at` and warn the user if the feature was edited after the draft was saved.
