import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.SES_REGION ?? "us-east-1" });
const FROM = process.env.SES_FROM_ADDRESS ?? "notifications@rrq.ai";
const CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET ?? "rrq-transactional";

type EmailTier = "critical" | "high";

interface SendNotificationEmailInput {
  toEmail: string;
  tier: EmailTier;
  title: string;
  summary: string;
  inboxUrl: string;
}

export async function sendNotificationEmail({
  toEmail,
  tier,
  title,
  summary,
  inboxUrl,
}: SendNotificationEmailInput): Promise<void> {
  const subject =
    tier === "critical"
      ? `Action required — ${title}`
      : `Your team has a recommendation`;

  const ctaLabel = tier === "critical" ? "View in Inbox" : "View Proposal in Inbox";

  const htmlBody =
    tier === "critical"
      ? `
<html><body style="font-family:monospace;background:#0a0a0a;color:#f0ece4;padding:40px;max-width:560px;margin:0 auto;">
  <p style="color:#a8a09a;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:24px;">RRQ · Action Required</p>
  <h1 style="font-size:20px;font-weight:700;color:#f0ece4;margin-bottom:16px;">${title}</h1>
  <p style="font-size:14px;color:#a8a09a;line-height:1.6;margin-bottom:24px;">${summary}</p>
  <a href="${inboxUrl}" style="display:inline-block;background:#f5a623;color:#0a0a0a;font-weight:700;padding:12px 24px;text-decoration:none;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;">${ctaLabel}</a>
  <p style="font-size:11px;color:#4a4540;margin-top:32px;">If you need help, contact <a href="mailto:support@rrq.ai" style="color:#f5a623;">support@rrq.ai</a></p>
</body></html>
      `.trim()
      : `
<html><body style="font-family:monospace;background:#0a0a0a;color:#f0ece4;padding:40px;max-width:560px;margin:0 auto;">
  <p style="color:#a8a09a;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:24px;">RRQ · Recommendation</p>
  <h1 style="font-size:20px;font-weight:700;color:#f0ece4;margin-bottom:16px;">${title}</h1>
  <p style="font-size:14px;color:#a8a09a;line-height:1.6;margin-bottom:24px;">${summary}</p>
  <a href="${inboxUrl}" style="display:inline-block;background:#f5a623;color:#0a0a0a;font-weight:700;padding:12px 24px;text-decoration:none;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;">${ctaLabel}</a>
</body></html>
      `.trim();

  const textBody =
    tier === "critical"
      ? `${title}\n\n${summary}\n\nView in Inbox: ${inboxUrl}\n\nNeed help? support@rrq.ai`
      : `${title}\n\n${summary}\n\nView Proposal in Inbox: ${inboxUrl}`;

  await ses.send(
    new SendEmailCommand({
      Source: FROM,
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: htmlBody, Charset: "UTF-8" },
          Text: { Data: textBody, Charset: "UTF-8" },
        },
      },
      ConfigurationSetName: CONFIGURATION_SET,
    })
  );
}
