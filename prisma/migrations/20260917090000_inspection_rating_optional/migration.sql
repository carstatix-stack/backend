-- AlterTable: allow null ratings for 12-point notes+photo inspection flow
ALTER TABLE "inspection_items" ALTER COLUMN "rating" DROP NOT NULL;
