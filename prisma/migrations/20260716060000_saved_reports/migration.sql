-- CreateTable
CREATE TABLE "saved_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_reports_user_id_idx" ON "saved_reports"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_reports_user_id_report_id_key" ON "saved_reports"("user_id", "report_id");

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
