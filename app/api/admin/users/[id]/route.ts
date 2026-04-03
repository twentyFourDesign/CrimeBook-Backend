import { NextRequest } from "next/server";
import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser, requireRole } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const patchSchema = z.object({
  status: z.nativeEnum(UserStatus).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error, user: admin } = await requireUser(request);
  if (error || !admin) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (!requireRole(admin, [UserRole.SYSTEM_ADMIN])) {
    return fail("Forbidden", 403);
  }

  const { id: targetId } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Validation failed", 400, parsed.error.flatten());
  }

  if (!parsed.data.status) {
    return fail("No changes", 400);
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, status: true },
  });

  if (!target) {
    return fail("User not found", 404);
  }

  const nextStatus = parsed.data.status;

  if (nextStatus === UserStatus.SUSPENDED || nextStatus === UserStatus.DEACTIVATED) {
    if (target.id === admin.id) {
      return fail("Cannot disable your own account", 400);
    }
    if (target.role === UserRole.SYSTEM_ADMIN) {
      return fail("Cannot suspend or deactivate a system administrator", 400);
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { status: nextStatus },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      updatedAt: true,
    },
  });

  if (nextStatus === UserStatus.SUSPENDED || nextStatus === UserStatus.DEACTIVATED) {
    await prisma.session.updateMany({
      where: { userId: targetId, isActive: true },
      data: { isActive: false },
    });
  }

  return ok("User updated", {
    user: {
      ...updated,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
