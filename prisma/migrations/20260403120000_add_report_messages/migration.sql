-- CreateTable
CREATE TABLE "report_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_messages_report_id_created_at_idx" ON "report_messages"("report_id", "created_at");

-- AddForeignKey
ALTER TABLE "report_messages" ADD CONSTRAINT "report_messages_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "incident_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_messages" ADD CONSTRAINT "report_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
