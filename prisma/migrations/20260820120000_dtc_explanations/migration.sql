-- CreateTable
CREATE TABLE "dtc_explanations" (
    "code" TEXT NOT NULL,
    "layman_explanation" TEXT NOT NULL,
    "what_to_do" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dtc_explanations_pkey" PRIMARY KEY ("code")
);
