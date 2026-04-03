import type { Prisma, ReportStatusHistory } from "@prisma/client";
import { ReportStatus } from "@prisma/client";

export type DbTx = Prisma.TransactionClient;

export function serializeReportStatusHistory(rows: ReportStatusHistory[]) {
  return rows.map((h) => ({
    id: h.id,
    fromStatus: h.fromStatus,
    toStatus: h.toStatus,
    notes: h.notes,
    createdAt: h.createdAt.toISOString(),
    changedById: h.changedById,
  }));
}

/**
 * Inserts one audit row when a report's status changes. Call inside the same transaction as the update.
 * Skips insert when from and to are equal (including both null vs same enum — use only when status actually changes).
 */
export async function recordReportStatusChange(params: {
  reportId: string;
  fromStatus: ReportStatus | null;
  toStatus: ReportStatus;
  changedById?: string | null;
  notes?: string | null;
  tx: DbTx;
}): Promise<void> {
  const { reportId, fromStatus, toStatus, changedById, notes, tx } = params;
  if (fromStatus === toStatus) {
    return;
  }
  await tx.reportStatusHistory.create({
    data: {
      reportId,
      fromStatus,
      toStatus,
      changedById: changedById ?? undefined,
      notes: notes ?? undefined,
    },
  });
}
