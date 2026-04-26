# PipelineHealer — Setup Guide

## Prerequisites

- Node.js 18+
- A Supabase account (free tier works)
- An Anthropic API key
- GitHub or GitLab account

---

## 1. Clone & Install

```bash
cd "d:/Royal Bengal AI/GitHub Pipeline"
npm install
```

---

## 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run each migration file in order:
   - `supabase/migrations/0001_init_schema.sql`
   - `supabase/migrations/0002_rls_policies.sql`
   - `supabase/migrations/0003_functions.sql`
3. Enable **Realtime** on tables: `pipelines`, `pipeline_runs`, `healing_events`
   - Go to Database → Replication → Tables → enable for those tables
4. Get your credentials:
   - Project URL: Settings → API → Project URL
   - Anon key: Settings → API → Project API Keys → anon/public
   - Service Role key: Settings → API → Project API Keys → service_role (keep secret!)

---

## 3. Anthropic API Key

1. Get your key at [console.anthropic.com](https://console.anthropic.com)
2. Make sure you have access to `claude-sonnet-4-6` and `claude-haiku-4-5-20251001`

---

## 4. Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this 64-character hex string as your `ENCRYPTION_KEY`.

---

## 5. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
ENCRYPTION_KEY=<64-char hex from step 4>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 6. Create Admin User

1. Start the app: `npm run dev`
2. Register at `http://localhost:3000/register`
3. In Supabase SQL Editor, promote your user to admin:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

---

## 7. Connect GitHub Integration

1. Go to `http://localhost:3000/integrations/new`
2. Select **GitHub**
3. Enter your GitHub username
4. Create a Personal Access Token at `github.com/settings/tokens`:
   - Scopes: `repo`, `workflow`
5. Paste the token and click Connect

---

## 8. Add GitHub Webhook

After connecting, go to **Integrations** page to get your webhook URL and secret.

In your GitHub repository:
1. Settings → Webhooks → Add webhook
2. **Payload URL**: `https://your-app-url.com/api/webhooks/github`
3. **Content type**: `application/json`
4. **Secret**: Paste the webhook secret from the Integrations page
5. **Events**: Select:
   - Workflow jobs
   - Workflow runs

For **local development**, use [ngrok](https://ngrok.com):
```bash
ngrok http 3000
```
Use the ngrok HTTPS URL as your webhook URL.

---

## 9. Run Development Server

```bash
npm run dev
```

Open `http://localhost:3000`

---

## 10. Deploy to Production

### Vercel (Recommended)

```bash
npm install -g vercel
vercel --prod
```

Add all environment variables in Vercel dashboard:
- Settings → Environment Variables

Update `NEXT_PUBLIC_APP_URL` to your Vercel deployment URL.
Update GitHub/GitLab webhooks to use the production URL.

---

## Architecture Notes

### Token Minimization
Claude only receives the last 100 meaningful lines of failed job logs (stripped of ANSI codes, noise, and timestamps). This typically reduces a 200KB log to under 3,000 characters — keeping token costs minimal.

### Security
- All GitHub/GitLab tokens encrypted with AES-256-GCM before DB storage
- Webhook signatures verified with HMAC-SHA256 (constant-time comparison)
- Row Level Security on all Supabase tables
- Admin routes server-side role check + middleware protection

### Approval Modes
- **Manual** (default): Claude analyzes failure → you see it in Healing Events → you click Approve → fix is committed
- **Auto**: Claude analyzes → fix committed immediately (use only for trusted, stable pipelines)
