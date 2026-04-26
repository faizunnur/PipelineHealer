import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";

export type NotificationEvent =
  | "failure"
  | "healing_complete"
  | "healing_applied"
  | "sla_violation"
  | "security_alert"
  | "weekly_report";

export interface NotificationPayload {
  event: NotificationEvent;
  title: string;
  message: string;
  repoName?: string;
  pipelineName?: string;
  severity?: "critical" | "high" | "medium" | "low" | "info";
  actionUrl?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

export async function sendNotifications(
  userId: string,
  payload: NotificationPayload
): Promise<void> {
  const supabase = createAdminClient();

  const { data: channels } = await supabase
    .from("notification_channels")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .contains("events", [payload.event]);

  if (!channels?.length) return;

  await Promise.allSettled(
    channels.map((ch) => sendToChannel(ch, payload))
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendToChannel(channel: any, payload: NotificationPayload) {
  if (channel.type === "slack") {
    await sendSlack(channel, payload);
  } else if (channel.type === "teams") {
    await sendTeams(channel, payload);
  } else if (channel.type === "discord") {
    await sendDiscord(channel, payload);
  } else if (channel.type === "email") {
    await sendEmail(channel, payload);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getWebhookUrl(channel: any): Promise<string> {
  if (channel.webhook_url && channel.webhook_iv && channel.webhook_tag) {
    return decrypt({
      encrypted: channel.webhook_url,
      iv: channel.webhook_iv,
      tag: channel.webhook_tag,
    });
  }
  return channel.webhook_url ?? "";
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

const EVENT_EMOJI: Record<string, string> = {
  failure: "❌",
  healing_complete: "🔧",
  healing_applied: "✅",
  sla_violation: "⚠️",
  security_alert: "🛡️",
  weekly_report: "📊",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendSlack(channel: any, payload: NotificationPayload) {
  const webhookUrl = await getWebhookUrl(channel);
  const emoji = EVENT_EMOJI[payload.event] ?? "📌";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} ${payload.title}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: payload.message },
    },
  ];

  if (payload.fields?.length) {
    blocks.push({
      type: "section",
      // @ts-expect-error slack block format
      fields: payload.fields.map((f) => ({
        type: "mrkdwn",
        text: `*${f.name}*\n${f.value}`,
      })),
    });
  }

  if (payload.actionUrl) {
    blocks.push({
      type: "actions",
      // @ts-expect-error slack block format
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View in PipelineHealer" },
          url: `${appUrl}${payload.actionUrl}`,
          style: payload.event === "healing_complete" ? "primary" : "default",
        },
      ],
    });
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendTeams(channel: any, payload: NotificationPayload) {
  const webhookUrl = await getWebhookUrl(channel);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const color =
    payload.event === "failure" || payload.event === "security_alert"
      ? "FF0000"
      : payload.event === "healing_applied"
      ? "00AA00"
      : "FFA500";

  const body: Record<string, unknown> = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: color,
    summary: payload.title,
    sections: [
      {
        activityTitle: payload.title,
        activityText: payload.message,
        facts: payload.fields?.map((f) => ({ name: f.name, value: f.value })) ?? [],
      },
    ],
  };

  if (payload.actionUrl) {
    body.potentialAction = [
      {
        "@type": "OpenUri",
        name: "View in PipelineHealer",
        targets: [{ os: "default", uri: `${appUrl}${payload.actionUrl}` }],
      },
    ];
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendDiscord(channel: any, payload: NotificationPayload) {
  const webhookUrl = await getWebhookUrl(channel);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const colorMap: Record<string, number> = {
    failure: 0xff4444,
    healing_complete: 0xff8800,
    healing_applied: 0x00aa44,
    sla_violation: 0xffaa00,
    security_alert: 0xff0000,
    weekly_report: 0x7c3aed,
  };

  const embed: Record<string, unknown> = {
    title: payload.title,
    description: payload.message,
    color: colorMap[payload.event] ?? 0x7c3aed,
    timestamp: new Date().toISOString(),
    footer: { text: "PipelineHealer" },
  };

  if (payload.fields?.length) {
    embed.fields = payload.fields.map((f) => ({
      name: f.name,
      value: f.value,
      inline: f.inline ?? false,
    }));
  }

  if (payload.actionUrl) {
    embed.url = `${appUrl}${payload.actionUrl}`;
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendEmail(channel: any, payload: NotificationPayload) {
  // Resend / SendGrid integration - use RESEND_API_KEY if available
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !channel.email_address) return;

  const emoji = EVENT_EMOJI[payload.event] ?? "📌";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PipelineHealer <noreply@pipelinehealer.dev>",
      to: [channel.email_address],
      subject: `${emoji} ${payload.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">${payload.title}</h2>
          <p>${payload.message}</p>
          ${payload.fields?.map((f) => `<p><strong>${f.name}:</strong> ${f.value}</p>`).join("") ?? ""}
          ${payload.actionUrl ? `<a href="${process.env.NEXT_PUBLIC_APP_URL}${payload.actionUrl}" style="display:inline-block;padding:10px 20px;background:#7c3aed;color:white;border-radius:6px;text-decoration:none;">View in PipelineHealer</a>` : ""}
          <hr style="margin-top:24px;border:none;border-top:1px solid #eee;"/>
          <p style="color:#888;font-size:12px;">PipelineHealer — AI-Powered CI/CD Auto-Healing</p>
        </div>
      `,
    }),
  });
}
