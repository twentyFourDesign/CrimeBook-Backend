import { Resend } from "resend";
import { env } from "@/src/lib/config/env";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendOtpEmail(params: {
  to: string;
  code: string;
  purpose: "signup" | "signin";
  expiresMinutes: number;
}) {
  const title = params.purpose === "signup" ? "Verify your CrimeBook account" : "Your CrimeBook sign-in code";

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: params.to,
    subject: title,
    html: `<div style="font-family:Arial,sans-serif">
      <h2>${title}</h2>
      <p>Your OTP code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${params.code}</p>
      <p>This code expires in ${params.expiresMinutes} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>`,
  });
}
