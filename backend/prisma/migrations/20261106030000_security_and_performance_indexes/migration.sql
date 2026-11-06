-- Phase 8: Security Hardening & Performance Optimization Indexes
-- Additive, non-destructive indexes for high-frequency queries

CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_mutedUntil_idx" ON "ConversationParticipant"("userId", "mutedUntil");

CREATE INDEX IF NOT EXISTS "Message_conversationId_isDeleted_createdAt_idx" ON "Message"("conversationId", "isDeleted", "createdAt");

CREATE INDEX IF NOT EXISTS "MessageReceipt_userId_status_idx" ON "MessageReceipt"("userId", "status");

CREATE INDEX IF NOT EXISTS "CallSession_status_startedAt_idx" ON "CallSession"("status", "startedAt");
