import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: true, // SSL on port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  await transporter.sendMail({
    from: `"PipelineHealer" <${process.env.SMTP_USER}>`,
    to,
    subject: "Verify your PipelineHealer email",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="margin-bottom:24px">
          <span style="font-size:20px;font-weight:700">⚡ PipelineHealer</span>
        </div>
        <h2 style="margin:0 0 8px">Verify your email address</h2>
        <p style="color:#6b7280;margin:0 0 24px">
          Thanks for signing up! Click the button below to verify your email and activate your account.
          This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
          Verify Email
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">
          If you didn't create an account, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:11px;margin:0">
          Royal Bengal AI, Inc · PipelineHealer
        </p>
      </div>
    `,
    text: `Verify your PipelineHealer email\n\nClick this link to verify your email (expires in 1 hour):\n${verifyUrl}\n\nIf you didn't create an account, ignore this email.`,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await transporter.sendMail({
    from: `"PipelineHealer" <${process.env.SMTP_USER}>`,
    to,
    subject: "Reset your PipelineHealer password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="margin-bottom:24px">
          <span style="font-size:20px;font-weight:700">⚡ PipelineHealer</span>
        </div>
        <h2 style="margin:0 0 8px">Reset your password</h2>
        <p style="color:#6b7280;margin:0 0 24px">
          We received a request to reset the password for your account.
          Click the button below to choose a new password.
          This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
          Reset Password
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">
          If you didn't request this, you can safely ignore this email.
          Your password won't change until you click the link above.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:11px;margin:0">
          Royal Bengal AI, Inc · PipelineHealer
        </p>
      </div>
    `,
    text: `Reset your PipelineHealer password\n\nClick this link to reset your password (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
  });
}
