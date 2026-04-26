"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const passwordRequirements = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Contains a number", test: (p: string) => /\d/.test(p) },
  { label: "Contains uppercase", test: (p: string) => /[A-Z]/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailExists, setEmailExists] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailExists(false);

    const failing = passwordRequirements.filter((r) => !r.test(password));
    if (failing.length > 0) {
      toast({ title: "Password too weak", description: failing[0].label, variant: "destructive" });
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });

    setLoading(false);

    if (res.ok) {
      toast({
        title: "Account created!",
        description: "Check your email for a confirmation link, then sign in.",
      });
      router.push("/login");
      return;
    }

    const { error } = await res.json();

    if (error === "email_exists") {
      setEmailExists(true);
      return;
    }

    toast({ title: "Registration failed", description: error, variant: "destructive" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-xl gradient-text">PipelineHealer</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Start healing pipelines in minutes
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl shadow-black/10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailExists(false); }}
                required
                autoComplete="email"
                className={emailExists ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {/* Email already exists warning */}
              {emailExists && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm space-y-1">
                  <p className="font-medium text-destructive">This email is already registered.</p>
                  <div className="flex items-center gap-3 pt-1">
                    <Link
                      href="/login"
                      className="flex-1 text-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/forgot-password"
                      className="flex-1 text-center rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="space-y-1 pt-1">
                  {passwordRequirements.map((req) => {
                    const met = req.test(password);
                    return (
                      <div
                        key={req.label}
                        className={`flex items-center gap-1.5 text-xs ${met ? "text-success" : "text-muted-foreground"}`}
                      >
                        <Check className={`w-3 h-3 ${met ? "opacity-100" : "opacity-30"}`} />
                        {req.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || emailExists}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            By creating an account you agree to our Terms of Service.
          </p>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
