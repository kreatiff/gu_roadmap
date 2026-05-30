# Plan: Link Existing Jira Issues to Features (Amended)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the ability to link an already-existing Jira issue (epic or task) to a roadmap feature without going through the AI generation wizard. Supports both primary epic linking (with auto-fetch of child tasks) and individual child-task linking.

**Architecture:**
- **Backend:** New `POST /api/jira/link/:featureId` endpoint in the existing `jira.js` route file. It validates the issue exists in Jira, fetches child tasks for epics, and updates the feature document via Cosmos DB patch operations.
- **Frontend:** Inline "Link Issue" form added to the existing Jira Integration card on `AdminFeatureFormPage`. Role selector (Primary / Child task), manual key input, and confirmation dialog for replacing an existing primary.

**Tech Stack:** React 19 + Vite, Fastify 5, Azure Cosmos DB for NoSQL, native `fetch()` to Jira Cloud REST API v3.

---

## Files to Change

| File | Change |
|---|---|
| `server/src/routes/jira.js` | Add `POST /link/:featureId` endpoint with `requireAdmin` and `checkConfigured` preHandlers |
| `client/src/api/jira.js` | Add `linkJiraIssue` helper |
| `client/src/pages/admin/AdminFeatureFormPage/AdminFeatureFormPage.jsx` | Add link UI state, handlers, ConfirmDialog wiring, inline form |
| `client/src/pages/admin/AdminFeatureFormPage/AdminFeatureFormPage.module.css` | Add input/toggle/button styles for the link form |

---

## Server: `POST /api/jira/link/:featureId`

Place alongside the existing `DELETE /link/:featureId` in `server/src/routes/jira.js`.

**Pre-handlers:** `[requireAdmin, checkConfigured]` (both required — without `checkConfigured` the Jira API client is uninitialised and will crash).

**Body schema:**
```js
{
  type: 'object',
  properties: {
    issueKey: { type: 'string' },
    role:     { type: 'string', enum: ['primary', 'child'] }
  },
  required: ['issueKey', 'role']
}
```

**Handler logic:**

1. **Validate the issue exists in Jira:**
   ```js
   const issueData = await callJiraAPI(`/rest/api/3/issue/${issueKey}?fields=summary,issuetype`);
   ```
   If Jira returns 404 → reply 404 with `{ error: 'Issue not found in Jira' }`.

2. **Fetch children if `role === 'primary'` and issue type is `Epic`:**
   ```js
   const jql = encodeURIComponent(`parent = "${issueKey}"`);
   const childData = await callJiraAPI(`/rest/api/3/search/jql?jql=${jql}&fields=summary&maxResults=50`);
   const childKeys = childData.issues?.map(i => i.key) || [];
   ```
   For non-epic primaries (standalone Task), `childKeys = []`.

3. **Read the current feature from `featuresContainer`:**
   ```js
   const { resource: feature } = await featuresContainer.item(featureId, featureId).read();
   ```
   If 404 → reply 404 with `{ error: 'Feature not found' }`.

4. **Guard: child key cannot already be the primary:**
   ```js
   if (role === 'child' && feature.jira_issue_key === issueKey) {
     return reply.code(400).send({ error: 'Key is already the primary issue' });
   }
   ```

5. **Build patch ops and apply:**
   ```js
   const now = new Date().toISOString();
   let patchOps = [{ op: 'set', path: '/updated_at', value: now }];
   let responseChildKeys = childKeys;

   if (role === 'primary') {
     patchOps.push({ op: 'set', path: '/jira_issue_key', value: issueKey });
     patchOps.push({ op: 'set', path: '/jira_child_keys', value: childKeys });
   } else {
     // Child role — deduplicate against existing children
     const existing = Array.isArray(feature.jira_child_keys) ? feature.jira_child_keys : [];
     if (existing.includes(issueKey)) {
       // Already linked — return current state, no patch needed
       return { ok: true, issueKey, role, summary: issueData.fields.summary, childKeys: existing };
     }
     const newChildren = [...existing, issueKey];
     patchOps.push({ op: 'set', path: '/jira_child_keys', value: newChildren });
     responseChildKeys = newChildren;
   }

   await featuresContainer.item(featureId, featureId).patch(patchOps);
   ```

6. **Write revision:**
   ```js
   await revisionsContainer.items.create({
     id: uuidv4(),
     feature_id: featureId,
     action: 'updated',
     changes: {
       jira_issue_key: { old: feature.jira_issue_key || null, new: role === 'primary' ? issueKey : feature.jira_issue_key },
       jira_child_keys: { old: feature.jira_child_keys || [], new: responseChildKeys }
     },
     user_id: request.user?.email || 'admin',
     created_at: now
   });
   ```

7. **Return:**
   ```js
   return { ok: true, issueKey, role, summary: issueData.fields.summary, childKeys: responseChildKeys };
   ```

---

## Client API: `client/src/api/jira.js`

```js
export const linkJiraIssue = (featureId, data) =>
  api(`/api/jira/link/${featureId}`, { method: 'POST', body: JSON.stringify(data) });
```

---

## AdminFeatureFormPage — State additions

```js
// Add to existing useState declarations
const [linkInput,  setLinkInput]  = useState('');
const [linkRole,   setLinkRole]   = useState(formData.jira_issue_key ? 'child' : 'primary');
const [isLinking,  setIsLinking]  = useState(false);
```

> **Note:** `linkRole` defaults to `'primary'` when no primary exists yet; otherwise `'child'`.

---

## AdminFeatureFormPage — Handler

```js
const handleLinkIssue = async () => {
  const key = linkInput.trim().toUpperCase();
  if (!key) return;

  // If replacing an existing primary, require confirmation first
  if (linkRole === 'primary' && formData.jira_issue_key) {
    setConfirmDialog({ isOpen: true, type: 'replacePrimary', payload: key });
    return;
  }
  await executeLinkIssue(key, linkRole);
};

const executeLinkIssue = async (key, role) => {
  setIsLinking(true);
  try {
    const res = await linkJiraIssue(id, { issueKey: key, role });

    if (role === 'primary') {
      setFormData(prev => ({
        ...prev,
        jira_issue_key: res.issueKey,
        jira_child_keys: res.childKeys || []
      }));
    } else {
      // Child role — replace with the authoritative array from the server
      setFormData(prev => ({
        ...prev,
        jira_child_keys: res.childKeys || []
      }));
    }

    setLinkInput('');
    addToast(
      `Linked ${res.issueKey}${res.childKeys?.length ? ` and ${res.childKeys.length} child task(s)` : ''}`,
      'success'
    );
  } catch (err) {
    addToast(err?.error || 'Could not link issue. Check the key and try again.', 'error');
  } finally {
    setIsLinking(false);
  }
};
```

---

## AdminFeatureFormPage — ConfirmDialog wiring

Add to the existing `ConfirmDialog` render block in JSX:

```jsx
{confirmDialog.isOpen && confirmDialog.type === 'replacePrimary' && (
  <ConfirmDialog
    title="Replace primary issue?"
    message={`This will replace ${formData.jira_issue_key} as the primary and re-link its child tasks. The existing link data will be overwritten.`}
    confirmText="Replace"
    onConfirm={() => {
      setConfirmDialog({ isOpen: false, type: null, payload: null });
      executeLinkIssue(confirmDialog.payload, 'primary');
    }}
    onCancel={() => setConfirmDialog({ isOpen: false, type: null, payload: null })}
  />
)}
```

> **Note:** `setConfirmDialog` clears `type` and `payload` to match the cleanup pattern used by other dialogs in the same file.

Import `linkJiraIssue`:
```js
import { fetchJiraConfig, fetchJiraDraft, unlinkJiraFeature, linkJiraIssue } from '../../../api/jira';
```

---

## AdminFeatureFormPage — JSX (Link Issue UI)

Add below the `<ul className={styles.jiraList}>` block, before the Push button `<div style={{ marginTop: '12px' }}>`:

```jsx
<div className={styles.linkIssueForm}>
  <input
    className={styles.linkIssueInput}
    value={linkInput}
    onChange={e => setLinkInput(e.target.value.toUpperCase())}
    onKeyDown={e => e.key === 'Enter' && handleLinkIssue()}
    placeholder="e.g. LTD-42"
    disabled={isLinking}
    maxLength={20}
  />
  <div className={styles.roleToggle}>
    <button
      className={`${styles.roleBtn}${linkRole === 'primary' ? ' ' + styles.active : ''}`}
      onClick={() => setLinkRole('primary')}
      type="button"
    >Primary</button>
    <button
      className={`${styles.roleBtn}${linkRole === 'child' ? ' ' + styles.active : ''}`}
      onClick={() => setLinkRole('child')}
      type="button"
    >Child task</button>
  </div>
  <button
    type="button"
    className={styles.linkIssueBtn}
    onClick={handleLinkIssue}
    disabled={isLinking || !linkInput.trim()}
  >
    {isLinking ? 'Linking…' : 'Link'}
  </button>
</div>
```

---

## CSS additions (`AdminFeatureFormPage.module.css`)

```css
.linkIssueForm {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.linkIssueInput {
  height: 32px;
  padding: 0 10px;
  font-size: 0.8125rem;
  font-family: monospace;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: #fff;
  color: var(--text-primary);
  outline: none;
  width: 110px;
  flex-shrink: 0;
  text-transform: uppercase;
}

.linkIssueInput:focus {
  border-color: var(--gu-red);
  box-shadow: 0 0 0 3px rgba(229,62,62,0.1);
}

.roleToggle {
  display: flex;
  background: var(--bg-base);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
  flex-shrink: 0;
}

.roleBtn {
  height: 26px;
  padding: 0 9px;
  font-size: 0.6875rem;
  font-weight: 600;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.1s, color 0.1s;
}

.roleBtn.active {
  background: white;
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

.linkIssueBtn {
  height: 32px;
  padding: 0 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: #fff;
  color: var(--text-primary);
  cursor: pointer;
  flex-shrink: 0;
  font-family: inherit;
  transition: background 0.12s;
}

.linkIssueBtn:hover:not(:disabled) { background: var(--bg-base); }
.linkIssueBtn:disabled { opacity: 0.5; cursor: not-allowed; }
```

---

## Task Breakdown

### Task 1: Add backend `POST /api/jira/link/:featureId`

**Files:**
- Modify: `server/src/routes/jira.js`

- [ ] **Step 1: Add `POST /link/:featureId` with pre-handlers and schema**

```js
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
  // ... handler body from plan above
});
```

- [ ] **Step 2: Test manually with curl**

```bash
curl -X POST http://localhost:3000/api/jira/link/<feature-id> \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"issueKey":"LTD-42","role":"primary"}'
```

Verify: returns `{ ok: true, issueKey, role, summary, childKeys }`.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/jira.js
git commit -m "feat(jira): add POST /link/:featureId to link existing issues"
```

---

### Task 2: Add frontend API helper

**Files:**
- Modify: `client/src/api/jira.js`

- [ ] **Step 1: Add `linkJiraIssue`**

```js
export const linkJiraIssue = (featureId, data) =>
  api(`/api/jira/link/${featureId}`, { method: 'POST', body: JSON.stringify(data) });
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api/jira.js
git commit -m "feat(api): add linkJiraIssue client helper"
```

---

### Task 3: Add link UI to AdminFeatureFormPage

**Files:**
- Modify: `client/src/pages/admin/AdminFeatureFormPage/AdminFeatureFormPage.jsx`
- Modify: `client/src/pages/admin/AdminFeatureFormPage/AdminFeatureFormPage.module.css`

- [ ] **Step 1: Import `linkJiraIssue`**

```js
import { fetchJiraConfig, fetchJiraDraft, unlinkJiraFeature, linkJiraIssue } from '../../../api/jira';
```

- [ ] **Step 2: Add state variables**

```js
const [linkInput,  setLinkInput]  = useState('');
const [linkRole,   setLinkRole]   = useState(formData.jira_issue_key ? 'child' : 'primary');
const [isLinking,  setIsLinking]  = useState(false);
```

- [ ] **Step 3: Add handlers**

Paste the `handleLinkIssue` and `executeLinkIssue` implementations from the plan above.

- [ ] **Step 4: Add `replacePrimary` ConfirmDialog**

Paste the JSX block from the plan above, placed after the existing `discard` dialog and before `otherEditor`.

- [ ] **Step 5: Add link form JSX**

Paste the `.linkIssueForm` block from the plan above, placed inside the `jiraSection` div, below the `jiraList` block.

- [ ] **Step 6: Add CSS styles**

Paste the `.linkIssueForm`, `.linkIssueInput`, `.roleToggle`, `.roleBtn`, and `.linkIssueBtn` blocks from the plan above into the CSS module.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/AdminFeatureFormPage/
git commit -m "feat(admin): add link existing Jira issue UI to feature form"
```

---

### Task 4: Verification

- [ ] **Test 1 — Link a primary epic**
  - Type a valid epic key (e.g., `LTD-42`) → select Primary → click Link.
  - Expected: epic appears in linked list, child tasks auto-fetched and shown.

- [ ] **Test 2 — Link a child task**
  - Type a valid task key → select Child task → click Link.
  - Expected: task appended to child list, no duplicate if already present.

- [ ] **Test 3 — Replace primary confirmation**
  - With an existing primary, select Primary role → click Link.
  - Expected: ConfirmDialog appears → confirm → primary replaced, children updated.

- [ ] **Test 4 — Invalid key**
  - Type `LTD-99999` → click Link.
  - Expected: toast "Could not link issue. Check the key and try again."

- [ ] **Test 5 — Duplicate child**
  - Link the same child key twice.
  - Expected: no duplicate row in UI; toast says "Linked" but state is unchanged.

- [ ] **Test 6 — Enter key submits**
  - Type a key, press Enter.
  - Expected: same behaviour as clicking Link.

- [ ] **Test 7 — Unlink regression**
  - Unlink a linked issue via the existing per-row unlink buttons.
  - Expected: no regression; issue removed from list.

- [ ] **Commit**

```bash
git commit -m "test(jira): verify link existing issue flow"
```

---

## Amended Issues vs Original Plan

| Issue | Original | Amended |
|-------|----------|---------|
| `setJiraIssueSummaries` undeclared | Used but never declared in state | **Removed** — not needed for MVP |
| Frontend/backend dedup mismatch | Frontend always appended; backend silently skipped duplicates | Backend returns **authoritative `childKeys` array**; frontend **replaces** local state |
| `linkRole` default | Hardcoded `'child'` | Derived from `formData.jira_issue_key` |
| Missing auth/config | No `preHandler` shown | Explicitly includes `[requireAdmin, checkConfigured]` |
| Stale confirmDialog state | `{ isOpen: false }` without clearing `type`/`payload` | Matches existing pattern: `{ isOpen: false, type: null, payload: null }` |

---

## Post-Implementation Notes

- **Future:** Add a "Search Jira" autocomplete to the link input (fetch matching issues from Jira API as the user types).
- **Future:** Allow linking multiple children at once (comma-separated keys).
- **Future:** Show the Jira issue summary inline next to the linked key (requires caching or fetching summaries on mount).
