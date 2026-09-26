-- Rename listing asking_price → inspector (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listing_details'
      AND column_name = 'asking_price'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listing_details'
      AND column_name = 'inspector'
  ) THEN
    ALTER TABLE "listing_details" RENAME COLUMN "asking_price" TO "inspector";
  END IF;
END $$;
