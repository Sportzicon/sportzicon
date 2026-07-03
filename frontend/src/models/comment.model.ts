export type CommentParentType = "post" | "reel" | "blog";

export interface CommentDoc {
  id: string;
  parent_type: CommentParentType;
  parent_id: string;
  author_id: string;
  author_name: string;
  text: string;
  like_count: number;
  liked: boolean;
  created_at: number;
}

export interface AddCommentRequest {
  text: string;
}

export interface UpdateCommentRequest {
  text: string;
}
