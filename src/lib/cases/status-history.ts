import type { CaseStatusHistory, Prisma } from "@prisma/client";
import { CaseStatus } from "@prisma/client";

export type CaseDbTx = Prisma.TransactionClient;

export async function recordCaseStatusChange(params: {
  caseId: string;
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus;
  changedById?: string | null;
  notes?: string | null;
  tx: CaseDbTx;
}): Promise<void> {
  const { caseId, fromStatus, toStatus, changedById, notes, tx } = params;
  if (fromStatus === toStatus) {
    return;
  }
  await tx.caseStatusHistory.create({
    data: {
      caseId,
      fromStatus,
      toStatus,
      changedById: changedById ?? undefined,
      notes: notes ?? undefined,
    },
  });
}

export function serializeCaseStatusHistory(rows: CaseStatusHistory[]) {
  return rows.map((h) => ({
    id: h.id,
    fromStatus: h.fromStatus,
    toStatus: h.toStatus,
    notes: h.notes,
    createdAt: h.createdAt.toISOString(),
    changedById: h.changedById,
  }));
}
