-- Inspector is free text (name/label), not a decimal price
ALTER TABLE "listing_details"
  ALTER COLUMN "inspector" TYPE TEXT
  USING CASE
    WHEN "inspector" IS NULL THEN NULL
    ELSE trim(both FROM "inspector"::text)
  END;