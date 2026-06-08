export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_ids: string[];
  last_message?: { body: string; created_at: string };
  unread_counts: Record<string, number>;
}

export interface SendMessageRequest {
  recipient_id: string;
  body: string;
}
