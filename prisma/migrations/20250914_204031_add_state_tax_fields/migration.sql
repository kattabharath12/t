
-- CreateEnum
CREATE TYPE "StateDetectionSource" AS ENUM ('ADDRESS', 'EMPLOYER', 'DOCUMENT_TYPE', 'MANUAL', 'UNKNOWN');

-- AlterTable
ALTER TABLE "TaxReturn" ADD COLUMN     "detectedState" TEXT,
ADD COLUMN     "stateConfidence" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "stateSource" "StateDetectionSource",
ADD COLUMN     "stateTaxLiability" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "stateStandardDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "stateTaxableIncome" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "stateEffectiveRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "stateItemizedDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;
