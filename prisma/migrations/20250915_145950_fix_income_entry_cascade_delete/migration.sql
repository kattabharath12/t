
-- Critical Data Integrity Fix: Fix orphaned income entries and cascade delete

-- Step 1: Clean up orphaned income entries (where documentId is null)
DELETE FROM "IncomeEntry" WHERE "documentId" IS NULL;

-- Step 2: Clean up income entries with invalid document references
DELETE FROM "IncomeEntry" 
WHERE "documentId" IS NOT NULL 
AND "documentId" NOT IN (SELECT "id" FROM "Document");

-- Step 3: Drop the existing foreign key constraint
ALTER TABLE "IncomeEntry" DROP CONSTRAINT IF EXISTS "IncomeEntry_documentId_fkey";

-- Step 4: Recreate the foreign key constraint with CASCADE delete instead of SET NULL
ALTER TABLE "IncomeEntry" 
ADD CONSTRAINT "IncomeEntry_documentId_fkey" 
FOREIGN KEY ("documentId") 
REFERENCES "Document"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Add index for performance (if not exists)
CREATE INDEX IF NOT EXISTS "IncomeEntry_documentId_idx" ON "IncomeEntry"("documentId");

-- Step 6: Add comment to track this critical fix
COMMENT ON CONSTRAINT "IncomeEntry_documentId_fkey" ON "IncomeEntry" IS 'Fixed cascade delete to prevent orphaned income entries - Critical data integrity fix 2025-09-15';

