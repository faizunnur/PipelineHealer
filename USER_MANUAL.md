# PipelineHealer — User Manual

> Complete guide to every feature. Last updated: 2026-04-30.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Pipelines](#3-pipelines)
4. [Healing Events](#4-healing-events)
5. [Integrations](#5-integrations)
6. [Code Browser](#6-code-browser)
7. [AI Assistant](#7-ai-assistant)
8. [Intelligence — Flaky Tests](#8-flaky-tests)
9. [Intelligence — Optimizer](#9-optimizer)
10. [Intelligence — Security Scanner](#10-security-scanner)
11. [Intelligence — Failure Patterns](#11-failure-patterns)
12. [Intelligence — Env Audit](#12-env-audit)
13. [DevOps — DORA Metrics](#13-dora-metrics)
14. [DevOps — Build Analytics](#14-build-analytics)
15. [DevOps — Deployments](#15-deployments)
16. [DevOps — Artifacts](#16-artifacts)
17. [DevOps — Incidents](#17-incidents)
18. [DevOps — Auto GitHub Issues](#18-auto-github-issues)
19. [Operations — SLA Dashboard](#19-sla-dashboard)
20. [Operations — Rollback](#20-rollback)
21. [Operations — Health Reports](#21-health-reports)
22. [Operations — Notifications](#22-notifications)
23. [Templates](#23-templates)
24. [Organizations](#24-organizations)
25. [Settings](#25-settings)
26. [Admin Panel](#26-admin-panel)
27. [Sidebar Navigation](#27-sidebar-navigation)
28. [Troubleshooting](#28-troubleshooting)

---

## 1. Getting Started

### First Login

1. Open the app and go to `/register` to create your account.
2. Check your email for a verification link and click it.
3. Log in at `/login`.

### Connect Your First Integration

Before any pipeline data appears, you need to connect GitHub or GitLab.

1. Go to **Integrations → New Integration**.
2. Select your provider (GitHub or GitLab).
3. Enter your username and a Personal Access Token.
   - GitHub token scopes needed: `repo`, `workflow`
   - GitLab token scopes needed: `api`, `read_repository`
4. Click **Connect**. The token is encrypted with AES-256-GCM before storage — never stored in plain text.

### Add Your First Pipeline

1. Go to **Pipelines → New Pipeline**.
2. Select your connected integration and choose a repository.
3. Click **Add Pipeline**.
4. Click **Set Up Webhook** on the pipeline card — this registers the webhook in your GitHub/GitLab repo automatically.

### Set Up GitHub Webhook (manual fallback)

If auto-setup fails, configure it manually:

1. In your GitHub repo: **Settings → Webhooks → Add webhook**
2. **Payload URL**: `https://your-app.vercel.app/api/webhooks/github`
3. **Content type**: `application/json`
4. **Secret**: Copy from the Integrations page
5. **Events**: check **Workflow jobs** and **Workflow runs**

> For local development, use `ngrok http 3000` and use the HTTPS URL ngrok provides.

---

## 2. Dashboard

The dashboard gives a real-time overview of your pipeline health.

| Card | What it shows |
|---|---|
| Total Pipelines | Number of monitored repositories |
| Active Runs | Pipelines currently executing |
| Healing Events | AI fixes generated in the last 30 days |
| Success Rate | Percentage of runs that passed |

The activity feed shows the latest run events across all pipelines. Click any event to open the pipeline detail page.

---

## 3. Pipelines

### Pipeline List

Each pipeline card shows:
- Repository name and provider icon
- Last run status with colour-coded badge (green = success, red = failed, amber = running/queued)
- Time since last run
- **View**, **Trigger**, and **Delete** action buttons

### Pipeline Detail

Click **View** on any pipeline to open the detail page. It shows:

- **Live status badge** — updates without page refresh (polls every 3 s while a run is active, every 15 s when idle)
- **Trigger** button — manually starts the default-branch workflow via GitHub/GitLab API
- **Run history** — recent runs with status, branch, commit SHA, duration, and triggered-by name
- Each run expands to show **job-level breakdown** with per-job duration and error excerpts on failure

### Live Run Animations

When a run is active:
- The status badge pulses with a ring animation
- Running run cards display a shimmer progress bar
- The header shows a pulsing **Live** dot
- An elapsed-time counter ticks up from job start in real time

### Triggering a Pipeline

Click **Trigger** on the pipeline card or detail page. Select the target branch and click **Run**. The new run appears in the list within seconds once GitHub fires the webhook back.

---

## 4. Healing Events

PipelineHealer automatically analyses every failed CI job and generates a fix using Claude AI.

### How It Works

1. GitHub fires a `workflow_job` webhook on job failure.
2. PipelineHealer fetches the job log, strips ANSI codes and noise, and extracts the last ~100 meaningful lines.
3. Claude Sonnet analyses the error excerpt and the workflow YAML, then produces a structured fix.
4. A healing event is created and appears in **Healing Events** for your review.

### Reviewing a Healing Event

Each event shows:
- **Error excerpt** — raw failure text from the CI log
- **AI Reason** — Claude's diagnosis of the root cause
- **AI Solution** — plain-English explanation of the proposed fix
- **Diff view** — original YAML vs. fixed YAML side by side

### Approving or Rejecting

- **Approve** — PipelineHealer commits the fixed file to the repository branch via GitHub/GitLab API. The pipeline re-runs automatically.
- **Reject** — Discards the suggestion. You can add a rejection note for future reference.

### Approval Modes

| Mode | Behaviour |
|---|---|
| Manual (default) | Every fix waits for your explicit approval |
| Auto | Fix is committed immediately without review |

Change your mode in **Settings → Approval Mode**.

> Use Auto mode only on low-risk, non-production pipelines you fully trust.

---

## 5. Integrations

### Adding an Integration

Go to **Integrations → New Integration**. Provide:
- **Provider**: GitHub or GitLab
- **Username**: your provider account username
- **Personal Access Token**: created in your provider's developer settings

### Managing Integrations

- Click an integration to see its connected pipelines and webhook registration status.
- **Delete** removes the integration and disconnects all associated pipelines (confirmation required).
- Webhook secrets are shown once at creation — copy before closing the modal.

---

## 6. Code Browser

Browse repository file trees and view source files without leaving PipelineHealer.

1. Go to **Code Browser**.
2. Select a repository from the dropdown.
3. Optionally select a branch (defaults to the default branch).
4. Navigate the file tree on the left; click a file to view it with syntax highlighting on the right.

Useful for inspecting workflow files before approving a healing fix.

---

## 7. AI Assistant

A full-featured chat interface powered by Claude.

- Ask questions about pipeline failures, YAML syntax, GitHub Actions best practices, or any CI/CD topic.
- Conversations persist per session and survive page refreshes.
- Each message shows token consumption. Your remaining budget is shown at the top.
- Click **New Chat** to start a fresh conversation and clear the context window.

Token budgets are managed per user; admins can adjust limits in the Admin Panel.

---

## 8. Flaky Tests

Detects tests that pass in some runs and fail in others on the same branch.

### How Flakiness is Detected

PipelineHealer scans job logs across multiple runs. When a test name appears in both passing and failing outputs, it is flagged as flaky with a **flakiness score** (0–100, higher = more unreliable).

### Flaky Test List

Each entry shows:
- Test name and file path
- Failure count / pass count / total runs
- Flakiness score
- Last seen timestamp

### Actions

- **Suppress** — marks as known-flaky, removes from alert thresholds
- **Unsuppress** — re-enables alerting for that test

---

## 9. Optimizer

Analyses workflow YAML for performance improvements using Claude AI.

### Running a Scan

1. Go to **Optimizer**.
2. Select a pipeline.
3. Click **Analyze**.

### Suggestion Categories

| Category | Examples |
|---|---|
| Caching | Add `actions/cache` for npm / pip / gradle |
| Parallelism | Split sequential jobs into concurrent jobs |
| Runner sizing | Right-size runner for compute-heavy steps |
| Redundancy | Remove duplicate or no-op steps |
| Matrix builds | Replace copy-pasted platform jobs with a matrix |

Each suggestion shows estimated time saving, a code diff, and an **Apply** button that commits the change directly to the repo.

---

## 10. Security Scanner

Scans workflow files for security vulnerabilities across 10 rules.

### Running a Scan

1. Go to **Security Scanner**.
2. Select a pipeline.
3. Click **Scan**.

Results are grouped by severity: **Critical → High → Medium → Low → Info**.

### Security Rules

| Rule ID | Severity | Detects |
|---|---|---|
| SEC001 | Critical | Hardcoded secrets, tokens, API keys |
| SEC002 | High | `pull_request_target` + `actions/checkout` (secret exfiltration risk) |
| SEC003 | High | Actions pinned to `@main` or `@master` (supply chain risk) |
| SEC004 | Medium | Missing `permissions` block (implicit write access) |
| SEC005 | Medium | Script injection via `${{ github.event.*.body }}` |
| SEC006 | Low | Jobs without `timeout-minutes` (runaway cost risk) |
| SEC007 | Info | `:latest` Docker image tags (non-reproducible builds) |
| SEC007a | Medium | Actions pinned to version tag only, not commit SHA |
| SEC008 | High | `GITHUB_TOKEN` write permissions in `pull_request` workflows |
| SEC009 | Medium | Self-hosted runners without label filtering |
| SEC010 | Low | `workflow_dispatch` inputs with no type constraints |

### Per-Finding Actions

- **Mark as Resolved** — dismisses the finding after you fix it
- **Mark as False Positive** — hides it from future scan results permanently

Dismissed findings are collapsed into a summary at the bottom of the page.

---

## 11. Failure Patterns

Groups similar errors across all pipelines to surface recurring root causes.

Each pattern shows:
- Normalised error message
- Occurrence count and affected pipelines
- Last seen time
- **AI Insight** — Claude's explanation of the underlying root cause

Use this page to fix problems at the source rather than repeating the same fix across many pipelines.

---

## 12. Env Audit

Scans workflow files and repository configuration for environment variable problems.

### Running an Audit

1. Go to **Env Audit**.
2. Select a pipeline.
3. Click **Scan**.

### What It Finds

- Secrets referenced in workflows but not configured in the repository
- Secrets accidentally exposed via `echo` or `print` in `run:` steps
- Variables used before they are defined
- Deprecated or renamed variable names

### Result Display

Findings are grouped by file. Each finding shows severity, rule ID, line number, evidence snippet, description, and a "How to fix" recommendation. Click **Mark as resolved** after addressing a finding.

---

## 13. DORA Metrics

Industry-standard engineering performance benchmarks calculated from your real pipeline run history.

### The Four Metrics

| Metric | What it measures | Elite benchmark |
|---|---|---|
| Deployment Frequency | Successful deployments per day | Multiple/day |
| Lead Time for Changes | Avg time from job start to completion | < 1 hour |
| Mean Time to Recovery | Time from failure to next success on the same branch | < 1 hour |
| Change Failure Rate | % of runs that failed | 0–5% |

### Performance Levels

Each metric is rated **Elite / High / Medium / Low** against DORA industry benchmarks. Your current level is highlighted in the benchmark legend on each card.

### Time Range

Use the **7d / 30d / 90d** selector to change the analysis window. Longer windows produce more statistically accurate MTTR results.

### Charts

- **Daily Deployments** — stacked area chart of successes vs. failures per day
- **Avg Build Duration** — line chart of build time trend over the period

> Metrics improve in accuracy as you accumulate more pipeline history.

---

## 14. Build Analytics

Six charts plus team and cost breakdowns for a chosen time window.

### Summary KPIs

| KPI | Description |
|---|---|
| Total Runs | All pipeline runs in the selected period |
| Success Rate | Percentage that ended successfully |
| Avg Duration | Mean run time shown as Xm Ys |
| Est. CI Cost | Estimated spend at $0.008/min (Linux GitHub runner) |

### Charts

| Chart | Type | What it shows |
|---|---|---|
| Build Volume | Stacked bar | Daily success vs. failed counts |
| Success Rate % | Area | Daily success rate trend |
| Avg Build Duration | Line | Build time in seconds over time |
| Daily CI Cost | Area | Estimated cost per day in USD |

### CI Cost by Pipeline

Ranked list of pipelines by total estimated cost, with a visual bar, total minutes, and USD cost.

> Cost model: Linux $0.008/min · Windows 2× · macOS 10×. Shown as an estimate only.

### Builds by Author

Top 10 contributors by run count with success rate colour-coding (green ≥ 80 %, amber ≥ 60 %, red < 60 %).

### Branch Health

Top 10 branches by activity with a colour-coded success rate bar.

---

## 15. Deployments

Track deployments to dev, staging, and production with optional human approval gates.

### Environment Board

Three columns: **Development · Staging · Production**. Each deployment appears as a card in the relevant column.

### Creating a Deployment

Click **New Deployment** and fill in:

| Field | Description |
|---|---|
| Pipeline | Which repository is being deployed |
| Environment | dev / staging / production / custom |
| Version | Commit SHA or release tag (optional) |
| Notes | Free-text context (optional) |
| Requires approval | Toggle to enable the approval gate |

Without approval, status is set to **Deployed** immediately.  
With approval, status starts as **Pending Approval**.

### Approval Gate Workflow

1. Card shows **Approve** and **Reject** buttons.
2. **Approve** → status becomes **Approved**; a **Deploy Now** button appears.
3. **Deploy Now** → status becomes **Deployed** with deployer name and timestamp recorded.
4. **Reject** → status becomes **Rejected**. Add a rejection note.

### Deployment History

The full history table at the bottom shows all deployments sorted by date.

---

## 16. Artifacts

Track build outputs across your pipelines: Docker images, npm packages, S3 files, GitHub releases, and PyPI packages.

### Adding an Artifact

Click **Add Artifact** and provide:
- Pipeline, artifact name, type, URL, version, size (bytes), and optional JSON metadata

### Type Filter

Use the filter tabs to show only one artifact type at a time (Docker, npm, S3, GitHub Release, PyPI, Other).

### Stats Bar

Shows total artifact count, total size across all artifacts, number of pipelines publishing artifacts, and number of distinct types.

### Artifact Cards

Each card shows the type badge, name, version, source pipeline, file size, creation date, and an external link if a URL is recorded.

---

## 17. Incidents

Groups consecutive pipeline failures into incidents and tracks mean time to recovery (MTTR).

### Active Incidents

Shown at the top with a pulsing red indicator. Expand any incident to see every failed run with commit SHA, commit message, author, duration, and per-job error excerpts.

### Resolved Incidents

Shown below active incidents with **MTTR** (time from first failure to next success on the same branch) and recovery timestamp.

### Critical Path Analysis

The bottom section lists the **slowest completed runs** from the last 30 days. Each row shows:

- Pass/fail status, repository, and branch
- Total run duration
- Per-job pills showing job name, individual duration, and pass/fail colour
- A relative duration bar for visual comparison

Use this to identify which jobs are your build bottlenecks.

---

## 18. Auto GitHub Issues

Automatically creates a GitHub issue when a pipeline fails consecutively N times.

### Creating a Rule

Click **Add Rule** and configure:

| Field | Description |
|---|---|
| Pipeline | Which pipeline to watch |
| Consecutive failures | Threshold before an issue is opened (default: 3) |
| Labels | Comma-separated labels applied to the issue |
| Assignees | GitHub usernames to assign (comma-separated) |

### How It Works

1. Every webhook failure increments the pipeline's `consecutive_failures` counter.
2. A successful run resets the counter to zero.
3. When the counter hits the rule threshold, PipelineHealer opens a GitHub issue with the failure context.
4. If an open issue already exists for that pipeline, no duplicate is created.

### Managing Rules

- Click the **toggle icon** to enable or disable a rule without deleting it.
- Click **trash** to permanently delete a rule.

### Issue Log

Below the rules is a log of every auto-created issue with a direct link to GitHub, creation date, and a **Mark closed** button (records resolution in PipelineHealer; does not close the GitHub issue itself).

---

## 19. SLA Dashboard

Define performance and reliability targets per pipeline and get alerted on breach.

### Creating a Rule

| Field | Description |
|---|---|
| Pipeline | The pipeline this SLA applies to |
| Name | Descriptive name |
| Metric | `duration`, `success_rate`, or `failure_count` |
| Threshold | The limit value |
| Window (hours) | Rolling time window for evaluation |
| Notify channel | Channel to alert on breach (optional) |

### Violations Table

Shows every breach with the actual value, threshold, timestamp, and whether a notification was sent.

---

## 20. Rollback

Reverts a pipeline to a prior successful state using one of three methods.

### Rollback Methods

| Method | What it does |
|---|---|
| Re-run last success | Re-triggers the last successful run via the provider API |
| Revert commit | Creates a `git revert` commit and pushes it to the branch |
| Create PR | Opens a pull request with the revert for peer review |

### Using Rollback

1. Select a pipeline.
2. Choose the target (last successful run or a specific commit SHA).
3. Select the rollback method.
4. Click **Rollback**. The status updates from `applying` to `applied` or `failed`.

All rollback events are logged with result SHA, PR URL if applicable, and any errors encountered.

---

## 21. Health Reports

AI-generated performance summaries for daily, weekly, or monthly periods.

### Generating a Report

Click **Last 24 Hours**, **Last 7 Days**, or **Last 30 Days**. Claude analyses your pipeline data and writes a summary covering:

- Overall health trend
- Top failing pipelines and most common errors
- Healing effectiveness
- SLA compliance

### Reading a Report

Each report card shows the period, AI summary, and quick stats (pipelines, avg success rate, heals, SLA violations). Click **Expand** to see a per-pipeline breakdown.

### Exporting Reports

Every report has two export buttons:

- **CSV** — spreadsheet with per-pipeline stats (runs, success rate, avg duration, heals, violations)
- **JSON** — structured JSON with the full report including the AI summary text

---

## 22. Notifications

Send alerts to Slack, Microsoft Teams, Discord, or email when key events occur.

### Adding a Channel

1. Go to **Notifications → Add Channel**.
2. Select type: Slack, Teams, Discord, or Email.
3. For webhook-based channels: paste the incoming webhook URL.
4. For email: enter the address.
5. Select which events to subscribe to.

### Event Types

| Event | Triggers when |
|---|---|
| `run_failed` | Any monitored pipeline run fails |
| `run_success` | Any monitored pipeline run succeeds |
| `healing_applied` | A healing fix is committed to a repo |
| `security_alert` | Scanner finds critical or high severity issues |
| `sla_violation` | An SLA rule threshold is breached |

### Testing a Channel

Click **Test** beside any channel to send a test notification immediately.

---

## 23. Templates

Ready-made workflow YAML templates to apply to pipelines in seconds.

### Browsing

Filter by category (CI, Deploy, Security, Release…), provider (GitHub Actions, GitLab CI, Both), and language/framework. Click any template to preview the full YAML in the right panel.

### Applying a Template

With a template selected, click **Apply to Pipeline**.

**Automatic (commits to repo):**
1. Select the target pipeline.
2. Set the file path (e.g. `.github/workflows/ci.yml`).
3. Click **Commit to Repo** — PipelineHealer creates or updates the file via GitHub/GitLab API.

**Manual (copy-paste):**
1. The YAML and suggested file path are shown.
2. Copy and paste into your repository manually.

### Contributing a Template

Click **Contribute Template**. Provide:
- Name, description, category, provider, YAML content, language tags

Submitted templates are set to **Pending Review** and visible to admins for approval. Approved templates appear in the public marketplace.

---

## 24. Organizations

Group pipelines and team members under a shared workspace.

### Creating an Organisation

1. Go to **Organizations → New**.
2. Enter a name and optional description.
3. Link a connected integration to associate a GitHub/GitLab organisation.

### Member Roles

| Role | Permissions |
|---|---|
| Owner | Full access, can delete org |
| Admin | Manage members and pipelines |
| Member | View and trigger pipelines |
| Viewer | Read-only access |

Invite members by entering their PipelineHealer email address.

---

## 25. Settings

### Profile

Update your display name and avatar URL.

### Approval Mode

Switch between **Manual** (default, requires explicit approval of every healing fix) and **Auto** (fixes committed immediately). See [Healing Events](#4-healing-events) for details.

### Account

Change your password. Requires your current password for confirmation.

### Danger Zone

**Delete Account** permanently removes your account, pipelines, runs, and healing events. This action cannot be undone.

---

## 26. Admin Panel

Accessible only to users with the `admin` role.

### User Management

View all registered users. Per user you can:
- **Suspend / Unsuspend** — blocks or restores login access immediately
- **Promote to Admin** — grants admin role
- **Adjust token budget** — set the maximum Claude tokens this user may consume

### Template Management

**Status tabs**: All / Pending Review / Approved / Rejected

For pending templates:
- **Approve (✓)** — publishes the template to the marketplace
- **Reject (✗)** — removes it from public view

**Add Template** — admins can add templates directly and set Official / Featured flags.

**Edit** — update any template's name, YAML, category, or flags.

**Delete** — permanently removes the template with a confirmation dialog.

---

## 27. Sidebar Navigation

### Collapsible Groups

Each of the four labelled groups (Intelligence, DevOps, Operations, Workspace) has a **chevron (›)** icon beside its label. Click it to collapse the group.

- **Collapsed state (sidebar expanded):** items are hidden and replaced by a compact row of small icon buttons — you can still navigate without re-opening the group.
- The group containing your **currently active page always stays expanded** automatically regardless of collapsed state.

### Groups Reference

| Group | Pages |
|---|---|
| *(Core — always visible)* | Dashboard, Pipelines, Healing Events, Integrations, Code Browser, AI Assistant |
| Intelligence | Flaky Tests, Optimizer, Security Scanner, Failure Patterns, Env Audit |
| DevOps | DORA Metrics, Build Analytics, Deployments, Artifacts, Incidents, Auto Issues |
| Operations | SLA Dashboard, Rollback, Health Reports, Notifications |
| Workspace | Templates, Organizations, Settings |

### Collapsing the Sidebar

Click the **← arrow** in the sidebar header to collapse to icon-only mode (56 px wide). Hover any icon to see its label in a tooltip. Click the **→ arrow** at the bottom to expand again.

---

## 28. Troubleshooting

### "No runs yet" on pipeline detail

- Confirm the webhook is active: GitHub repo → **Settings → Webhooks** → check for green ticks in Recent Deliveries.
- Make sure the webhook URL has **no trailing slash**: `.../api/webhooks/github` not `.../api/webhooks/github/`.
- Verify Supabase migration **0014** (UNIQUE indexes on `pipeline_runs` and `pipeline_jobs`) has been applied — without it, all upserts fail silently.
- Go to GitHub → Webhooks → Recent Deliveries → **Redeliver** any missed events after applying migration 0014.

### Healing events not appearing

- The pipeline must have `is_monitored = true` (set automatically via the UI).
- Only `workflow_job` failure webhooks trigger healing. `workflow_run` events update the status badge only.
- Check Vercel function logs for any `[webhook/github]` error lines.

### Webhook showing 308 redirect

- Verify `next.config.ts` has `trailingSlash: false` and redeploy.

### Emails not sending

- Confirm `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` are set correctly.
- Port **465** requires SSL (`secure: true`). Port **587** uses STARTTLS.

### TypeScript build errors after a new migration

- After running a new Supabase migration, manually add the new Row type to `src/lib/supabase/database.types.ts` and register the table inside the `Database` type — the TypeScript client is fully typed against this file.

### Auto GitHub issues not being created

- Verify an **Auto Issue Rule** exists and is **Active** for that pipeline.
- Check that the GitHub token has the `issues: write` scope (included in `repo`).
- Check Vercel function logs for `[webhook/github] auto-issue creation failed`.

---

*For initial setup, environment variables, and deployment instructions, see [SETUP.md](SETUP.md).*
