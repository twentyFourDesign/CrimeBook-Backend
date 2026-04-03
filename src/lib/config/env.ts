import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email().default("no-reply@vishu.app"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  OTP_EXPIRES_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /** Supabase Storage bucket for incident / verification media */
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("crime-media"),
  /** Browser Maps JavaScript API key (also set in .env as NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the admin map). */
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${message}`);
}

export const env = parsed.data;
