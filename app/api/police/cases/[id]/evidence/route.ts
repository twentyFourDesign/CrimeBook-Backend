import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (user.role !== "POLICE_OFFICER" && user.role !== "POLICE_COMMAND") {
    return fail("Forbidden", 403);
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  if (typeof body !== "object" || body === null) {
    return fail("Invalid body", 400);
  }

  const input = body as {
    fileUrl?: unknown;
    fileName?: unknown;
    fileSizeBytes?: unknown;
    evidenceType?: unknown;
    description?: unknown;
  };

  if (typeof input.fileUrl !== "string" || !input.fileUrl.trim()) {
    return fail("fileUrl is required", 400);
  }
  if (typeof input.fileName !== "string" || !input.fileName.trim()) {
    return fail("fileName is required", 400);
  }
  if (typeof input.fileSizeBytes !== "number" || !Number.isFinite(input.fileSizeBytes)) {
    return fail("fileSizeBytes is required", 400);
  }
  if (typeof input.evidenceType !== "string" || !input.evidenceType.trim()) {
    return fail("evidenceType is required", 400);
  }

  const allowedTypes = new Set(["BODYCAM", "PHOTO", "VIDEO", "STATEMENT", "DOCUMENT", "OTHER"]);
  if (!allowedTypes.has(input.evidenceType)) {
    return fail("Invalid evidenceType", 400);
  }

  const caseFile = await prisma.caseFile.findUnique({
    where: { id },
    select: {
      id: true,
      assignments: {
        where: { officerId: user.id, removedAt: null },
        select: { id: true },
      },
    },
  });

  if (!caseFile) {
    return fail("Case not found", 404);
  }
  if (!caseFile.assignments.length) {
    return fail("You are not assigned to this case", 403);
  }

  const checksum = createHash("sha256")
    .update(`${input.fileUrl}|${input.fileName}|${Date.now()}`)
    .digest("hex");

  const evidence = await prisma.evidence.create({
    data: {
      caseId: id,
      uploadedById: user.id,
      evidenceType: input.evidenceType,
      fileUrl: input.fileUrl.trim(),
      fileName: input.fileName.trim(),
      fileSizeBytes: Math.max(0, Math.round(input.fileSizeBytes)),
      description: typeof input.description === "string" ? input.description.trim() || null : null,
      capturedAt: new Date(),
      checksum,
    },
  });

  return ok("Evidence saved", {
    evidenceId: evidence.id,
    createdAt: evidence.createdAt.toISOString(),
  });
}

