-- AlterEnum: Non-destructive addition of BUSY and FAILED to CallStatus
DO $$ BEGIN
  ALTER TYPE "CallStatus" ADD VALUE IF NOT EXISTS 'BUSY';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "CallStatus" ADD VALUE IF NOT EXISTS 'FAILED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: Add durationSec column to CallSession if not exists
ALTER TABLE "CallSession" ADD COLUMN IF NOT EXISTS "durationSec" INTEGER;

