"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Info } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Global configuration for PipelineHealer
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Security & Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg flex items-start gap-3">
            <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-medium">Environment-based Configuration</p>
              <p className="text-muted-foreground text-xs">
                Platform settings like <code>ENCRYPTION_KEY</code>,{" "}
                <code>ANTHROPIC_API_KEY</code>, and{" "}
                <code>NEXT_PUBLIC_APP_URL</code> are managed via environment
                variables in your deployment.
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                To update default token budgets or other platform defaults,
                edit the corresponding environment variables and redeploy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
