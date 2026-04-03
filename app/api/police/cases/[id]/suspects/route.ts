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

  const { description, alias } = body as { description?: unknown; alias?: unknown };
  if (typeof description !== "string" || !description.trim()) {
    return fail("description is required", 400);
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

  const suspect = await prisma.suspect.create({
    data: {
      caseId: id,
      description: description.trim(),
      alias: typeof alias === "string" ? alias.trim() || null : null,
    },
  });

  return ok("Suspect tag saved", {
    suspectId: suspect.id,
    description: suspect.description,
    createdAt: suspect.createdAt.toISOString(),
  });
}

