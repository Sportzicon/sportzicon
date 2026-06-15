-- CreateTable
CREATE TABLE "UnreadCount" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UnreadCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnreadCount_conversation_id_user_id_key" ON "UnreadCount"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "UnreadCount_user_id_idx" ON "UnreadCount"("user_id");

-- AddForeignKey
ALTER TABLE "UnreadCount" ADD CONSTRAINT "UnreadCount_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnreadCount" ADD CONSTRAINT "UnreadCount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
