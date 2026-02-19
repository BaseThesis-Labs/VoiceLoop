const API_BASE = '/api/v1';

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
  vote_source: string | null;
  elo_delta: number | null;
  created_at: string;
}

export interface LeaderboardEntry {
  model_id: string;
  model_name: string;
  provider: string;
  elo_rating: number;
  win_rate: number;
  total_battles: number;
  avg_wer: number | null;
  avg_semascore: number | null;
  avg_prosody: number | null;
  avg_quality: number | null;
  rank: number;
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
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return new WebSocket(`${protocol}//${window.location.host}${API_BASE}/evaluations/${evalId}/stream`);
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
    vote: (battleId: string, winner: 'a' | 'b' | 'c' | 'd' | 'tie' | 'all_bad') =>
      request<Battle>(`/battles/${battleId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ winner }),
      }),
    generate: () =>
      request<GeneratedBattle>('/battles/generate', { method: 'POST' }),
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
    current: () => request<LeaderboardEntry[]>('/leaderboard'),
    history: (modelId?: string) =>
      request<{ model_id: string; model_name: string; elo_rating: number; snapshot_date: string }[]>(
        `/leaderboard/history${modelId ? `?model_id=${modelId}` : ''}`
      ),
  },

  analytics: {
    summary: () => request<AnalyticsSummary>('/analytics/summary'),
    correlations: () => request<{ count: number; metrics: Record<string, unknown>[] }>('/analytics/correlations'),
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
