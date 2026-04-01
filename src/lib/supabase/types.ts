export type Persona = {
  id: string;
  name: string;
  avatar_url: string | null;
  gender: string | null;
  age: number | null;
  occupation: string | null;
  city: string | null;
  personality: string;
  speaking_style: string;
  background_story: string | null;
  hobbies: string | null;
  daily_habits: string | null;
  family_info: string | null;
  default_relationship: string | null;
  forbidden_patterns: string | null;
  example_dialogues: string | null;
  emotional_traits: string | null;
  quirks: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type AppUserRole = "user" | "admin";

export type AppUserRecord = {
  id: string;
  email: string;
  nickname: string;
  role: AppUserRole;
  created_at: string | null;
  last_login_at: string | null;
};

export type SessionRecord = {
  id: string;
  user_id: string;
  persona_id: string;
  character_id: string | null;
  status: "active" | "ended" | "archived";
  summary: string | null;
  topics: string[] | null;
  started_at: string | null;
  last_message_at: string | null;
  ended_at: string | null;
};

export type MessageRecord = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  emotion_label: string | null;
  created_at: string | null;
};

export type MemoryType =
  | "user_fact"
  | "persona_fact"
  | "shared_event"
  | "relationship"
  | "session_summary";

export type MemoryRecord = {
  id: string;
  user_id: string;
  persona_id: string;
  character_id?: string | null;
  memory_type: MemoryType;
  content: string;
  embedding: number[] | null;
  importance: number;
  source_session_id: string | null;
  similarity_score?: number;
  reranker_score?: number;
  final_rank?: number;
  embedding_provider?: string;
  embedding_model?: string;
  embedding_dimension?: number;
  feedback_count_accurate?: number;
  feedback_count_inaccurate?: number;
  retrieval_count?: number;
  created_at: string | null;
  updated_at: string | null;
};

export type MemoryFeedbackRecord = {
  id: string;
  user_id: string;
  memory_id: string;
  feedback_type: "accurate" | "inaccurate";
  feedback_reason: string | null;
  created_at: string | null;
};

export type MemoryConfigHistoryRecord = {
  id: string;
  config: Record<string, unknown>;
  changed_by: string;
  changed_at: string | null;
};

export type MemoryOperationLogRecord = {
  id?: string;
  timestamp: string;
  operation: string;
  user_id: string;
  persona_id?: string | null;
  character_id?: string | null;
  memory_id?: string | null;
  duration: number;
  success: boolean;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type UserProfilePerPersonaData = {
  summary: string;
  facts: string[];
  preferences: string[];
  relationship_notes: string[];
  recent_topics: string[];
  anchors: string[];
};

export type UserProfilePerPersonaRecord = {
  id: string;
  user_id: string;
  persona_id: string;
  character_id: string | null;
  profile_data: UserProfilePerPersonaData;
  relationship_stage: "new" | "warming" | "close";
  total_messages: number;
  updated_at: string | null;
};

export type EvaluationLogRecord = {
  id: string;
  user_id: string | null;
  persona_id: string | null;
  session_id: string | null;
  message_id: string | null;
  prompt_version: string | null;
  role_adherence: number | null;
  naturalness: number | null;
  emotional_accuracy: number | null;
  memory_accuracy: number | null;
  anti_ai_score: number | null;
  length_appropriate: number | null;
  evaluator: string | null;
  notes: string | null;
  feedback_type: "up" | "down" | null;
  feedback_reason: string | null;
  source: "admin-panel" | "chat-feedback" | "quick-test" | "batch-test" | "auto" | null;
  created_at: string | null;
};

export type PromptVersionRecord = {
  id: string;
  label: string;
  instructions: string;
  notes: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type UserCharacterRecord = {
  id: string;
  owner_id: string;
  name: string;
  personality: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};
