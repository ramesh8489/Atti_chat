-- AlterTable
ALTER TABLE "MediaAttachment" ADD COLUMN IF NOT EXISTS "fileName" TEXT;
ALTER TABLE "MediaAttachment" ADD COLUMN IF NOT EXISTS "uploaderId" TEXT;
ALTER TABLE "MediaAttachment" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'READY';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MediaAttachment_fileKey_idx" ON "MediaAttachment"("fileKey");
