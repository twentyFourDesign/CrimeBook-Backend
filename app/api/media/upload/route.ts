import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { uploadToCrimeMediaBucket, type UploadFolder } from "@/src/lib/storage/crime-media";

const FOLDERS = new Set<string>(["reports", "verification"]);

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Invalid form data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail("Missing file field", 400);
  }

  const folderRaw = String(form.get("folder") ?? "reports");
  if (!FOLDERS.has(folderRaw)) {
    return fail("Invalid folder (use reports or verification)", 400);
  }
  const folder = folderRaw as UploadFolder;

  const name = file.name || "upload.bin";
  const mime = file.type || "application/octet-stream";
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    const uploaded = await uploadToCrimeMediaBucket({
      folder,
      userId: user.id,
      fileName: name,
      contentType: mime,
      body: buf,
    });

    return ok("Uploaded", {
      url: uploaded.publicUrl,
      path: uploaded.path,
      fileName: name,
      mimeType: mime,
      fileSizeBytes: uploaded.fileSizeBytes,
      mediaType: uploaded.mediaType,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return fail(msg, 400);
  }
}
