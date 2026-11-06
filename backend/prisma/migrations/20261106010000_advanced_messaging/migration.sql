-- AlterTable: Add message forwarding and edit fields
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "isForwarded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "forwardedFrom" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);

-- CreateTable: MessageReaction
CREATE TABLE IF NOT EXISTS "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PinnedMessage
CREATE TABLE IF NOT EXISTS "PinnedMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "pinnedById" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PinnedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StarredMessage
CREATE TABLE IF NOT EXISTS "StarredMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "starredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarredMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserDeletedMessage
CREATE TABLE IF NOT EXISTS "UserDeletedMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDeletedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");
CREATE INDEX IF NOT EXISTS "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");
CREATE INDEX IF NOT EXISTS "MessageReaction_userId_idx" ON "MessageReaction"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "PinnedMessage_conversationId_messageId_key" ON "PinnedMessage"("conversationId", "messageId");
CREATE INDEX IF NOT EXISTS "PinnedMessage_conversationId_idx" ON "PinnedMessage"("conversationId");

CREATE UNIQUE INDEX IF NOT EXISTS "StarredMessage_userId_messageId_key" ON "StarredMessage"("userId", "messageId");
CREATE INDEX IF NOT EXISTS "StarredMessage_userId_idx" ON "StarredMessage"("userId");
CREATE INDEX IF NOT EXISTS "StarredMessage_messageId_idx" ON "StarredMessage"("messageId");

CREATE UNIQUE INDEX IF NOT EXISTS "UserDeletedMessage_userId_messageId_key" ON "UserDeletedMessage"("userId", "messageId");
CREATE INDEX IF NOT EXISTS "UserDeletedMessage_userId_idx" ON "UserDeletedMessage"("userId");
CREATE INDEX IF NOT EXISTS "UserDeletedMessage_messageId_idx" ON "UserDeletedMessage"("messageId");

-- AddForeignKey constraints safely
DO $$ BEGIN
  ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StarredMessage" ADD CONSTRAINT "StarredMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StarredMessage" ADD CONSTRAINT "StarredMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "UserDeletedMessage" ADD CONSTRAINT "UserDeletedMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "UserDeletedMessage" ADD CONSTRAINT "UserDeletedMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
