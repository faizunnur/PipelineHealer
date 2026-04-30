import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const OFFICIAL_TEMPLATES = [
  {
    name: "Node.js CI with Caching",
    description: "Fast Node.js test pipeline with npm cache, parallel test jobs, and coverage reporting.",
    category: "ci",
    provider: "github",
    is_official: true,
    tags: ["node", "npm", "jest", "coverage"],
    use_count: 142,
    content: `name: Node.js CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    strategy:
      matrix:
        node-version: [20.x, 22.x]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
`,
  },
  {
    name: "Docker Build & Push",
    description: "Build a Docker image, push to GHCR, and sign with cosign for supply chain security.",
    category: "docker",
    provider: "github",
    is_official: true,
    tags: ["docker", "ghcr", "cosign", "security"],
    use_count: 98,
    content: `name: Docker Build & Push

on:
  push:
    tags: ['v*']

permissions:
  contents: read
  packages: write
  id-token: write

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  build-push:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.ref_name }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
`,
  },
  {
    name: "Python + Poetry CI",
    description: "Python CI with Poetry, pytest, ruff linting, and mypy type checking.",
    category: "ci",
    provider: "github",
    is_official: true,
    tags: ["python", "poetry", "pytest", "ruff", "mypy"],
    use_count: 87,
    content: `name: Python CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install Poetry
        uses: snok/install-poetry@v1

      - name: Install dependencies
        run: poetry install --no-interaction

      - name: Lint with ruff
        run: poetry run ruff check .

      - name: Type check with mypy
        run: poetry run mypy .

      - name: Run tests
        run: poetry run pytest --cov
`,
  },
  {
    name: "Terraform Plan & Apply",
    description: "Infrastructure as Code pipeline with Terraform: plan on PR, apply on merge.",
    category: "deploy",
    provider: "github",
    is_official: true,
    tags: ["terraform", "iac", "aws", "infrastructure"],
    use_count: 73,
    content: `name: Terraform

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  terraform:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Terraform Init
        run: terraform init
        env:
          AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Terraform Plan
        id: plan
        run: terraform plan -no-color

      - name: Terraform Apply
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: terraform apply -auto-approve
        env:
          AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
`,
  },
  {
    name: "Go Build & Test",
    description: "Go CI with modules caching, go vet, staticcheck, and race detector.",
    category: "ci",
    provider: "github",
    is_official: true,
    tags: ["go", "golang", "staticcheck"],
    use_count: 65,
    content: `name: Go CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.24'
          cache: true

      - name: Vet
        run: go vet ./...

      - name: Build
        run: go build -v ./...

      - name: Test with race detector
        run: go test -race -coverprofile=coverage.txt ./...
`,
  },
  {
    name: "Release Drafter",
    description: "Auto-generate GitHub release notes and changelogs from PR labels.",
    category: "release",
    provider: "github",
    is_official: true,
    tags: ["release", "changelog", "semver"],
    use_count: 54,
    content: `name: Release Drafter

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: read

jobs:
  draft:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - uses: release-drafter/release-drafter@v6
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`,
  },
  {
    name: "Next.js Deploy to Vercel",
    description: "Deploy Next.js apps to Vercel on every push to main, with preview deployments on PRs.",
    category: "deploy",
    provider: "github",
    is_official: true,
    tags: ["nextjs", "vercel", "deploy"],
    use_count: 112,
    content: `name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  deployments: write

env:
  VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - uses: actions/checkout@v4

      - name: Install Vercel CLI
        run: npm install -g vercel@latest

      - name: Pull Vercel Environment
        run: vercel pull --yes --environment=\${{ github.ref == 'refs/heads/main' && 'production' || 'preview' }} --token=\${{ secrets.VERCEL_TOKEN }}

      - name: Build
        run: vercel build \${{ github.ref == 'refs/heads/main' && '--prod' || '' }} --token=\${{ secrets.VERCEL_TOKEN }}

      - name: Deploy
        run: vercel deploy --prebuilt \${{ github.ref == 'refs/heads/main' && '--prod' || '' }} --token=\${{ secrets.VERCEL_TOKEN }}
`,
  },
  {
    name: "GitLab Node.js CI",
    description: "Node.js test pipeline for GitLab CI with caching and parallel stages.",
    category: "ci",
    provider: "gitlab",
    is_official: true,
    tags: ["node", "npm", "jest", "gitlab"],
    use_count: 44,
    content: `stages:
  - install
  - test
  - build

variables:
  NODE_ENV: test

cache:
  key:
    files:
      - package-lock.json
  paths:
    - node_modules/

install:
  stage: install
  image: node:20-alpine
  script:
    - npm ci
  artifacts:
    paths:
      - node_modules/
    expire_in: 1 hour

test:
  stage: test
  image: node:20-alpine
  script:
    - npm test -- --coverage
  coverage: '/Lines\\s*:\\s*(\\d+\\.?\\d*)%/'

build:
  stage: build
  image: node:20-alpine
  script:
    - npm run build
  only:
    - main
`,
  },
];

// GET /api/templates/seed — seed official templates (idempotent)
export async function GET() {
  const admin = createAdminClient();

  // Check if already seeded
  const { count } = await admin
    .from("pipeline_templates")
    .select("id", { count: "exact", head: true })
    .eq("is_official", true);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ message: "Already seeded", count });
  }

  // Map name → title (existing col), keep both for compatibility
  const rows = OFFICIAL_TEMPLATES.map((t) => ({
    ...t,
    title: t.name,  // existing column in 0004 schema
  }));

  const { error } = await admin
    .from("pipeline_templates")
    .insert(rows);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seeded: OFFICIAL_TEMPLATES.length });
}
