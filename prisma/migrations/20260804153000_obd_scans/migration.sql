-- CreateTable
CREATE TABLE "obd_scans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "report_id" TEXT,
    "vin" TEXT,
    "source" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "raw_data" JSONB,
    "device_name" TEXT,
    "scanned_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obd_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "obd_scans_user_id_scanned_at_idx" ON "obd_scans"("user_id", "scanned_at");

-- AddForeignKey
ALTER TABLE "obd_scans" ADD CONSTRAINT "obd_scans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obd_scans" ADD CONSTRAINT "obd_scans_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
