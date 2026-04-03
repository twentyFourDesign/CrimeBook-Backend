import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_BODY = 8000;

function serializeMessage(m: {
  id: string;
  body: string;
  createdAt: Date;
  sender: { name: string; role: UserRole };
}) {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    senderName: m.sender.name,
    senderRole: m.sender.role,
  };
}

async function requireAssignedCase(caseId: string, officerId: string) {
  const caseFile = await prisma.caseFile.findUnique({
    where: { id: caseId },
    select: {
      reportId: true,
      assignments: {
        where: { officerId, removedAt: null },
        select: { id: true },
      },
    },
  });
  if (!caseFile) {
    return { error: fail("Case not found", 404), reportId: null };
  }
  if (!caseFile.assignments.length) {
    return { error: fail("You are not assigned to this case", 403), reportId: null };
  }
  return { error: null, reportId: caseFile.reportId };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }
  if (user.role !== "POLICE_OFFICER" && user.role !== "POLICE_COMMAND") {
    return fail("Forbidden", 403);
  }

  const { id: caseId } = await context.params;
  const assigned = await requireAssignedCase(caseId, user.id);
  if (assigned.error) return assigned.error;
  const reportId = assigned.reportId!;

  const messages = await prisma.reportMessage.findMany({
    where: { reportId },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      body: true,
      createdAt: true,
      sender: { select: { name: true, role: true } },
    },
  });

  return ok("Messages", {
    messages: messages.map(serializeMessage),
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

  const { id: caseId } = await context.params;
  const assigned = await requireAssignedCase(caseId, user.id);
  if (assigned.error) return assigned.error;
  const reportId = assigned.reportId!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }
  if (typeof body !== "object" || body === null) {
    return fail("Invalid body", 400);
  }
  const { content: raw } = body as { content?: unknown };
  if (typeof raw !== "string") {
    return fail("content is required", 400);
  }
  const content = raw.trim();
  if (!content) {
    return fail("Message cannot be empty", 400);
  }
  if (content.length > MAX_BODY) {
    return fail(`Message must be at most ${MAX_BODY} characters`, 400);
  }

  const created = await prisma.reportMessage.create({
    data: {
      reportId,
      senderId: user.id,
      body: content,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      sender: { select: { name: true, role: true } },
    },
  });

  return ok("Message sent", {
    message: serializeMessage(created),
  });
}
