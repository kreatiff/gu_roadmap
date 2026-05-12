# AGENTS.md - Antigravity Kit Workspace Guide

> This workspace uses the Antigravity Kit for AI agent orchestration. ALL rules, skills, agents, and workflows live in the `.agent/` directory. Read this file first when starting any session.

---

## Quick Reference

| Need | Location | Key File |
|------|----------|----------|
| **Behavior Rules** | `.agent/rules/` | [`GEMINI.md`](.agent/rules/GEMINI.md) |
| **System Map** | `.agent/` | [`ARCHITECTURE.md`](.agent/ARCHITECTURE.md) |
| **Skills** | `.agent/skills/` | `SKILL.md` in each subfolder |
| **Agents** | `.agent/agents/` | `{agent-name}.md` |
| **Workflows** | `.agent/workflows/` | `{command}.md` |
| **Scripts** | `.agent/scripts/` | `checklist.py`, `verify_all.py`, etc. |
| **Design DB** | `.agent/.shared/ui-ux-pro-max/` | `search.py` + CSV data |

---

## 1. Behavior Rules (MANDATORY)

**Read `.agent/rules/GEMINI.md` FIRST** in every session. It defines:

- **Request Classification** - QUESTION vs SURVEY vs SIMPLE_CODE vs COMPLEX_CODE vs DESIGN/UI
- **Intelligent Agent Routing** - Auto-select agents based on request domain
- **TIER 0: Universal Rules** - Clean code, file dependency awareness, system map read
- **TIER 1: Code Rules** - Project type routing, Socratic Gate, Final Checklist Protocol
- **TIER 2: Design Rules** - Reference agent files for design work
- **Gemini Mode Mapping** - plan/ask/edit modes with associated agents

### Key Mandatory Rules

1. **Agent Routing Checklist** (before every code/design response):
   - Identify correct agent for the domain
   - READ the agent's `.md` file
   - Announce `Applying knowledge of @{agent}...`
   - Load required skills from agent's frontmatter

2. **Socratic Gate** - For complex requests, STOP and ask minimum 3 questions before implementation

3. **Clean Code** - ALL code MUST follow `@[skills/clean-code]` rules

4. **No Code Before Plan** - Planning mode = NO CODE writing (only plan files)

---

## 2. Skills (36 Domain Modules)

Skills are loaded **on-demand** when a request matches their description. Read `SKILL.md` in the skill folder first, then only read referenced files relevant to the request.

### Skill Loading Protocol
```
User Request -> Skill Description Match -> Load SKILL.md -> Read references/ -> Read scripts/
```

### Key Skills by Category

| Category | Skills |
|----------|--------|
| **Frontend** | `frontend-design`, `nextjs-react-expert`, `tailwind-patterns`, `web-design-guidelines` |
| **Backend** | `api-patterns`, `nodejs-best-practices`, `python-patterns`, `server-management` |
| **Database** | `database-design` |
| **Testing** | `testing-patterns`, `tdd-workflow`, `webapp-testing` |
| **Security** | `vulnerability-scanner`, `red-team-tactics` |
| **DevOps** | `deployment-procedures`, `performance-profiling` |
| **Code Quality** | `clean-code` (CRITICAL priority), `code-review-checklist`, `lint-and-validate` |
| **Planning** | `brainstorming`, `plan-writing`, `architecture`, `app-builder` |
| **Mobile** | `mobile-design` |
| **Game Dev** | `game-development` |
| **Other** | `mcp-builder`, `i18n-localization`, `seo-fundamentals`, `geo-fundamentals`, `documentation-templates`, `bash-linux`, `powershell-windows`, `behavioral-modes`, `parallel-agents`, `intelligent-routing`, `rust-pro` |

### Skill Scripts

Many skills have `scripts/` folders with Python validation scripts. These are orchestrated by:
- `.agent/scripts/checklist.py` - Priority-based core checks
- `.agent/scripts/verify_all.py` - Full verification suite

---

## 3. Agents (20 Specialist Personas)

Agents define **who you should be** for different tasks. Each agent file contains:
- Frontmatter with `skills:` list (which skills to load)
- Philosophy and mindset
- Decision frameworks
- Anti-patterns to avoid
- Review checklists

### Agent Selection Matrix

| Task Domain | Primary Agent | Skills Used |
|-------------|---------------|-------------|
| **Multi-agent Coordination** | `orchestrator` | parallel-agents, behavioral-modes, plan-writing |
| **Web UI/UX** | `frontend-specialist` | clean-code, nextjs-react-expert, tailwind-patterns, frontend-design |
| **Backend/API** | `backend-specialist` | clean-code, nodejs-best-practices, api-patterns, database-design |
| **Database** | `database-architect` | clean-code, database-design |
| **Mobile** | `mobile-developer` | clean-code, mobile-design |
| **Testing** | `test-engineer` | clean-code, testing-patterns, tdd-workflow |
| **Security Audit** | `security-auditor` | clean-code, vulnerability-scanner, red-team-tactics |
| **Security Pentest** | `penetration-tester` | clean-code, vulnerability-scanner, red-team-tactics |
| **DevOps/Deploy** | `devops-engineer` | clean-code, deployment-procedures, server-management |
| **Performance** | `performance-optimizer` | clean-code, performance-profiling |
| **SEO** | `seo-specialist` | clean-code, seo-fundamentals, geo-fundamentals |
| **Debug** | `debugger` | clean-code, systematic-debugging |
| **Code Discovery** | `explorer-agent` | clean-code, architecture, plan-writing |
| **Legacy Code** | `code-archaeologist` | clean-code, code-review-checklist |
| **Documentation** | `documentation-writer` | clean-code, documentation-templates |
| **Game Dev** | `game-developer` | clean-code, game-development + sub-skills |
| **Planning** | `project-planner` | clean-code, app-builder, plan-writing, brainstorming |
| **Product** | `product-manager`, `product-owner` | plan-writing, brainstorming |
| **QA Automation** | `qa-automation-engineer` | webapp-testing, testing-patterns |

### Agent Boundaries (CRITICAL)

Each agent MUST stay within their domain:
- `frontend-specialist` does NOT write tests or API routes
- `backend-specialist` does NOT write UI components
- `test-engineer` does NOT write production code
- `mobile-developer` handles mobile FULL-STACK (not frontend-specialist)
- `documentation-writer` ONLY invoked when user explicitly requests docs

---

## 4. Workflows (11 Slash Commands)

Workflows are procedure definitions for `/command` invocations:

| Command | Agent | Purpose |
|---------|-------|---------|
| `/brainstorm` | - | Structured idea exploration (3+ options) |
| `/create` | app-builder | Create new application from scratch |
| `/debug` | debugger | Systematic problem investigation |
| `/deploy` | devops-engineer | Production deployment with pre-flight checks |
| `/enhance` | - | Add/update features in existing app |
| `/orchestrate` | orchestrator | Multi-agent coordination (min 3 agents) |
| `/plan` | project-planner | Create plan file (NO CODE!) |
| `/preview` | - | Start/stop/check preview server |
| `/status` | - | Show project and agent status |
| `/test` | test-engineer | Test generation and execution |
| `/ui-ux-pro-max` | frontend-specialist | AI-powered design system generation |

---

## 5. Scripts (Master Validation)

### Master Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `checklist.py` | Priority-based core checks | `python .agent/scripts/checklist.py .` |
| `verify_all.py` | Full verification suite | `python .agent/scripts/verify_all.py . --url <URL>` |
| `auto_preview.py` | Preview server management | `python .agent/scripts/auto_preview.py start|stop|status` |
| `session_manager.py` | Project state detection | `python .agent/scripts/session_manager.py status` |

### Priority Order for Validation
1. Security Scan (P0)
2. Lint & Type Check (P1)
3. Schema Validation (P2)
4. Test Suite (P3)
5. UX Audit (P4)
6. SEO Check (P5)
7. Lighthouse + E2E (P6) - requires URL

### Skill-Level Scripts

Individual skills have their own scripts in `.agent/skills/<skill>/scripts/`:
- `security_scan.py` (vulnerability-scanner)
- `ux_audit.py`, `accessibility_checker.py` (frontend-design)
- `lint_runner.py`, `type_coverage.py` (lint-and-validate)
- `test_runner.py` (testing-patterns)
- `schema_validator.py` (database-design)
- `seo_checker.py`, `geo_checker.py` (seo/geo-fundamentals)
- `lighthouse_audit.py`, `bundle_analyzer.py` (performance-profiling)
- `playwright_runner.py` (webapp-testing)
- `mobile_audit.py` (mobile-design)
- `i18n_checker.py` (i18n-localization)

---

## 6. ui-ux-pro-max Design Database

A comprehensive design intelligence system with searchable CSV databases:

| Domain | File | Use For |
|--------|------|---------|
| Products | `products.csv` | Product type recommendations |
| Styles | `styles.csv` | UI styles and effects |
| Typography | `typography.csv` | Font pairings |
| Colors | `colors.csv` | Color palettes |
| Landing | `landing.csv` | Page structures |
| Charts | `charts.csv` | Chart types |
| UX | `ux-guidelines.csv` | Best practices |
| Stacks | `stacks/*.csv` | Framework-specific guidelines |

### Usage
```bash
# Generate complete design system
python .agent/.shared/ui-ux-pro-max/scripts/search.py "<query>" --design-system

# Domain-specific search
python .agent/.shared/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>

# Stack-specific search
python .agent/.shared/ui-ux-pro-max/scripts/search.py "<query>" --stack <stack>
```

---

## 7. MCP Configuration

MCP servers are configured in `.agent/mcp_config.json`:
- `context7` - Upstash Context7 for documentation search
- `shadcn` - shadcn/ui component registry

Setup path: `~/.gemini/antigravity/mcp_config.json`

---

## 8. File Dependency Awareness

Before modifying ANY file in this workspace:

1. Check if `CODEBASE.md` exists in project root
2. Identify dependent files
3. Update ALL affected files together
4. Run appropriate validation scripts after changes

---

## 9. Common Anti-Patterns (AVOID)

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Skip reading agent/skill files before coding | Read -> Understand -> Apply -> Code |
| Use generic output instead of agent persona | Apply agent mindset and rules |
| Write code in PLAN mode | PLAN mode = plan files ONLY |
| Use frontend-specialist for mobile | Mobile -> mobile-developer ONLY |
| Use shadcn/ui without asking | ALWAYS ask user's UI preference first |
| Default to purple/violet colors | Purple Ban - ask user or use other colors |
| Skip Socratic Gate for complex requests | Ask 3+ questions first |
| Ignore validation scripts | Run checklist.py after major changes |
| Write tests in production files | Test files belong to test-engineer |
| Skip build verification for mobile | RUN actual build commands before "done" |

---

## 10. Session Startup Checklist

When starting work in this workspace:

- [ ] Read `.agent/rules/GEMINI.md` (always)
- [ ] Read `.agent/ARCHITECTURE.md` if unfamiliar
- [ ] Identify correct agent for the task
- [ ] Read agent's `.md` file
- [ ] Load skills listed in agent's frontmatter
- [ ] Apply Socratic Gate if complex request
- [ ] Create `{task-slug}.md` if in planning mode
- [ ] Run validation scripts after implementation

---

> **Remember:** The `.agent/` folder is the single source of truth for all capabilities. Reference it, don't guess.
