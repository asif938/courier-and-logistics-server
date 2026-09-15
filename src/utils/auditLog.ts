import type { Prisma } from '../generated/prisma/client';

export type AuditLogInput = Prisma.AuditLogUncheckedCreateInput;

export function recordAuditLog(tx: Prisma.TransactionClient, input: AuditLogInput) {
  return tx.auditLog.create({ data: input });
}
