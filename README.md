# PipelineHealer

> AI-powered CI/CD pipeline management platform. When your pipelines fail, Claude AI analyzes the error, generates a fix, and — with your approval — commits it directly to your repository.

---

## Table of Contents

1. [Overview](#overview)
2. [Feature List](#feature-list)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Database Schema](#database-schema)
6. [Project Structure](#project-structure)
7. [Setup & Installation](#setup--installation)
8. [User Manual](#user-manual)
   - [Authentication](#authentication)
   - [Dashboard](#dashboard)
   - [Pipelines](#pipelines)
   - [Healing Events](#healing-events)
   - [Integrations & Credentials](#integrations--credentials)
   - [Flaky Test Tracker](#flaky-test-tracker)
   - [Failure Patterns](#failure-patterns)
   - [Secret Scanner](#secret-scanner)
   - [Performance Optimizer](#performance-optimizer)
   - [Environment Audit](#environment-audit)
   - [SLA Monitoring](#sla-monitoring)
   - [Rollback Manager](#rollback-manager)
   - [Pipeline Templates](#pipeline-templates)
   - [Health Reports](#health-reports)
   - [Notifications](#notifications)
   - [AI Chat Assistant](#ai-chat-assistant)
   - [Organizations](#organizations)
   - [Settings](#settings)
   - [Admin Panel](#admin-panel)
9. [API Reference](#api-reference)
10. [Security Model](#security-model)
11. [Deployment](#deployment)
12. [Environment Variables](#environment-variables)

---

## Overview

PipelineHealer connects to your GitHub or GitLab repositories via webhooks. Every time a workflow or pipeline fails, it:

1. Receives the failure event
2. Fetches the failed job's log output
3. Sends the error excerpt to **Claude AI** for analysis
4. Creates a **Healing Event** — a proposed code fix with explanation
5. Lets you **review and approve** the fix (or auto-applies it in auto mode)
6. **Commits the fix** to your repository via the GitHub/GitLab API

Beyond auto-healing, the platform provides a full suite of DevOps intelligence tools: flaky test tracking, secret scanning, performance optimization, SLA monitoring, environment auditing, rollback management, and team collaboration.

---

## Feature List

| Feature | Description |
|---------|-------------|
| **AI Auto-Healing** | Claude Sonnet analyzes pipeline failures and proposes code fixes |
| **Healing Approval Workflow** | Manual review or fully automatic fix application |
| **PR Comment Bot** | Posts fix summaries as comments on the originating pull request |
| **Flaky Test Detection** | Tracks test pass/fail ratios and surfaces unreliable tests |
| **Failure Pattern Recognition** | Deduplicates recurring errors across repos with AI insights |
| **Secret Scanner** | Detects exposed credentials, API keys, and hardcoded secrets in workflows |
| **Performance Optimizer** | Suggests parallelism, caching, matrix strategies, and runner upgrades |
| **Environment Audit** | Validates environment variables referenced in workflow files |
| **SLA Monitoring** | Defines rules for max duration, failure rate, and success percentage |
| **Rollback Manager** | Reverts commits or re-runs last successful pipeline via GitHub API |
| **Pipeline Templates** | Browse, filter, and copy YAML templates for GitHub/GitLab pipelines |
| **Health Reports** | Daily/weekly/monthly summaries with AI-generated narrative |
| **Notifications** | Alerts to Slack, Teams, Discord, and Email channels |
| **AI Chat Assistant** | Conversational assistant for CI/CD questions and pipeline advice |
| **Organizations** | Multi-user team support with owner/admin/member/viewer roles |
| **Admin Panel** | System-wide usage, user management, and suspension controls |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│                    (Next.js React App)                       │
└─────────────────────────┬────────────────────────────────────┘
                          │ HTTP (fetch to own API routes)
                          │
┌─────────────────────────▼────────────────────────────────────┐
│                   Next.js API Routes                         │
│              (Server-side, /app/api/...)                     │
│                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │  Auth/Profile│  │   Webhooks   │  │  Feature APIs    │  │
│   │  /api/profile│  │ /api/webhooks│  │  /api/healing    │  │
│   │  /api/account│  │ /github      │  │  /api/flaky      │  │
│   │  /api/auth/  │  │ /gitlab      │  │  /api/scanner    │  │
│   │   signout    │  └──────┬───────┘  │  /api/optimize   │  │
│   └──────────────┘         │          │  /api/reports    │  │
│                             │          │  /api/rollback   │  │
└─────────────────────────────┼──────────┴──────────────────┘──┘
                              │                    │
              ┌───────────────▼────┐    ┌──────────▼──────────┐
              │  Healing           │    │   Supabase          │
              │  Orchestrator      │    │   (PostgreSQL)      │
              │                    │    │                     │
              │  1. Fetch log      │    │  - profiles         │
              │  2. Extract errors │    │  - pipelines        │
              │  3. Call Claude    │    │  - pipeline_runs    │
              │  4. Save event     │    │  - healing_events   │
              │  5. Notify         │    │  - + 14 more tables │
              └───────┬────────────┘    └─────────────────────┘
                      │
              ┌───────▼────────────┐
              │   Anthropic API    │
              │                   │
              │  Claude Sonnet 4.6 │  ← Healing analysis
              │  Claude Haiku 4.5  │  ← Chat + reports
              └───────────────────┘
                      │
              ┌───────▼────────────┐
              │  GitHub / GitLab   │
              │       API          │
              │                   │
              │  - Fetch logs      │
              │  - Commit fixes    │
              │  - Post PR comments│
              │  - Rollback commits│
              └───────────────────┘
```

### Request Flow — Pipeline Failure to Fix

```
GitHub/GitLab
    │
    │  workflow_run / pipeline event (HMAC verified)
    ▼
POST /api/webhooks/github
    │
    ├─ Signature verification (HMAC-SHA256)
    ├─ Parse event (provider, repo, run_id, job_id, branch, commit_sha)
    ├─ Upsert pipeline_run record
    │
    └─ [if status == failed] ──► Healing Orchestrator
                                      │
                                      ├─ Check token budget
                                      ├─ Fetch job logs (GitHub API)
                                      ├─ Extract last 100 meaningful lines
                                      ├─ Fetch workflow YAML context
                                      ├─ Call Claude Sonnet 4.6
                                      │      Returns: reason, solution,
                                      │      file_path, original_code,
                                      │      fixed_code, confidence
                                      │
                                      ├─ Create healing_event (pending_review)
                                      ├─ Post PR comment (if GitHub PR)
                                      └─ [auto mode] ──► Commit fix to repo
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15.1 (App Router, React 19) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 3.4 + shadcn/ui (Radix UI) |
| **Database** | Supabase (PostgreSQL) with Row Level Security |
| **Auth** | Supabase Auth (email/password) |
| **AI** | Anthropic SDK — Claude Sonnet 4.6 (healing), Claude Haiku 4.5 (chat/reports) |
| **Encryption** | Node.js `crypto` — AES-256-GCM |
| **Webhooks** | HMAC-SHA256 signature verification |
| **Validation** | Zod |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Realtime** | Supabase Realtime subscriptions |
| **Deployment** | Vercel (recommended) |

---

## Database Schema

### Core Tables (Migration 0001)

```
profiles               — User accounts
  id, email, full_name, role (user|admin), is_suspended
  approval_mode (manual|auto), token_budget, tokens_used

integrations           — GitHub / GitLab connections
  id, user_id, provider (github|gitlab), provider_user
  encrypted_token, token_iv, token_tag, webhook_secret, is_active

pipelines              — Monitored repositories
  id, user_id, integration_id, provider, repo_full_name
  pipeline_name, default_branch, is_monitored, last_status

pipeline_runs          — Individual workflow/pipeline executions
  id, pipeline_id, provider_run_id, commit_sha, branch
  status (queued|running|success|failed|cancelled)
  duration_seconds, started_at, completed_at

pipeline_jobs          — Jobs within a run
  id, run_id, job_name, status, error_excerpt
  runner_name, duration_seconds, log_url

healing_events         — AI-proposed fixes
  id, pipeline_id, run_id, job_id
  error_excerpt, ai_reason, ai_solution
  ai_file_path, ai_original_code, ai_fixed_code
  ai_tokens_used, ai_model
  status (pending_review|approved|rejected|applying|applied|apply_failed)
  approval_mode, approved_by, approved_at, applied_at

chat_sessions          — Conversation threads
chat_messages          — Individual messages (user/assistant)
token_usage_log        — Per-feature token consumption tracking
```

### Extended Feature Tables (Migration 0004)

```
notification_channels  — Slack / Teams / Discord / Email configs
flaky_tests            — Test reliability tracking with flakiness_score
performance_suggestions — AI optimization recommendations
secret_scan_results    — Security findings with severity + evidence
failure_patterns       — Cross-repo error deduplication
sla_rules              — SLA threshold definitions
sla_violations         — SLA breach events
pipeline_templates     — YAML template library
env_var_audits         — Environment variable validation findings
organizations          — Team/org entities
org_members            — Org membership with roles
health_reports         — Periodic analytics summaries
rollback_events        — Commit rollback history
```

All tables have **Row Level Security** — users only see their own data. Admin users bypass RLS via service role checks.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              ← Protected layout (auth check)
│   │   ├── dashboard/page.tsx      ← Home dashboard
│   │   ├── pipelines/
│   │   │   ├── page.tsx            ← Pipeline list
│   │   │   └── [id]/page.tsx       ← Pipeline details + run history
│   │   ├── healing/
│   │   │   ├── page.tsx            ← Healing events list
│   │   │   └── [id]/page.tsx       ← Healing event detail + approve
│   │   ├── integrations/
│   │   │   ├── page.tsx            ← Connected accounts list
│   │   │   └── new/page.tsx        ← Add GitHub/GitLab account
│   │   ├── flaky/page.tsx          ← Flaky test tracker
│   │   ├── patterns/page.tsx       ← Failure pattern explorer
│   │   ├── scanner/page.tsx        ← Secret scanner results
│   │   ├── optimize/page.tsx       ← Performance suggestions
│   │   ├── env-audit/page.tsx      ← Environment variable audit
│   │   ├── sla/page.tsx            ← SLA rules + violations
│   │   ├── rollback/page.tsx       ← Rollback manager
│   │   ├── templates/page.tsx      ← Template marketplace
│   │   ├── reports/page.tsx        ← Health reports
│   │   ├── notifications/page.tsx  ← Notification channels
│   │   ├── chat/page.tsx           ← AI chat assistant
│   │   ├── orgs/page.tsx           ← Organizations
│   │   └── settings/page.tsx       ← User settings
│   ├── admin/
│   │   ├── layout.tsx              ← Admin-only layout
│   │   ├── page.tsx                ← Admin overview
│   │   ├── users/page.tsx          ← User management
│   │   └── usage/page.tsx          ← System token usage
│   └── api/
│       ├── webhooks/github/        ← GitHub event receiver
│       ├── webhooks/gitlab/        ← GitLab event receiver
│       ├── healing/[id]/
│       │   ├── approve/            ← Approve + commit fix
│       │   └── reject/             ← Reject fix
│       ├── profile/                ← User profile CRUD
│       ├── account/                ← Account deletion
│       ├── auth/signout/           ← Sign out
│       ├── integrations/           ← Integration management
│       ├── pipelines/              ← Pipeline CRUD
│       ├── flaky/                  ← Flaky test API
│       ├── patterns/               ← Pattern detection
│       ├── scan/[pipelineId]/      ← Security scan trigger
│       ├── optimize/[pipelineId]/  ← Optimization analysis
│       ├── env-audit/[pipelineId]/ ← Env audit trigger
│       ├── sla/                    ← SLA rules + violations
│       ├── rollback/               ← Rollback trigger
│       ├── templates/              ← Template CRUD + seed
│       ├── reports/                ← Report generation
│       ├── notifications/          ← Channel management
│       ├── chat/                   ← AI chat endpoint
│       ├── pr-comment/             ← PR comment trigger
│       ├── orgs/                   ← Org management
│       │   └── [orgId]/members/    ← Member management
│       ├── settings/approval-mode/ ← Approval mode toggle
│       └── admin/users/            ← Admin user management
├── lib/
│   ├── supabase/
│   │   ├── client.ts               ← Browser auth context (auth only)
│   │   ├── server.ts               ← Server-side client (API routes)
│   │   ├── admin.ts                ← Service role client
│   │   └── database.types.ts       ← TypeScript schema types
│   ├── claude/
│   │   ├── healer.ts               ← analyzeAndHeal() — Claude Sonnet
│   │   ├── chatbot.ts              ← streamChatResponse() — Claude Haiku
│   │   └── prompts.ts              ← System prompts
│   ├── healing/
│   │   ├── orchestrator.ts         ← End-to-end healing flow
│   │   └── error-extractor.ts      ← Log parsing + noise removal
│   ├── github/
│   │   ├── workflow-updater.ts     ← Fetch logs + commit fixes
│   │   └── pr-commenter.ts         ← Post PR comments
│   ├── gitlab/
│   │   └── pipeline-updater.ts     ← GitLab equivalent
│   ├── crypto/
│   │   ├── encrypt.ts              ← AES-256-GCM encrypt
│   │   └── decrypt.ts              ← AES-256-GCM decrypt
│   ├── webhooks/
│   │   ├── github-parser.ts
│   │   ├── gitlab-parser.ts
│   │   └── signature-verify.ts
│   ├── flaky/detector.ts
│   ├── patterns/detector.ts
│   ├── scanner/security-rules.ts
│   ├── optimizer/analyzer.ts
│   ├── env-audit/auditor.ts
│   ├── rollback/rollback-manager.ts
│   ├── reports/report-generator.ts
│   ├── notifications/sender.ts
│   └── utils.ts
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             ← Grouped navigation
│   │   └── Topbar.tsx              ← Header + user menu
│   ├── ui/                         ← shadcn/ui components
│   └── admin/
│       └── AdminUserActions.tsx
└── hooks/
    ├── use-toast.ts
    └── use-realtime-healing.ts     ← Live healing event updates
```

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com) account (free tier works)
- [Anthropic](https://console.anthropic.com) API key
- GitHub or GitLab account

### Step 1 — Install Dependencies

```bash
npm install
```

### Step 2 — Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run each migration file in order:

```bash
supabase/migrations/0001_init_schema.sql
supabase/migrations/0002_rls_policies.sql
supabase/migrations/0003_functions.sql
supabase/migrations/0004_new_features.sql
supabase/migrations/0005_new_features_rls.sql
supabase/migrations/0006_schema_updates.sql
```

3. Enable **Realtime** on these tables: `pipelines`, `pipeline_runs`, `healing_events`
   - Go to **Database → Replication → Tables** and enable each

4. Copy your credentials:
   - **Project URL**: Settings → API → Project URL
   - **Anon key**: Settings → API → anon/public
   - **Service Role key**: Settings → API → service_role *(keep secret)*

### Step 3 — Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the 64-character output as your `ENCRYPTION_KEY`.

### Step 4 — Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
ENCRYPTION_KEY=<64-char hex from step 3>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 5 — Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Step 6 — Create Your Admin Account

1. Register at `/register`
2. In Supabase **SQL Editor**, promote your account:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

### Step 7 — Connect GitHub Integration

1. Go to **Integrations → Add Integration**
2. Select **GitHub**
3. Enter your GitHub username
4. Create a **Personal Access Token** at `github.com/settings/tokens`:
   - Required scopes: `repo`, `workflow`
5. Paste the token and click **Connect**

### Step 8 — Add GitHub Webhook

After connecting, the Integrations page shows your webhook URL and secret.

In your GitHub repository → **Settings → Webhooks → Add webhook**:

| Field | Value |
|-------|-------|
| Payload URL | `https://your-app.vercel.app/api/webhooks/github` |
| Content type | `application/json` |
| Secret | *(from Integrations page)* |
| Events | Workflow jobs, Workflow runs |

For **local development** with [ngrok](https://ngrok.com):

```bash
ngrok http 3000
# Use the https://xxxx.ngrok.io URL as your webhook payload URL
```

### Step 9 — Connect GitLab (Optional)

1. Go to **Integrations → Add Integration**
2. Select **GitLab**
3. Create a **Personal Access Token** at `gitlab.com/-/user_settings/personal_access_tokens`:
   - Required scopes: `api`, `read_repository`, `write_repository`
4. In your GitLab project → **Settings → Webhooks**:
   - URL: `https://your-app.vercel.app/api/webhooks/gitlab`
   - Secret token: *(from Integrations page)*
   - Trigger: **Pipeline events**, **Job events**

---

## User Manual

### Authentication

**Register** at `/register` with your email and password. A profile is automatically created.

**Login** at `/login`. If you have a `?redirectTo` parameter in the URL, you'll be taken there after login.

**Suspended accounts** are redirected to `/suspended` and cannot access the application until an admin re-enables them.

---

### Dashboard

The dashboard (`/dashboard`) is your command center. It shows:

- **Stats bar** — Total pipelines, runs today, active heals pending review, tokens used
- **Recent pipeline runs** — Last 10 runs across all repos with status indicators
- **Pending healing events** — Events awaiting your review with a direct Approve button
- **Token usage bar** — Current month consumption vs. your budget

Click any pipeline name to go to its detail page. Click any healing event to review the AI fix.

---

### Pipelines

**Pipeline List** (`/pipelines`) shows all repositories PipelineHealer is monitoring with:
- Last run status (success / failed / running)
- Branch, commit SHA, triggered by
- Duration

**Pipeline Detail** (`/pipelines/[id]`) shows:
- Full run history with expandable job list
- Each job's status, duration, and error excerpt (for failed jobs)
- Direct link to the healing event generated for a failure

Pipelines are created automatically when a webhook event is received for a repository that isn't yet tracked.

---

### Healing Events

This is the core feature. Every pipeline failure triggers an AI analysis.

**Healing List** (`/healing`) — Two sections:
- **Awaiting Review** — Highlighted cards for events needing your action
- **History** — All past healing events with final status

**Healing Detail** (`/healing/[id]`) shows:
- Which job failed and why (AI's reason)
- The AI's proposed solution (explanation)
- **Code diff** — side-by-side before/after of the proposed file change
- Confidence level and tokens used
- **Approve** button — commits the fix to the repository
- **Reject** button — discards the suggestion

**Statuses:**
| Status | Meaning |
|--------|---------|
| `pending_review` | Waiting for your decision |
| `approved` | You approved, commit is queued |
| `applying` | Fix is being committed to the repo |
| `applied` | Fix committed successfully |
| `apply_failed` | Commit attempt failed (check error message) |
| `rejected` | You rejected the fix |

**Approval Modes:**
- **Manual** *(default)* — Every fix requires your review before being committed
- **Auto** — Fixes are committed immediately without review (configure in Settings)

---

### Integrations & Credentials

**Integrations page** (`/integrations`) lists all connected GitHub/GitLab accounts with their webhook URLs and secrets.

**Add Integration** (`/integrations/new`) — Enter provider, username, and API token. The token is encrypted with AES-256-GCM before storage and never displayed again.

**Settings → Credentials** — Manage existing integrations:
- **Edit** — Update the username or rotate your API token
- **Remove** — Disconnect the integration (stops monitoring for all associated pipelines)

When you rotate a token, the new token is immediately encrypted and stored; the old token is overwritten.

---

### Flaky Test Tracker

(`/flaky`) Identifies tests that fail intermittently — often masking real problems or generating noise.

**How it works:**
- PipelineHealer tracks every test result across runs
- Computes `flakiness_score = failures / (failures + passes)` per test
- A score above ~0.3 indicates a significantly flaky test

**Actions:**
- **Sort** by flakiness score, failure count, or last seen date
- **Suppress** a test to exclude it from alerts (it still runs but won't trigger healing)
- **Filter** by pipeline

Tests are grouped by repository so you can see which projects have the most instability.

---

### Failure Patterns

(`/patterns`) Surfaces recurring errors that appear across multiple pipelines or over time.

**How it works:**
1. When a job fails, the error is *normalized* (paths, UUIDs, versions, timestamps stripped)
2. A SHA-256 hash of the normalized error becomes the pattern key
3. New failures matching an existing pattern increment its occurrence count
4. Patterns that appear 3+ times get an **AI insight** on first request

**Actions:**
- Click **Get Insight** on any pattern to ask Claude for the root cause and permanent fix
- View which repositories are affected
- Track occurrence count and last seen date

---

### Secret Scanner

(`/scanner`) Detects credentials, API keys, and sensitive data accidentally committed to workflow files.

**Detected secret types:**
- AWS Access Key IDs / Secret Access Keys
- GitHub / GitLab Personal Access Tokens
- Generic API keys and passwords
- Private SSH/TLS keys
- Database connection strings
- Hardcoded secrets in `echo` or shell assignments

**Severity levels:** `critical` → `high` → `medium` → `low`

**Running a scan:**
1. Select a pipeline from the dropdown
2. Click **Run Scan**
3. PipelineHealer fetches all `.github/workflows/*.yml` files and scans each rule

**Results** show:
- File path and line number
- Rule that triggered (e.g. `SEC001: Hardcoded Secret`)
- Redacted evidence (first/last characters only, middle masked)
- Specific recommendation for remediation

Mark findings as **Resolved** once you've fixed them.

---

### Performance Optimizer

(`/optimize`) Analyzes your workflow configuration and suggests improvements to reduce build times.

**Suggestion categories:**
| Category | Example |
|----------|---------|
| **Parallelism** | Split sequential jobs into parallel matrix |
| **Caching** | Add `actions/cache` for `node_modules`, `.gradle`, pip |
| **Matrix strategy** | Run tests across multiple Node/Python versions simultaneously |
| **Job splitting** | Separate lint, test, build into independent jobs |
| **Runner upgrade** | Larger runner for CPU-intensive builds |

Each suggestion includes:
- Estimated time saving per run
- Original workflow snippet
- Optimized replacement snippet

---

### Environment Audit

(`/env-audit`) Checks that environment variables referenced in workflow files are valid and configured.

**Rules checked (ENV001–ENV008):**
- Hardcoded secrets (plain text values in env: blocks)
- AWS Access Key ID patterns
- GitHub and GitLab PAT patterns
- Secret values echoed to logs
- `pull_request_target` event used with `secrets` access
- Secrets referenced inside shell scripts
- Empty environment variable values

**Running an audit:**
1. Select a pipeline
2. Click **Run Audit**

**Results** show the file path, line number, severity, and a specific recommendation. Click **Resolve** on each finding after addressing it.

---

### SLA Monitoring

(`/sla`) Defines acceptable performance thresholds for your pipelines and alerts when they're violated.

**Rule types:**
| Metric | Description |
|--------|-------------|
| `max_duration` | Maximum allowed pipeline duration in seconds |
| `max_failures_per_day` | Maximum failed runs in any 24-hour window |
| `max_consecutive_failures` | Maximum runs that can fail in a row |
| `min_success_rate` | Minimum percentage of runs that must succeed |

**Creating a rule:**
1. Click **Add Rule**
2. Select the pipeline, metric type, threshold, and time window
3. Optionally link a notification channel for alerts

Violations are logged automatically and displayed in the **Violations** tab with actual vs. threshold values.

---

### Rollback Manager

(`/rollback`) Reverts your repository to a known-good commit via the GitHub API without touching your local environment.

**How to roll back:**
1. Select a **pipeline** from the dropdown
2. Select the **failed run** you want to roll back from
3. PipelineHealer fetches the last 10 commits for that branch
4. Select the **target commit** (the state you want to restore to)
5. Enter a reason (optional)
6. Click **Execute Rollback**

PipelineHealer creates a new commit whose tree matches the target SHA — this is a safe forward rollback (not a force-push), so it preserves git history.

**History tab** shows all past rollbacks with target SHA, result SHA, status, and any errors.

---

### Pipeline Templates

(`/templates`) A library of ready-to-use workflow YAML templates for GitHub Actions and GitLab CI.

**Browsing:**
- Filter by **provider** (GitHub / GitLab / Both) or **category** (CI, Deploy, Docker, Release, Security)
- Search by name or language
- Featured and official templates are highlighted

**Using a template:**
1. Click any template card to expand the preview
2. Click **Copy Template** to copy the YAML to your clipboard
3. Paste into your `.github/workflows/` or `.gitlab-ci.yml` file
4. Replace `{{VARIABLE_NAME}}` placeholders with your values

**Submitting a template:**
1. Click **Submit Template**
2. Fill in name, description, category, provider, language, and YAML content
3. Add variable documentation in the variables field
4. Submit for the community

**Official templates included:**
- Node.js CI (with npm caching)
- Docker Build & Push to GHCR
- Python + Poetry CI
- Terraform Plan & Apply
- Go CI with race detection
- Release Drafter
- Next.js deploy to Vercel
- GitLab Node.js CI

---

### Health Reports

(`/reports`) Generates AI-summarized analytics for a period of your choosing.

**Periods:** Daily (last 24h), Weekly (last 7 days), Monthly (last 30 days)

**Each report includes:**
- AI-written narrative summary (Claude Haiku) highlighting trends and concerns
- **Per-pipeline stats:**
  - Total runs, success rate, average duration
  - Number of healing events
  - SLA violations
- **Aggregate totals** across all pipelines

**Generating a report:**
Click **Generate Daily**, **Generate Weekly**, or **Generate Monthly**. Reports are saved and listed chronologically — click any report card to expand the full breakdown.

---

### Notifications

(`/notifications`) Configure where PipelineHealer sends alerts.

**Supported channels:**

| Channel | Configuration |
|---------|--------------|
| **Slack** | Incoming Webhook URL (encrypted at rest) |
| **Microsoft Teams** | Incoming Webhook URL (encrypted at rest) |
| **Discord** | Webhook URL (encrypted at rest) |
| **Email** | Recipient email address |

**Event subscriptions** — choose which events trigger a notification per channel:
- `failure` — Pipeline failed (before healing)
- `healing_complete` — AI analysis is ready for review
- `healing_applied` — Fix was committed to repo
- `sla_violation` — An SLA threshold was breached
- `security_alert` — Secret scanner found a critical issue
- `weekly_report` — Weekly health report delivered

**Testing:** Click **Test** on any channel to send a sample message and verify delivery.

---

### AI Chat Assistant

(`/chat`) A conversational interface powered by Claude Haiku for CI/CD questions and pipeline troubleshooting.

**Capabilities:**
- Explain YAML syntax and workflow actions
- Debug error messages you paste in
- Suggest optimizations for specific pipeline patterns
- Answer general CI/CD and DevOps questions

**Suggested prompts** appear on load — click any to start a conversation instantly.

Chat history is saved per session. Start a new session with the **+** button.

---

### Organizations

(`/orgs`) Create and manage teams within PipelineHealer.

**Roles:**
| Role | Permissions |
|------|------------|
| **Owner** | Full access, delete org, manage all members |
| **Admin** | Invite/remove members, change roles (except owner) |
| **Member** | View all org resources, trigger scans/reports |
| **Viewer** | Read-only access to org resources |

**Creating an org:**
1. Click **New Organization**
2. Enter name and slug (URL-safe identifier)
3. You become the owner automatically

**Inviting members:**
1. Select an org
2. Click **Invite Member**
3. Enter the member's registered email address
4. Choose their role
5. They're immediately added (no email confirmation flow — they must already have an account)

**Leaving an org:** Click **Leave** next to your name in the member list. Owners must transfer ownership before leaving.

---

### Settings

(`/settings`) Manages your personal account configuration.

**Profile section:**
- Update your display name
- Email address is read-only (set at registration)

**Credentials section:**
- View all connected GitHub/GitLab integrations
- **Edit** — Opens an inline form to update your username or rotate your API token (token input is masked)
- **Remove** — Disconnects the integration; prompts for confirmation

**Auto-Healing Mode:**
- Toggle between **Manual** (you review every fix) and **Auto** (fixes committed immediately)
- A warning banner appears when auto-mode is enabled

**AI Usage:**
- Shows current month token consumption vs. your budget
- Color-coded bar (green → yellow → red as you approach limit)

**Danger Zone — Delete Account:**
1. Read the list of what will be permanently deleted
2. Type your email address exactly to unlock the button
3. Click **Delete My Account**
4. You are immediately signed out and redirected to the home page

> ⚠️ Account deletion is permanent and cannot be undone. All pipelines, healing events, integrations, and settings are removed.

---

### Admin Panel

Accessible only to users with `role = 'admin'`.

**Overview** (`/admin`) — System-wide metrics:
- Total users, active pipelines, healing events, tokens consumed
- Recent activity feed

**Users** (`/admin/users`) — Full user list with:
- Email, name, role, signup date, token usage
- **Suspend** — Blocks login and healing for that user
- **Promote to Admin** — Grants admin privileges
- **Revoke Admin** — Returns to standard user

**Usage** (`/admin/usage`) — Token consumption analytics:
- Per-user breakdown
- Per-feature breakdown (healing vs. chat)
- Model usage (Sonnet vs. Haiku)

---

## API Reference

All API routes are under `/api/`. They require a valid session cookie set by Supabase Auth (except webhooks, which use HMAC verification).

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/profile` | Get current user's profile |
| `PATCH` | `/api/profile` | Update full name |
| `DELETE` | `/api/account` | Delete account permanently |
| `POST` | `/api/auth/signout` | Sign out (clears session cookie) |

### Integrations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/integrations` | List all integrations |
| `POST` | `/api/integrations` | Create new integration (encrypts token) |
| `PATCH` | `/api/integrations/[id]` | Update token or username |
| `DELETE` | `/api/integrations/[id]` | Remove integration |

### Healing

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/healing/[id]/approve` | Approve fix → commit to repo |
| `POST` | `/api/healing/[id]/reject` | Reject fix |
| `POST` | `/api/pr-comment` | Post healing summary to PR |

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/webhooks/github` | GitHub workflow_run / workflow_job events |
| `POST` | `/api/webhooks/gitlab` | GitLab pipeline / job events |

### Features

| Method | Path | Description |
|--------|------|-------------|
| `GET/PATCH` | `/api/flaky` | List flaky tests / toggle suppress |
| `POST` | `/api/scan/[pipelineId]` | Trigger security scan |
| `POST` | `/api/optimize/[pipelineId]` | Trigger performance analysis |
| `GET/POST/PATCH` | `/api/env-audit/[pipelineId]` | Run audit / get results / resolve |
| `GET/POST` | `/api/sla` | List SLA rules / create rule |
| `GET/POST` | `/api/rollback` | Get rollback history / trigger rollback |
| `GET/POST/PATCH` | `/api/templates` | List / create / record usage |
| `POST` | `/api/templates/seed` | Seed official templates |
| `GET/POST` | `/api/reports` | List reports / generate report |
| `GET/POST` | `/api/notifications` | List channels / create channel |
| `PATCH/DELETE` | `/api/notifications/[id]` | Update / delete channel |
| `POST` | `/api/notifications/[id]/test` | Send test notification |
| `GET/POST` | `/api/patterns` | List patterns / detect |
| `POST` | `/api/chat` | Chat message (streaming) |

### Organizations

| Method | Path | Description |
|--------|------|-------------|
| `GET/POST` | `/api/orgs` | List orgs / create org |
| `GET/PATCH/DELETE` | `/api/orgs/[orgId]` | Get details / update / delete |
| `POST/PATCH/DELETE` | `/api/orgs/[orgId]/members` | Invite / change role / remove |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/api/settings/approval-mode` | Switch manual/auto healing |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users` | List all users |
| `PATCH` | `/api/admin/users` | Suspend, promote, or revoke admin |

---

## Security Model

### Token Encryption

Every GitHub/GitLab Personal Access Token is encrypted **before** it touches the database:

```
plaintext token
     │
     ▼
AES-256-GCM encrypt (random 12-byte IV)
     │
     ├── encrypted_token (base64 ciphertext)
     ├── token_iv        (base64 IV)
     └── token_tag       (base64 auth tag)
```

The `ENCRYPTION_KEY` env variable (never in DB) is required to decrypt. Even with full database access, tokens cannot be recovered without the key.

### Webhook Verification

Every incoming webhook is verified before processing:

```
HMAC-SHA256(webhook_secret, raw_request_body) === X-Hub-Signature-256 header
```

Comparison uses `crypto.timingSafeEqual` to prevent timing attacks. Unverified requests are rejected with `401`.

### Row Level Security

Every database table enforces RLS policies:
- `SELECT / INSERT / UPDATE / DELETE` — always filtered by `user_id = auth.uid()`
- Admin operations use the service role key (bypasses RLS, server-side only)
- Users can never read or modify another user's data via the API

### Token Budget

Each user has a `token_budget` (default: 100,000 tokens/month). The orchestrator checks the remaining budget before calling Claude. When exhausted, healing is paused for that user until the next month.

---

## Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel --prod
```

Add all environment variables in **Vercel Dashboard → Settings → Environment Variables**.

Update `NEXT_PUBLIC_APP_URL` to your production URL and update all webhooks accordingly.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Manual VPS

```bash
npm run build
npm start          # starts on port 3000
```

Use **nginx** as a reverse proxy and **PM2** to keep the process alive.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key *(server only, keep secret)* |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key for Claude access |
| `ENCRYPTION_KEY` | ✅ | 64-char hex string for AES-256-GCM token encryption |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public URL of the app (used for webhook URLs) |

Generate `ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

*Built with Next.js, Supabase, and Claude AI by [Royal Bengal AI](https://github.com/Royal-Bengal-AI)*
