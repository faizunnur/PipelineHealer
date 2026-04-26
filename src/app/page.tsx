import Link from "next/link";
import {
  Zap,
  GitBranch,
  Shield,
  Bot,
  CheckCircle2,
  ArrowRight,
  Code2,
  Bell,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: GitBranch,
    title: "GitHub & GitLab Integration",
    description:
      "Connect your repositories with one click. Monitor all your CI/CD pipelines in real-time.",
  },
  {
    icon: Bot,
    title: "AI-Powered Auto-Healing",
    description:
      "Claude AI analyzes failed jobs, identifies root causes, and generates precise fixes automatically.",
  },
  {
    icon: Shield,
    title: "Secure by Design",
    description:
      "AES-256 encryption for all credentials. Your tokens never leave your secure vault.",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description:
      "Get instant alerts when pipelines fail. Review AI-generated fixes before they're applied.",
  },
  {
    icon: CheckCircle2,
    title: "Approval Workflow",
    description:
      "Choose manual review for full control or auto-approve for hands-free healing.",
  },
  {
    icon: BarChart3,
    title: "Pipeline Analytics",
    description:
      "Track failure rates, healing success, and token usage across all your projects.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold gradient-text">PipelineHealer</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
            <Zap className="w-3 h-3" />
            <span>Powered by Royal Bengal AI, Inc</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Your CI/CD Pipelines,{" "}
            <span className="gradient-text">Self-Healing</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Connect GitHub Actions or GitLab CI. When pipelines fail, Claude AI
            diagnoses the error, generates a fix, and applies it — with your
            approval.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button size="lg" className="gap-2" asChild>
              <Link href="/register">
                Start Healing Pipelines
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Pipeline Fails",
                description:
                  "Your pipeline fails. PipelineHealer instantly detects it via webhook.",
              },
              {
                step: "02",
                title: "AI Diagnoses",
                description:
                  "Claude AI analyzes only the error output (not gigabytes of logs) to find the root cause.",
              },
              {
                step: "03",
                title: "Fix Applied",
                description:
                  "You review the fix and approve it — or let auto-approve handle it automatically.",
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="text-5xl font-black text-primary/10 mb-3">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything You Need
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-6 rounded-xl border bg-card hover:border-primary/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI Assistant highlight */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-4">
              <Bot className="w-3 h-3" />
              <span>AI Assistant</span>
            </div>
            <h2 className="text-3xl font-bold mb-4">
              Ask Anything About Your Pipelines
            </h2>
            <p className="text-muted-foreground mb-6">
              Not sure how to add a deployment job? Confused by a YAML error?
              Our AI assistant walks you through everything — even if you&apos;re
              brand new to CI/CD.
            </p>
            <Button asChild>
              <Link href="/register">Try the AI Assistant</Link>
            </Button>
          </div>
          <div className="flex-1 rounded-xl border bg-card p-4 space-y-3 font-mono text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-xs">
                U
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-muted-foreground">
                How do I add a Docker build step to my pipeline?
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3 h-3 text-primary" />
              </div>
              <div className="bg-primary/10 rounded-lg px-3 py-2 text-sm">
                <p className="text-foreground mb-2">
                  Here&apos;s how to add a Docker build job:
                </p>
                <div className="bg-background rounded p-2 text-xs text-muted-foreground">
                  <Code2 className="w-3 h-3 inline mr-1" />
                  docker-build:
                  <br />
                  &nbsp;&nbsp;runs-on: ubuntu-latest
                  <br />
                  &nbsp;&nbsp;steps:
                  <br />
                  &nbsp;&nbsp;&nbsp;&nbsp;- uses: actions/checkout@v4
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">
            Stop Babysitting Your Pipelines
          </h2>
          <p className="text-muted-foreground mb-8">
            Join developers who let AI handle CI/CD failures automatically.
          </p>
          <Button size="lg" className="gap-2" asChild>
            <Link href="/register">
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span>PipelineHealer</span>
          </div>
          <span>Powered by Royal Bengal AI, Inc</span>
        </div>
      </footer>
    </div>
  );
}
