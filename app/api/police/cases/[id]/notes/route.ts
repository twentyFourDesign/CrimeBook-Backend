import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { serializeCaseStatusHistory } from "@/src/lib/cases/status-history";
import { prisma } from "@/src/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

async function requireAssignedCase(caseId: string, officerId: string) {
  const caseFile = await prisma.caseFile.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      assignments: {
        where: { officerId, removedAt: null },
        select: { id: true },
      },
    },
  });

  if (!caseFile) return { error: fail("Case not found", 404), caseFile: null };
  if (!caseFile.assignments.length) {
    return { error: fail("You are not assigned to this case", 403), caseFile: null };
  }
  return { error: null, caseFile };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }
  if (user.role !== "POLICE_OFFICER" && user.role !== "POLICE_COMMAND") {
    return fail("Forbidden", 403);
  }

  const { id } = await context.params;
  const assigned = await requireAssignedCase(id, user.id);
  if (assigned.error) return assigned.error;

  const [notes, evidence, suspects, caseStatusHistory] = await Promise.all([
    prisma.fieldNote.findMany({
      where: { caseId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        content: true,
        noteType: true,
        createdAt: true,
        officer: { select: { name: true } },
      },
    }),
    prisma.evidence.findMany({
      where: { caseId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        fileUrl: true,
        fileName: true,
        evidenceType: true,
        capturedAt: true,
      },
    }),
    prisma.suspect.findMany({
      where: { caseId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        description: true,
        alias: true,
        createdAt: true,
      },
    }),
    prisma.caseStatusHistory.findMany({
      where: { caseId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return ok("Case investigation timeline", {
    notes: notes.map((n: (typeof notes)[number]) => ({
      id: n.id,
      content: n.content,
      noteType: n.noteType,
      officerName: n.officer.name,
      createdAt: n.createdAt.toISOString(),
    })),
    evidence: evidence.map((e: (typeof evidence)[number]) => ({
      id: e.id,
      fileUrl: e.fileUrl,
      fileName: e.fileName,
      evidenceType: e.evidenceType,
      capturedAt: e.capturedAt.toISOString(),
    })),
    suspects: suspects.map((s: (typeof suspects)[number]) => ({
      id: s.id,
      description: s.description,
      alias: s.alias,
      createdAt: s.createdAt.toISOString(),
    })),
    caseStatusHistory: serializeCaseStatusHistory(caseStatusHistory),
  });
}

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

  const { content } = body as { content?: unknown };
  if (typeof content !== "string" || !content.trim()) {
    return fail("content is required", 400);
  }

  const assigned = await requireAssignedCase(id, user.id);
  if (assigned.error) return assigned.error;

  const note = await prisma.fieldNote.create({
    data: {
      caseId: id,
      officerId: user.id,
      content: content.trim(),
      noteType: "general",
    },
  });

  return ok("Note saved", {
    noteId: note.id,
    createdAt: note.createdAt.toISOString(),
  });
}

