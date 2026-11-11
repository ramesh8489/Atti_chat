-- AlterTable: Add optional passwordHash for Phone Number + PIN/Password auth
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
