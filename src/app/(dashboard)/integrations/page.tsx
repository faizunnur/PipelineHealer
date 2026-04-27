import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { Plus, Github, Gitlab, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteIntegrationButton } from "@/components/integrations/DeleteIntegrationButton";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session) return null;

  const db = createAdminClient();
  const { data: integrations } = await db
    .from("integrations")
    .select("id, provider, provider_user, is_active, created_at, webhook_secret")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Connect your GitHub and GitLab accounts
          </p>
        </div>
        <Button asChild>
          <Link href="/integrations/new">
            <Plus className="w-4 h-4" />
            Add Integration
          </Link>
        </Button>
      </div>

      {integrations?.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Github className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Gitlab className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
            <p className="font-medium mb-1">No integrations yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Connect GitHub or GitLab to start monitoring your pipelines
            </p>
            <Button asChild>
              <Link href="/integrations/new">
                <Plus className="w-4 h-4" />
                Add Your First Integration
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {integrations?.map((integration) => (
          <Card key={integration.id}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  {integration.provider === "github" ? (
                    <Github className="w-5 h-5" />
                  ) : (
                    <Gitlab className="w-5 h-5 text-orange-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">
                      {integration.provider_user}
                    </span>
                    <Badge
                      variant={
                        integration.provider === "github"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-xs capitalize"
                    >
                      {integration.provider}
                    </Badge>
                    {integration.is_active && (
                      <Badge variant="success" className="text-xs">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Connected{" "}
                    {new Date(integration.created_at).toLocaleDateString()}
                  </p>
                </div>
                <DeleteIntegrationButton integrationId={integration.id} />
              </div>

              {/* Webhook Setup Info */}
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs space-y-1">
                <p className="font-medium text-muted-foreground">
                  Webhook Configuration
                </p>
                <p className="text-muted-foreground">
                  URL:{" "}
                  <code className="bg-background px-1 rounded">
                    {process.env.NEXT_PUBLIC_APP_URL ??
                      "https://your-app.com"}
                    /api/webhooks/{integration.provider}
                  </code>
                </p>
                <p className="text-muted-foreground">
                  Secret:{" "}
                  <code className="bg-background px-1 rounded font-mono">
                    {integration.webhook_secret.slice(0, 16)}...
                  </code>
                  <WebhookSecretCopy secret={integration.webhook_secret} />
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WebhookSecretCopy({ secret }: { secret: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(secret)}
      className="ml-2 text-primary hover:underline text-xs"
    >
      Copy full secret
    </button>
  );
}
