const API_BASE = '/api/v1';

// WebSocket URL helper: in production, connect directly to Railway backend
// since Vercel rewrites don't proxy WebSocket connections.
function getWsBaseUrl(): string {
  const wsApiBase = import.meta.env.VITE_API_WS_URL as string | undefined;
  if (wsApiBase) {
    // Direct backend URL provided (production)
    const base = wsApiBase.replace(/\/$/, '');
    return `wss://${base.replace(/^https?:\/\//, '')}`;
  }
  // Development: use current host (Vite proxy handles WS)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  version: string;
  config_json: Record<string, unknown> | null;
  elo_rating: number;
  total_battles: number;
  win_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Scenario {
  id: string;
  name: string;
  category: string;
  description: string;
  difficulty: string;
  ground_truth_transcript: string | null;
  created_at: string;
}

export interface EvalResult {
  id: string;
  model_id: string;
  scenario_id: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  audio_path: string;
  metrics_json: Record<string, unknown> | null;
  diarization_json: Record<string, unknown> | null;
  duration_seconds: number | null;
  error_message: string | null;
  created_at: string;
}

export interface Battle {
  id: string;
  scenario_id: string;
  model_a_id: string;
  model_b_id: string;
  eval_a_id: string | null;
  eval_b_id: string | null;
  winner: string | null;
  battle_type: string;
  vote_source: string | null;
  elo_delta: number | null;
  created_at: string;
}

export interface MetricConfig {
  key: string;
  label: string;
  format: string;
  higher_is_better: boolean;
}

export interface LeaderboardEntry {
  model_id: string;
  model_name: string;
  provider: string;
  model_type: string;
  elo_rating: number;
  win_rate: number;
  total_battles: number;
  rank: number;
  metrics: Record<string, number | null>;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  metrics_config: MetricConfig[];
}

export interface AnalyticsSummary {
  total_models: number;
  total_evaluations: number;
  completed_evaluations: number;
  total_battles: number;
  total_scenarios: number;
}

export interface PromptItem {
  id: string;
  text: string;
  category: string;
  scenario_id: string | null;
  created_at: string;
}

export interface GeneratedBattle {
  id: string;
  battle_type: string;
  prompt_text: string;
  prompt_category: string;
  audio_a_url: string;
  audio_b_url: string;
  model_a_id: string;
  model_b_id: string;
  model_a_name: string;
  model_b_name: string;
  provider_a: string;
  provider_b: string;
  eval_a_id: string;
  eval_b_id: string;
  duration_a: number;
  duration_b: number;
  ttfb_a: number;
  ttfb_b: number;
  // 4-model battle fields
  audio_c_url?: string | null;
  audio_d_url?: string | null;
  model_c_id?: string | null;
  model_d_id?: string | null;
  model_c_name?: string | null;
  model_d_name?: string | null;
  provider_c?: string | null;
  provider_d?: string | null;
  eval_c_id?: string | null;
  eval_d_id?: string | null;
  duration_c?: number | null;
  duration_d?: number | null;
  ttfb_c?: number | null;
  ttfb_d?: number | null;
}

// S2S types
export interface CuratedPrompt {
  id: string;
  text: string;
  category: string;
  audio_url: string;
  duration_seconds: number | null;
}

export interface S2SBattleSetup {
  id: string;
  battle_type: string;
  model_count: number;
  curated_prompts: CuratedPrompt[] | null;
}

export interface S2SBattleResult {
  id: string;
  battle_type: string;
  input_audio_url: string;
  input_transcript: string | null;
  audio_a_url: string;
  audio_b_url: string;
  audio_c_url: string | null;
  model_a_id: string;
  model_b_id: string;
  model_c_id: string | null;
  e2e_latency_a: number;
  e2e_latency_b: number;
  e2e_latency_c: number | null;
  ttfb_a: number;
  ttfb_b: number;
  ttfb_c: number | null;
  duration_a: number;
  duration_b: number;
  duration_c: number | null;
}

export interface S2SModelMetrics {
  transcript: string | null;
  utmos: number | null;
  prosody_score: number | null;
  relevance_score: number | null;
}

export interface S2SMetrics {
  status: string;
  model_names: Record<string, string> | null;
  providers: Record<string, string> | null;
  metrics: Record<string, S2SModelMetrics> | null;
}

// STT types
export interface AudioClip {
  id: string;
  text: string;
  category: string;
  difficulty: string;
  audio_url: string;
  duration_seconds: number | null;
}

export interface STTBattleSetup {
  id: string;
  battle_type: string;
  model_count: number;
  curated_clips: AudioClip[] | null;
}

export interface STTTranscriptItem {
  model_id: string;
  transcript: string;
  word_count: number;
  e2e_latency_ms: number;
  ttfb_ms: number;
}

export interface STTBattleResult {
  id: string;
  battle_type: string;
  input_audio_url: string;
  ground_truth: string | null;
  transcripts: STTTranscriptItem[];
}

export interface STTDiffItem {
  word: string | null;
  ref_word: string | null;
  type: 'correct' | 'insertion' | 'deletion' | 'substitution';
}

export interface STTModelMetrics {
  transcript: string;
  wer: number | null;
  cer: number | null;
  diff: STTDiffItem[] | null;
  e2e_latency_ms: number;
  ttfb_ms: number;
  word_count: number;
}

export interface STTMetrics {
  status: string;
  model_names: Record<string, string> | null;
  providers: Record<string, string> | null;
  ground_truth: string | null;
  metrics: Record<string, STTModelMetrics> | null;
}

export interface TTSGenerateRequest {
  model_id: string;
  text: string;
  engine?: string;
}

export interface TTSGenerateResponse {
  audio_url: string;
  duration_seconds: number;
  ttfb_ms: number;
  generation_time_ms: number;
  model_id: string;
  model_name: string;
}

// ---- Agent types ----
export interface AgentScenario {
  id: string
  name: string
  category: string
  difficulty: string
  description: string
  max_turns: number | null
  max_duration_seconds: number | null
}

export interface AgentConfig {
  id: string
  name: string
  architecture_type: string
  provider: string
  components: Record<string, string>
}

export interface AgentBattleSetup {
  id: string
  battle_type: string
  scenario: AgentScenario
  config_a: AgentConfig
  config_b: AgentConfig
  agent_battle_id: string
}

export interface AgentConversationTurn {
  role: string
  text: string | null
  start_ms?: number
  end_ms?: number
  latency_ms?: number
}

export interface AgentConversationEnd {
  type: 'conversation_ended'
  conversation_id: string
  total_turns: number
  duration_seconds: number
  transcript: AgentConversationTurn[]
}

export interface AgentModelMetrics {
  agent_label: string
  config_name: string
  provider: string
  components: Record<string, string>
  total_turns: number | null
  duration_seconds: number | null
  avg_latency_ms: number | null
  p50_latency_ms: number | null
  p95_latency_ms: number | null
  task_success: boolean | null
  joint_goal_accuracy: number | null
  containment: boolean | null
}

export interface AgentMetrics {
  status: string
  scenario_name: string | null
  metrics_a: AgentModelMetrics | null
  metrics_b: AgentModelMetrics | null
  automated_eval: Record<string, unknown> | null
}

export const api = {
  models: {
    list: (provider?: string) =>
      request<Model[]>(`/models${provider ? `?provider=${provider}` : ''}`),
    get: (id: string) => request<Model>(`/models/${id}`),
    create: (data: { name: string; provider: string; version?: string }) =>
      request<Model>('/models', { method: 'POST', body: JSON.stringify(data) }),
  },

  scenarios: {
    list: (category?: string) =>
      request<Scenario[]>(`/scenarios${category ? `?category=${category}` : ''}`),
    get: (id: string) => request<Scenario>(`/scenarios/${id}`),
  },

  evaluations: {
    get: (id: string) => request<EvalResult>(`/evaluations/${id}`),
    list: (params?: { model_id?: string; scenario_id?: string; status?: string }) => {
      const qs = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v) as [string, string][]
      ).toString();
      return request<EvalResult[]>(`/evaluations${qs ? `?${qs}` : ''}`);
    },
    submit: async (audio: File, modelId: string, scenarioId?: string) => {
      const form = new FormData();
      form.append('audio', audio);
      form.append('model_id', modelId);
      if (scenarioId) form.append('scenario_id', scenarioId);
      const res = await fetch(`${API_BASE}/evaluations`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json() as Promise<{ id: string; status: string }>;
    },
    stream: (evalId: string) => {
      return new WebSocket(`${getWsBaseUrl()}${API_BASE}/evaluations/${evalId}/stream`);
    },
  },

  battles: {
    list: (params?: { scenario_id?: string; model_id?: string }) => {
      const qs = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v) as [string, string][]
      ).toString();
      return request<Battle[]>(`/battles${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => request<Battle>(`/battles/${id}`),
    create: (data: { scenario_id: string; model_a_id: string; model_b_id: string }) =>
      request<Battle>('/battles', { method: 'POST', body: JSON.stringify(data) }),
    vote: (
      battleId: string,
      winner: 'a' | 'b' | 'c' | 'd' | 'tie' | 'all_bad',
      subVotes?: Record<string, string>,
    ) =>
      request<Battle>(`/battles/${battleId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ winner, ...(subVotes ? { sub_votes: subVotes } : {}) }),
      }),
    generate: (battleType: string = 'tts') =>
      request<GeneratedBattle>('/battles/generate', {
        method: 'POST',
        body: JSON.stringify({ battle_type: battleType }),
      }),
  },

  s2s: {
    setup: () =>
      request<S2SBattleSetup>('/battles/generate', {
        method: 'POST',
        body: JSON.stringify({ battle_type: 's2s' }),
      }),
    submitAudio: async (
      battleId: string,
      audio: Blob | null,
      curatedPromptId?: string,
    ): Promise<S2SBattleResult> => {
      const form = new FormData();
      if (audio) form.append('audio', audio, 'recording.webm');
      if (curatedPromptId) form.append('curated_prompt_id', curatedPromptId);
      const res = await fetch(`${API_BASE}/battles/${battleId}/input-audio`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json() as Promise<S2SBattleResult>;
    },
    getMetrics: (battleId: string) =>
      request<S2SMetrics>(`/battles/${battleId}/metrics`),
  },

  stt: {
    setup: () =>
      request<STTBattleSetup>('/battles/generate', {
        method: 'POST',
        body: JSON.stringify({ battle_type: 'stt' }),
      }),
    submitAudio: async (
      battleId: string,
      audio: Blob | null,
      curatedClipId?: string,
    ): Promise<STTBattleResult> => {
      const form = new FormData();
      if (audio) form.append('audio', audio, 'recording.webm');
      if (curatedClipId) form.append('curated_clip_id', curatedClipId);
      const res = await fetch(`${API_BASE}/battles/${battleId}/stt-transcribe`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json() as Promise<STTBattleResult>;
    },
    getMetrics: (battleId: string) =>
      request<STTMetrics>(`/battles/${battleId}/stt-metrics`),
  },

  agent: {
    setup: () =>
      request<AgentBattleSetup>('/battles/generate', {
        method: 'POST',
        body: JSON.stringify({ battle_type: 'agent' }),
      }),
    getMetrics: (battleId: string) =>
      request<AgentMetrics>(`/battles/${battleId}/agent-metrics`),
    getStreamUrl: (battleId: string, agent: 'a' | 'b') => {
      return `${getWsBaseUrl()}${API_BASE}/battles/${battleId}/agent-stream?agent=${agent}`
    },
  },

  tts: {
    generate: (modelId: string, text: string, engine?: string) =>
      request<TTSGenerateResponse>('/tts/generate', {
        method: 'POST',
        body: JSON.stringify({ model_id: modelId, text, ...(engine ? { engine } : {}) }),
      }),
  },

  prompts: {
    list: (category?: string) =>
      request<PromptItem[]>(`/prompts${category ? `?category=${category}` : ''}`),
  },

  leaderboard: {
    current: (battleType: string = 'tts') =>
      request<LeaderboardResponse>(`/leaderboard?battle_type=${battleType}`),
    history: (modelId?: string) =>
      request<{ model_id: string; model_name: string; elo_rating: number; snapshot_date: string }[]>(
        `/leaderboard/history${modelId ? `?model_id=${modelId}` : ''}`
      ),
  },

  analytics: {
    summary: () => request<AnalyticsSummary>('/analytics/summary'),
    correlations: () => request<{ count: number; metrics: Record<string, unknown>[] }>('/analytics/correlations'),
    voteDistribution: (battleType: string = 'tts') =>
      request<Record<string, number>>(`/analytics/vote-distribution?battle_type=${battleType}`),
    battleHistory: (params?: {
      battle_type?: string;
      model_id?: string;
      limit?: number;
      offset?: number;
    }) => {
      const qs = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString();
      return request<Record<string, unknown>[]>(`/analytics/battles${qs ? `?${qs}` : ''}`);
    },
    modelBreakdown: (modelId: string, battleType: string = 'tts') =>
      request<Record<string, unknown>>(`/analytics/model-breakdown/${modelId}?battle_type=${battleType}`),
    exportUrl: (params?: { battle_type?: string; format?: string }) => {
      const qs = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v != null) as [string, string][]
      ).toString();
      return `/api/v1/analytics/export${qs ? `?${qs}` : ''}`;
    },
  },
};

export async function isBackendAvailable(): Promise<boolean> {
  try {
    await fetch(`${API_BASE}/health`);
    return true;
  } catch {
    return false;
  }
}
