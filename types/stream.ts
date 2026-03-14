// ─────────────────────────────────────────────────────────────────────────────
// Stream event types flowing from /api/generate → UI
// ─────────────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant';

export type AgentName =
  | 'HarmonyAI'
  | 'VerseCreator'
  | 'ChorusCreator'
  | 'BridgeCreator'
  | 'Orchestrator';

// Individual SSE event shapes
export type ThinkingEvent    = { type: 'thinking' };
export type AgentStepEvent   = { type: 'agent_step'; agent: AgentName; status: 'active' | 'done' };
export type TextDeltaEvent   = { type: 'text_delta'; text: string };
export type AudioReadyEvent  = {
  type: 'audio_ready';
  section: 'verse' | 'chorus' | 'bridge' | 'full';
  url: string;
  duration?: number;
};
export type DoneEvent        = { type: 'done' };
export type ErrorEvent       = { type: 'error'; message: string };

export type StreamEvent =
  | ThinkingEvent
  | AgentStepEvent
  | TextDeltaEvent
  | AudioReadyEvent
  | DoneEvent
  | ErrorEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Chat message stored in state
// ─────────────────────────────────────────────────────────────────────────────

export interface AudioTrack {
  section: 'verse' | 'chorus' | 'bridge' | 'full';
  url: string;
  duration?: number;
}

export interface AgentStep {
  agent: AgentName;
  status: 'active' | 'done';
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  isStreaming?: boolean;
  isThinking?: boolean;
  agentSteps?: AgentStep[];
  audioTracks?: AudioTrack[];
  timestamp: number;
}
