# PipelineHealer — User Manual

> **Version:** 1.0 · **Powered by:** Royal Bengal AI

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
   - [Creating an Account](#21-creating-an-account)
   - [Logging In](#22-logging-in)
   - [Forgot Password](#23-forgot-password)
3. [Connecting Your First Repository](#3-connecting-your-first-repository)
   - [Adding a GitHub Integration](#31-adding-a-github-integration)
   - [Adding a GitLab Integration](#32-adding-a-gitlab-integration)
   - [Setting Up the Webhook](#33-setting-up-the-webhook)
4. [Adding Pipelines](#4-adding-pipelines)
5. [Dashboard](#5-dashboard)
6. [Healing Events](#6-healing-events)
   - [Understanding a Healing Event](#61-understanding-a-healing-event)
   - [Approving a Fix](#62-approving-a-fix)
   - [Rejecting a Fix](#63-rejecting-a-fix)
   - [Auto-Approve Mode](#64-auto-approve-mode)
7. [Code Browser](#7-code-browser)
   - [Browsing Files](#71-browsing-files)
   - [Editing & Committing Files](#72-editing--committing-files)
   - [Creating a New File](#73-creating-a-new-file)
   - [Deleting a File](#74-deleting-a-file)
8. [AI Assistant](#8-ai-assistant)
9. [Intelligence Tools](#9-intelligence-tools)
   - [Flaky Test Tracker](#91-flaky-test-tracker)
   - [Performance Optimizer](#92-performance-optimizer)
   - [Security Scanner](#93-security-scanner)
   - [Failure Patterns](#94-failure-patterns)
   - [Environment Audit](#95-environment-audit)
10. [Operations](#10-operations)
    - [SLA Monitoring](#101-sla-monitoring)
    - [Rollback Manager](#102-rollback-manager)
    - [Health Reports](#103-health-reports)
    - [Notifications](#104-notifications)
11. [Workspace](#11-workspace)
    - [Pipeline Templates](#111-pipeline-templates)
    - [Organizations & Teams](#112-organizations--teams)
12. [Settings](#12-settings)
    - [Profile](#121-profile)
    - [Credentials](#122-credentials)
    - [Auto-Healing Mode](#123-auto-healing-mode)
    - [Deleting Your Account](#124-deleting-your-account)
13. [Admin Panel](#13-admin-panel)
    - [User Management](#131-user-management)
    - [Token Usage Analytics](#132-token-usage-analytics)
14. [Security & Privacy](#14-security--privacy)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Introduction

**PipelineHealer** is an AI-powered CI/CD platform that automatically detects pipeline failures, proposes code fixes using Claude AI, and — with your approval — commits those fixes directly to your repository.

Beyond auto-healing, it provides a full DevOps intelligence suite:

| Capability | What it does |
|------------|-------------|
| **AI Auto-Healing** | Analyzes failed pipeline logs, proposes and applies code fixes |
| **Code Browser** | Browse, edit, and commit files in any connected repository |
| **Flaky Test Detection** | Identifies unreliable tests that fail intermittently |
| **Performance Optimizer** | Suggests parallelism, caching, and runner improvements |
| **Security Scanner** | Detects exposed secrets and misconfigurations in workflows |
| **Failure Patterns** | Deduplicates and provides root-cause insights for recurring errors |
| **Environment Audit** | Validates environment variable usage in workflow files |
| **SLA Monitoring** | Tracks pipeline health against configurable thresholds |
| **Rollback Manager** | Reverts commits without leaving the dashboard |
| **Health Reports** | AI-generated daily/weekly/monthly pipeline health summaries |
| **Notifications** | Slack, Teams, Discord, and email alerts |
| **Organizations** | Multi-user team support with role-based access |

---

## 2. Getting Started

### 2.1 Creating an Account

1. Open PipelineHealer in your browser and click **Create one free** or navigate to `/register`.
2. Enter your **Full Name**, **Email address**, and a **Password**.

   Password requirements:
   - At least 8 characters
   - Contains at least one number
   - Contains at least one uppercase letter

3. Click **Create Account**.
4. Check your inbox for a verification email from PipelineHealer. Click **Verify Email** in the email.
5. After verification you are automatically signed in and redirected to the dashboard.

> **Note:** The verification link expires after 1 hour. If it expires, register again or contact support.

---

### 2.2 Logging In

1. Navigate to `/login`.
2. Enter your **Email** and **Password**.
3. Click **Sign In**.

If your email is not yet verified, you will see a message asking you to check your inbox first.

---

### 2.3 Forgot Password

1. On the login page, click **Forgot password?**
2. Enter your email address and click **Send reset link**.
3. Check your inbox for a reset email. Click **Reset Password** in the email.
4. Enter and confirm your new password, then click **Reset Password**.
5. You are redirected to the login page. Sign in with your new password.

> The reset link expires after **1 hour**.

---

## 3. Connecting Your First Repository

Before PipelineHealer can monitor your pipelines, you must connect a GitHub or GitLab account and configure a webhook in your repository.

Navigate to **Integrations** in the sidebar, then click **Add Integration**.

### 3.1 Adding a GitHub Integration

1. Select **GitHub** as the provider.
2. Enter your **GitHub username**.
3. Create a **Personal Access Token** on GitHub:
   - Go to `github.com/settings/tokens` → **Tokens (classic)** → **Generate new token**
   - Required scopes: `repo`, `workflow`
   - Copy the token immediately (it is shown only once)
4. Paste the token into the **Personal Access Token** field.
5. Click **Connect GitHub**.

Your integration is now saved. PipelineHealer displays a **Webhook URL** and a **Webhook Secret** — keep these for the next step.

---

### 3.2 Adding a GitLab Integration

1. Select **GitLab** as the provider.
2. Enter your **GitLab username**.
3. Create a **Personal Access Token** on GitLab:
   - Go to `gitlab.com/-/user_settings/personal_access_tokens`
   - Required scopes: `api`, `read_repository`, `write_repository`
4. Paste the token and click **Connect GitLab**.

---

### 3.3 Setting Up the Webhook

After connecting, copy the **Webhook URL** and **Webhook Secret** shown on the Integrations page.

**GitHub:**
1. Go to your repository → **Settings** → **Webhooks** → **Add webhook**
2. Set **Payload URL** to the webhook URL shown in PipelineHealer
3. Set **Content type** to `application/json`
4. Enter the **Secret**
5. Under **Which events?** select: **Workflow jobs**, **Workflow runs**
6. Click **Add webhook**

**GitLab:**
1. Go to your project → **Settings** → **Webhooks** → **Add new webhook**
2. Enter the webhook URL
3. Enter the secret token
4. Enable: **Pipeline events**, **Job events**
5. Click **Add webhook**

> For **local development**, use [ngrok](https://ngrok.com): `ngrok http 3000` and use the generated HTTPS URL as the webhook payload URL.

From this point, every pipeline failure in that repository will automatically trigger PipelineHealer to analyze the error and create a Healing Event.

---

## 4. Adding Pipelines

A **Pipeline** represents a specific repository you want PipelineHealer to monitor. Pipelines are added manually — they do not appear automatically until you add them here.

1. In the sidebar, click **Pipelines** → **Add Pipeline** (top right), or click **Add First Pipeline** if you have none yet.
2. Select the **integration** (connected account) from the list. If you have only one, it is pre-selected.
3. From the **Repository** dropdown, search and select the repository you want to monitor. The list is fetched directly from GitHub/GitLab — no typing required.
4. The **Pipeline name** and **Default branch** are auto-filled from the repository. Edit them if needed.
5. Click **Add Pipeline**.

The pipeline now appears on the Pipelines page. Webhook events from this repository will be linked to this pipeline automatically.

---

## 5. Dashboard

The dashboard (`/dashboard`) is your home screen.

| Section | What it shows |
|---------|---------------|
| **Stat cards** | Active pipelines, recent successes, recent failures, pending fixes |
| **Recent Pipeline Runs** | Last 8 runs across all repos with status, commit, and branch |
| **Pending Fixes** | Count of healing events waiting for your review; click to go to Healing Events |
| **AI Healing Activity** | Recent healing events with final status (Fixed / Rejected / Pending) |
| **AI Token Usage** | Your monthly token consumption vs. budget (green → yellow → red) |

Click any pipeline name to open its detail page. Click any healing event to review the proposed fix.

---

## 6. Healing Events

Every time a pipeline fails, Claude AI analyzes the error log and creates a **Healing Event** — a proposed code fix with an explanation.

### 6.1 Understanding a Healing Event

Navigate to **Healing Events** in the sidebar. Events are grouped into two sections:

- **Awaiting Review** — Events that need your decision (highlighted in yellow/amber)
- **History** — All past events (applied, rejected, failed)

Click any event to open its detail page (`/healing/{id}`), which shows:

| Section | Content |
|---------|---------|
| **Error Output** | The raw error excerpt from the failed job log |
| **Root Cause** | Claude's analysis of why the pipeline failed |
| **Proposed Solution** | Claude's explanation of the fix |
| **Code Diff** | Side-by-side Before (red) and After (green) view of the proposed file change |
| **Metadata** | File path, token usage, AI model used, timestamps |

---

### 6.2 Approving a Fix

1. Open the Healing Event detail page.
2. Review the **Error Output**, **Root Cause**, and **Code Diff** carefully.
3. If the fix looks correct, click **Apply Fix** (green button).
4. PipelineHealer commits the change directly to your repository using your stored GitHub/GitLab token.
5. The status changes to **Applying** then **Applied** once the commit succeeds.

The fix is committed with the message: `fix(ci): auto-heal - <reason>`

---

### 6.3 Rejecting a Fix

1. On the Healing Event detail page, click **Reject** (outlined red button).
2. The event is marked as **Rejected** and archived in History.

Rejected events are kept for reference but no code is changed.

---

### 6.4 Auto-Approve Mode

If you trust the AI completely for a repository, you can enable **Auto-Approve** mode in **Settings**. In this mode, fixes are committed immediately when the healing event is created — no manual review required.

> ⚠️ Use auto-approve with caution. It is recommended only for non-production workflows or after you have validated the AI's quality on your specific repositories.

See [Settings → Auto-Healing Mode](#123-auto-healing-mode) to toggle this.

---

## 7. Code Browser

The Code Browser (`/repos`) lets you browse, view, edit, and commit files in any connected repository — without leaving PipelineHealer.

### 7.1 Browsing Files

1. Click **Code Browser** in the sidebar.
2. Click the **account selector** (top left) and choose a connected integration.
3. Click the **repository selector** and search for the repository you want to browse.
4. The **branch selector** automatically defaults to the repository's default branch. Click it to switch branches.
5. The **file tree** on the left shows all files and folders. Click a folder to expand it (contents are loaded on demand).
6. Click any file to load it in the Monaco editor on the right.

The URL updates automatically as you navigate, making every view bookmarkable and shareable.

---

### 7.2 Editing & Committing Files

1. Open a file from the file tree.
2. Edit the code directly in the Monaco editor (full syntax highlighting and auto-completion).
3. When you have unsaved changes, a yellow **● unsaved changes** indicator appears in the breadcrumb bar, and a **Commit** button appears in the toolbar.
4. Click **Commit**.
5. In the dialog, enter a **commit message** (required).
6. Click **Commit** to push the change to the selected branch.

The file is updated in the repository immediately. The editor reloads with the new file SHA.

---

### 7.3 Creating a New File

1. Navigate to the repository and branch where you want the file.
2. Click **New File** in the toolbar.
3. In the dialog, enter the file path relative to the repository root (e.g. `.github/workflows/ci.yml`).
4. Click **Create**. The file is created empty and opened in the editor.
5. Write your content and commit it using the Commit button.

---

### 7.4 Deleting a File

1. Open the file you want to delete.
2. Click **Delete** in the toolbar (trash icon).
3. Confirm the deletion in the dialog.
4. The file is deleted with the commit message `chore: delete <path>`.

> ⚠️ File deletion is permanent. The file is removed from the branch's history via a new commit, but remains accessible in older commits on GitHub/GitLab.

---

## 8. AI Assistant

The AI Assistant (`/chat`) is a conversational interface powered by Claude for CI/CD questions, workflow help, and general DevOps advice.

**Starting a conversation:**
- Click a **suggested prompt** on the welcome screen, or
- Type your question in the input box and press **Enter** (or click the send button)
- Use **Shift+Enter** to add a new line without sending

**Capabilities:**
- Explain YAML syntax and GitHub Actions / GitLab CI concepts
- Debug error messages you paste in
- Generate workflow configurations from scratch
- Suggest optimizations for specific pipeline patterns
- Answer general CI/CD and DevOps questions

**Chat sessions** are preserved per browser session. Click **New Chat** in the header to start a fresh conversation.

---

## 9. Intelligence Tools

### 9.1 Flaky Test Tracker

**Location:** Sidebar → **Flaky Tests** (`/flaky`)

Flaky tests fail intermittently without code changes, producing noise and masking real bugs. PipelineHealer tracks every test result and surfaces the most unreliable ones.

**How flakiness is calculated:**
```
flakiness_score = failure_count / (failure_count + pass_count)
```
A score above 0.5 (50%) is shown in red — the test fails more than it passes.

**Reading the list:**
- **Flakiness bar** — visual percentage indicator (red = high, yellow = medium)
- **Test name** — full test identifier
- **Repo** — which pipeline the test belongs to
- **Fail / Pass counts** — raw numbers
- **Last seen** — when the test was last observed failing

**Suppressing a test:**
Click **Suppress** next to any test to exclude it from healing triggers. The test still runs, but failures will not generate new Healing Events. Click again to un-suppress.

---

### 9.2 Performance Optimizer

**Location:** Sidebar → **Optimizer** (`/optimize`)

Analyzes your workflow YAML files and suggests changes to reduce build time.

**Running an analysis:**
1. Select a pipeline from the dropdown.
2. Click **Analyze Pipeline**.
3. Claude AI fetches the workflow file and returns optimization suggestions.

**Suggestion categories:**

| Category | Example improvement |
|----------|-------------------|
| **Parallelism** | Run independent jobs simultaneously |
| **Caching** | Cache `node_modules`, pip packages, Maven artifacts |
| **Matrix** | Test against multiple Node/Python/Java versions at once |
| **Job Splitting** | Separate lint, test, and build into parallel jobs |
| **Runner Upgrade** | Use a larger runner for CPU-intensive steps |

Each suggestion shows:
- Estimated time saving per run
- **Before** code (red) and **After** code (green) diff
- Click **Dismiss** on suggestions you don't want to act on

---

### 9.3 Security Scanner

**Location:** Sidebar → **Security Scan** (`/scanner`)

Scans your GitHub Actions or GitLab CI workflow files for exposed credentials, misconfigurations, and supply-chain risks.

**Running a scan:**
1. Select a pipeline.
2. Click **Run Security Scan**.

**Severity levels:**

| Level | Icon | Examples |
|-------|------|---------|
| **Critical** | 🔴 | Hardcoded AWS secret, private key in workflow |
| **High** | 🟠 | GitHub PAT in plaintext, `pull_request_target` misuse |
| **Medium** | 🟡 | Secrets echoed to logs, empty env var values |
| **Low** | 🔵 | Generic API key pattern found |
| **Info** | ⚪ | Informational observations |

Each finding shows:
- File path and line number
- Rule ID (e.g. `SEC001: Hardcoded Secret`)
- Redacted evidence (middle characters masked)
- Recommendation for remediation

Click **Show recommendation** to expand the remediation advice. Click **Dismiss** once you have resolved a finding.

---

### 9.4 Failure Patterns

**Location:** Sidebar → **Failure Patterns** (`/patterns`)

Surfaces recurring errors that appear across multiple pipelines or runs, so you can find systemic issues instead of fixing the same bug repeatedly.

**How it works:**
1. Each job failure is normalized (paths, versions, timestamps stripped)
2. A SHA-256 hash of the normalized error becomes the pattern key
3. New failures matching an existing pattern increment its counter
4. Patterns with 3+ occurrences can receive an **AI insight**

**Using AI insights:**
- Click **Get AI Insight** on any pattern
- Claude returns a root-cause analysis and permanent fix recommendation
- The insight is cached — future views load it instantly

**Reading the list:**
- **Occurrence count** — how many times this pattern has appeared (heat-colored: higher = redder)
- **Affected repos** — which repositories are impacted
- **Last seen** — when this error was last observed

---

### 9.5 Environment Audit

**Location:** Sidebar → **Env Audit** (`/env-audit`)

Validates how environment variables are used in your workflow files and flags dangerous patterns.

**Running an audit:**
1. Select a pipeline.
2. Click **Run Audit**.

**Rules checked:**

| Rule ID | What it detects |
|---------|----------------|
| ENV001 | Hardcoded secret values in `env:` blocks |
| ENV002 | AWS Access Key ID patterns |
| ENV003 | GitHub/GitLab PAT patterns |
| ENV004 | Secrets echoed to logs (`echo $SECRET`) |
| ENV005 | `pull_request_target` event with `secrets` access |
| ENV006 | Secrets referenced inside embedded shell scripts |
| ENV007 | Empty environment variable values |
| ENV008 | Unprotected secret in matrix strategy |

**Resolving findings:**
- Click **Show details** to expand a finding and read the recommendation.
- After addressing the issue in your code, click **Mark as resolved**.
- Toggle **Show resolved** to view previously resolved findings.

---

## 10. Operations

### 10.1 SLA Monitoring

**Location:** Sidebar → **SLA Dashboard** (`/sla`)

Define performance thresholds for your pipelines. PipelineHealer automatically tracks violations.

**Creating an SLA rule:**
1. Click **Add SLA Rule**.
2. Select the **pipeline** the rule applies to.
3. Enter a **Rule name** (e.g. "Max 10 min build").
4. Select a **metric**:

| Metric | Description |
|--------|-------------|
| `max_duration` | Maximum pipeline duration in seconds |
| `max_failures_per_day` | Maximum failed runs in any 24-hour window |
| `max_consecutive_failures` | Maximum runs that can fail in a row |
| `min_success_rate` | Minimum success percentage over the window |

5. Enter the **threshold** value.
6. Enter the **window** (in hours) over which the metric is measured.
7. Click **Create SLA Rule**.

**Reading the dashboard:**
- **Met** badge (green) — pipeline is within the defined threshold
- **Violated** badge (red) — threshold has been breached; number of violations shown
- Each rule card lists recent violations with actual vs. threshold values

---

### 10.2 Rollback Manager

**Location:** Sidebar → **Rollback** (`/rollback`)

Reverts your repository to a known-good commit via the GitHub API — no local environment needed.

**Executing a rollback:**
1. Select the **pipeline** (repository) from the dropdown.
2. Select the **failed run** you want to roll back from.
3. PipelineHealer fetches the last 10 commits for that branch and displays them as a list.
4. Select the **target commit** — the state you want to restore to.
5. Optionally enter a **reason** for your records.
6. Click **Execute Rollback**.

PipelineHealer creates a new forward commit whose tree matches the selected SHA. This is safe — it preserves git history and does not force-push.

**History tab:**
Shows all past rollbacks with target SHA, result SHA, status, and any error messages.

---

### 10.3 Health Reports

**Location:** Sidebar → **Health Reports** (`/reports`)

Generates AI-summarized analytics for your pipelines over a selected period.

**Generating a report:**
Click **Generate Daily**, **Generate Weekly**, or **Generate Monthly**.

**Each report includes:**
- **AI narrative summary** (Claude Haiku) highlighting key trends, improvements, and concerns
- **Aggregate stats:** total runs, success rate, AI heals, SLA violations
- **Per-pipeline breakdown:**
  - Total runs + average duration
  - Success rate
  - Number of healing events generated
  - SLA violations

Reports are saved and listed chronologically. Click any report card to expand the full breakdown.

---

### 10.4 Notifications

**Location:** Sidebar → **Notifications** (`/notifications`)

Configure where PipelineHealer sends alerts.

**Adding a notification channel:**
1. Click **Add Channel**.
2. Select the provider:
   - **Slack** — paste an Incoming Webhook URL
   - **Microsoft Teams** — paste a Teams Incoming Webhook URL
   - **Discord** — paste a Discord Webhook URL
   - **Email** — enter a recipient email address
3. Enter a **Channel name** for your reference.
4. Select which **events** trigger a notification:

| Event | When it fires |
|-------|--------------|
| `Pipeline Failure` | A pipeline run fails |
| `Fix Ready for Review` | A new healing event is created |
| `Fix Applied` | A fix is successfully committed |
| `SLA Violation` | An SLA rule threshold is breached |
| `Security Alert` | A critical secret scan finding is detected |
| `Weekly Report` | A weekly health report is generated |

5. Click **Add Channel**.

**Testing a channel:**
Click **Test** on any channel to send a sample message and verify delivery.

**Pausing a channel:**
Use the toggle switch on the channel card to pause or resume notifications without deleting the channel.

---

## 11. Workspace

### 11.1 Pipeline Templates

**Location:** Sidebar → **Templates** (`/templates`)

A library of ready-to-use workflow YAML templates for GitHub Actions and GitLab CI.

**Browsing templates:**
- Use the **search bar** to find templates by name or language
- Filter by **category**: CI/Testing, Deploy, Docker, Release, Security, Other
- Click any template card to preview the full YAML

**Using a template:**
1. Click the template card to expand the preview
2. Click **Copy Template** to copy the YAML to your clipboard
3. Paste into your `.github/workflows/` or `.gitlab-ci.yml` file
4. Replace `{{VARIABLE_NAME}}` placeholders with your values

**Submitting a template:**
1. Click **Submit Template**
2. Fill in the name, tags, description, category, provider, and YAML content
3. Click **Submit Template** to contribute it to the library

---

### 11.2 Organizations & Teams

**Location:** Sidebar → **Organizations** (`/orgs`)

Create teams and manage shared access to PipelineHealer resources.

**Creating an organization:**
1. Click **Create Organization**.
2. Enter an **Organization name**.
3. Enter a **slug** (URL-safe identifier, e.g. `my-team`).
4. Optionally enter a description.
5. Click **Create**. You become the owner automatically.

**Roles:**

| Role | Permissions |
|------|------------|
| **Owner** | Full control, delete org, manage all members and roles |
| **Admin** | Invite/remove members, change roles (except owner) |
| **Member** | View all org resources, trigger scans and reports |
| **Viewer** | Read-only access to org resources |

**Inviting a member:**
1. Select your organization from the left list.
2. Click **Invite**.
3. Enter the member's registered PipelineHealer email address.
4. Select their role.
5. Click **Add Member**. They are added immediately (no email confirmation).

> The invited person must already have a PipelineHealer account.

**Changing a member's role:**
Click the role dropdown next to any member and select a new role (owners and admins only).

**Removing a member:**
Click **Remove** next to the member's name.

**Leaving an organization:**
Click **Leave** next to your own name. Owners must transfer ownership before leaving.

**Deleting an organization:**
Owners can click **Delete** on the organization detail panel. This is permanent and cannot be undone.

---

## 12. Settings

**Location:** Sidebar → **Settings** (`/settings`)

### 12.1 Profile

- Update your **Full Name** and click **Save Changes**.
- Your **email address** is read-only and cannot be changed after registration.

---

### 12.2 Credentials

Lists all connected GitHub/GitLab integrations.

**Editing credentials:**
1. Click **Edit** next to an integration.
2. Update the **Username** if needed.
3. To rotate your token, enter a new **Personal Access Token** (leave blank to keep the existing one).
4. Click **Save**.

**Removing an integration:**
Click **Remove**. This disconnects the integration and stops monitoring for all pipelines associated with it.

---

### 12.3 Auto-Healing Mode

**Manual** (default): Every AI-proposed fix requires your review and approval before being committed.

**Auto**: Fixes are committed immediately when the AI analysis completes — no review step.

Toggle the **Auto-Approve Fixes** switch to change modes. A warning banner appears whenever Auto mode is active as a reminder.

---

### 12.4 Deleting Your Account

Located in the **Danger Zone** section at the bottom of Settings.

**What is permanently deleted:**
- Your profile and all personal data
- All integrations and encrypted tokens
- All pipelines and pipeline runs
- All healing events
- All reports, notifications, and settings

**To delete:**
1. Read the warning carefully.
2. Type your **email address exactly** in the confirmation field.
3. Click **Delete My Account**.

You are signed out immediately. **This action cannot be undone.**

---

## 13. Admin Panel

The Admin Panel is only accessible to users with the `admin` role. Navigate to `/admin` or look for **Admin Panel** at the bottom of the sidebar.

### 13.1 User Management

**Location:** `/admin/users`

Displays all registered users with:
- Name and email
- Role (admin / user)
- Status (Active / Suspended)
- Monthly token usage (progress bar)
- Approval mode (Auto / Manual)
- Join date

**Available actions per user (via Actions dropdown):**
- **Change role** — Promote to Admin or demote to User
- **Change token budget** — Adjust the monthly AI token limit
- **Suspend account** — Blocks the user from logging in and pauses healing
- **Unsuspend account** — Restores access
- **Delete user** — Permanently removes the account and all associated data

---

### 13.2 Token Usage Analytics

**Location:** `/admin/usage`

Shows system-wide AI token consumption for the current month:
- **Total tokens** used across all users
- **Per-user breakdown:**
  - Healing tokens (pipeline fixes)
  - Chat tokens (AI Assistant)
  - Total per user
- Sorted by highest usage first

---

## 14. Security & Privacy

### Token Encryption

All GitHub and GitLab Personal Access Tokens are encrypted with **AES-256-GCM** before storage:

```
plaintext token → AES-256-GCM (random 12-byte IV) → ciphertext + IV + auth tag
```

The encryption key (`ENCRYPTION_KEY`) is never stored in the database. Even with full database access, tokens cannot be decrypted without this key.

### Webhook Verification

Every incoming webhook is verified before processing:

```
HMAC-SHA256(webhook_secret, request_body) === X-Hub-Signature-256 header
```

Unverified requests are rejected with HTTP 401. Timing-safe comparison (`crypto.timingSafeEqual`) prevents timing attacks.

### Session Security

Authentication uses a signed **JWT** (`jose` library, HS256, 7-day expiry) stored in an HTTP-only cookie named `ph_session`. Passwords are hashed with **bcryptjs** (12 rounds) and the hash is the only password-related value ever stored.

### Row-Level Data Isolation

All database queries filter by your user ID server-side. You can never read or modify another user's data via the API, even with a valid session token.

---

## 15. Troubleshooting

### Webhooks are not being received

- Verify the **Payload URL** in your GitHub/GitLab settings exactly matches the URL shown on the Integrations page.
- Check that the **Secret** matches.
- For local development, confirm your ngrok tunnel is running and the URL is up to date.
- In GitHub: go to the webhook page and click **Recent Deliveries** to see error responses.

### "Registration failed — foreign key constraint"

Run this SQL in your **Supabase SQL Editor** to drop the old Supabase Auth foreign key:

```sql
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
```

### Healing event stuck on "Applying"

The commit may have failed silently. Click the healing event and check the **Apply Error** section. Common causes:
- The workflow file was changed since the event was created (file SHA mismatch)
- The integration token has expired or was revoked — update it in Settings → Credentials
- The token does not have the `workflow` scope — regenerate with correct scopes

### Code Browser shows "Failed to load repos"

- Confirm the integration token is still valid on GitHub/GitLab.
- Verify the token has `repo` scope (GitHub) or `api` scope (GitLab).
- Rotate the token in **Settings → Credentials** if it has expired.

### Forgot password email not received

- Check your spam/junk folder.
- Verify `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` are correctly set in your `.env.local` or deployment environment variables.
- The SMTP error is logged to the server console — check it for the exact failure reason.

### Token budget exhausted

When your monthly token budget is used up, healing is paused for your account. Contact your admin to increase your token budget in the **Admin → Users** panel, or wait until the budget resets on the 1st of next month.

### Build passes but pipeline does not appear

Pipelines are only created when a webhook event is received **and** the repository is registered via **Add Pipeline**. Make sure you have:
1. Added the pipeline via the Pipelines page
2. Set up the webhook on the repository
3. Triggered at least one pipeline run after the webhook was configured

---

*PipelineHealer is built and maintained by [Royal Bengal AI](https://github.com/Royal-Bengal-AI). For bug reports and feature requests, open an issue on the project repository.*
