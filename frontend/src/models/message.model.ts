export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_ids: string[];
  last_message?: { body: string; sender_id?: string; at?: string; created_at?: string };
  /** @deprecated kept for demo data only — use _unread_count instead */
  unread_counts?: Record<string, number>;
  _unread_count?: number;
  _other_name?: string | null;
  _other_sub?: string | null;
  _other_avatar?: string | null;
  _other_id?: string | null;
  updated_at?: string;
  created_at?: string;
}

export interface SendMessageRequest {
  recipient_id: string;
  body: string;
}

export interface CreateConversationRequest {
  recipient_id: string;
}
