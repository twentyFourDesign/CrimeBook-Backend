import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MediaType } from "@prisma/client";
import { env } from "@/src/lib/config/env";

let client: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

const ALLOWED_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "application/octet-stream",
];

export function isAllowedUploadMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return ALLOWED_PREFIXES.some((p) => (p.endsWith("/") ? m.startsWith(p) : m === p));
}

export function guessMediaType(mime: string): MediaType {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return MediaType.PHOTO;
  if (m.startsWith("video/")) return MediaType.VIDEO;
  if (m.startsWith("audio/")) return MediaType.AUDIO;
  return MediaType.DOCUMENT;
}

const MAX_BYTES = 25 * 1024 * 1024;

export type UploadFolder = "reports" | "verification";

export async function uploadToCrimeMediaBucket(params: {
  folder: UploadFolder;
  userId: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}): Promise<{ path: string; publicUrl: string; fileSizeBytes: number; mediaType: MediaType }> {
  if (params.body.length > MAX_BYTES) {
    throw new Error("File too large (max 25MB)");
  }
  if (!isAllowedUploadMime(params.contentType)) {
    throw new Error("Unsupported file type");
  }

  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "upload";
  const path = `${params.folder}/${params.userId}/${randomUUID()}-${safeName}`;

  const supabase = getSupabaseAdmin();
  const bucket = env.SUPABASE_STORAGE_BUCKET;

  const { error } = await supabase.storage.from(bucket).upload(path, params.body, {
    contentType: params.contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl,
    fileSizeBytes: params.body.length,
    mediaType: guessMediaType(params.contentType),
  };
}
