export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  // optional UI metadata
  pending?: boolean;
  streaming?: boolean;
  source?: "voice" | "text" | "image";
  hasAudio?: boolean;
  imagePreview?: string;
  generatedImage?: string;
  imageAttachments?: Array<{ id: string; dataUrl: string; name: string }>;
  reactions?: string[];
  moodEmoji?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface JarvisStatus {
  state: "idle" | "listening" | "thinking" | "speaking" | "error";
  label: string;
}
