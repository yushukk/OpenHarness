// Protocol types matching the Python backend (protocol.py)

export type AttachmentPayload = {
  filename: string;
  media_type: string;
  data: string;
};

export type TranscriptItem = {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'tool_result' | 'log';
  text: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  is_error?: boolean;
  images?: Array<{ media_type: string; data: string }>;
};

export type TaskSnapshot = {
  id: string;
  type: string;
  status: string;
  description: string;
  metadata: Record<string, string>;
};

export type McpServerSnapshot = {
  name: string;
  state: string;
  detail?: string;
  transport?: string;
  auth_configured?: boolean;
  tool_count?: number;
  resource_count?: number;
};

export type SelectOptionPayload = {
  value: string;
  label: string;
  description?: string;
};

export type SwarmTeammateSnapshot = {
  name: string;
  status: 'running' | 'idle' | 'done' | 'error';
  duration?: number;
  task?: string;
};

export type SwarmNotificationSnapshot = {
  from: string;
  message: string;
  timestamp: number;
};

export type BackendEvent = {
  type: string;
  message?: string | null;
  item?: TranscriptItem | null;
  state?: Record<string, unknown> | null;
  tasks?: TaskSnapshot[] | null;
  mcp_servers?: McpServerSnapshot[] | null;
  bridge_sessions?: unknown[] | null;
  commands?: string[] | null;
  modal?: Record<string, unknown> | null;
  select_options?: SelectOptionPayload[] | null;
  tool_name?: string | null;
  tool_input?: Record<string, unknown> | null;
  output?: string | null;
  is_error?: boolean | null;
  todo_markdown?: string | null;
  plan_mode?: string | null;
  swarm_teammates?: SwarmTeammateSnapshot[] | null;
  swarm_notifications?: SwarmNotificationSnapshot[] | null;
};
