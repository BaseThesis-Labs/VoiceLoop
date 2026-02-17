// ============================================================
// Voice Loop Arena — Mock Data
// ============================================================

export interface Model {
  id: string
  name: string
  provider: string
  type: 'tts' | 'asr' | 's2s' | 'agent' | 'speech_llm'
  tier: 'model' | 'agent'
  isOpenSource: boolean
  arenaScore: number
  ciLower: number
  ciUpper: number
  totalBattles: number
  winRate: number
  metrics: Record<string, number>
  categories?: Record<string, number>
}

export interface Battle {
  id: string
  tier: 'model' | 'agent' | 'scenario'
  category: string
  modelA: string
  modelB: string
  winner: 'a' | 'b' | 'tie' | 'both_bad'
  scenarioName?: string
  timeAgo: string
}

export interface Scenario {
  id: string
  name: string
  description: string
  difficulty: number
  domain: string
  battlesRun: number
  avgDuration: string
  keyMetrics: string[]
  challengeVariants: string[]
}

export interface Prompt {
  id: string
  text: string
  category: string
}

// ---- Models (Tier 1) ----

export const models: Model[] = [
  {
    id: 'm1',
    name: 'Cartesia Sonic 3',
    provider: 'Cartesia',
    type: 'tts',
    tier: 'model',
    isOpenSource: false,
    arenaScore: 1205,
    ciLower: 1191,
    ciUpper: 1219,
    totalBattles: 2847,
    winRate: 0.68,
    metrics: { utmos: 4.34, nisqa: 4.18, wer: 2.8, ttfb: 130, secs: 0.91, dnsmos: 4.28, f0rmse: 9.7 },
    categories: { 'Customer Service': 0.71, 'Entertainment': 0.69, 'Knowledge': 0.65, 'Assistants': 0.67 },
  },
  {
    id: 'm2',
    name: 'ElevenLabs v3',
    provider: 'ElevenLabs',
    type: 'tts',
    tier: 'model',
    isOpenSource: false,
    arenaScore: 1189,
    ciLower: 1177,
    ciUpper: 1201,
    totalBattles: 3102,
    winRate: 0.64,
    metrics: { utmos: 4.21, nisqa: 4.05, wer: 3.2, ttfb: 180, secs: 0.87, dnsmos: 4.12, f0rmse: 12.4 },
    categories: { 'Customer Service': 0.68, 'Entertainment': 0.71, 'Knowledge': 0.59, 'Assistants': 0.62 },
  },
  {
    id: 'm3',
    name: 'Sesame CSM-1B',
    provider: 'Sesame',
    type: 'tts',
    tier: 'model',
    isOpenSource: true,
    arenaScore: 1178,
    ciLower: 1162,
    ciUpper: 1194,
    totalBattles: 1893,
    winRate: 0.61,
    metrics: { utmos: 4.38, nisqa: 4.22, wer: 3.1, ttfb: 250, secs: 0.89, dnsmos: 4.31, f0rmse: 8.2 },
    categories: { 'Customer Service': 0.62, 'Entertainment': 0.66, 'Knowledge': 0.58, 'Assistants': 0.60 },
  },
  {
    id: 'm4',
    name: 'OpenAI TTS-1 HD',
    provider: 'OpenAI',
    type: 'tts',
    tier: 'model',
    isOpenSource: false,
    arenaScore: 1167,
    ciLower: 1156,
    ciUpper: 1178,
    totalBattles: 4201,
    winRate: 0.57,
    metrics: { utmos: 4.15, nisqa: 3.98, wer: 3.5, ttfb: 210, secs: 0.84, dnsmos: 4.08, f0rmse: 14.1 },
    categories: { 'Customer Service': 0.59, 'Entertainment': 0.55, 'Knowledge': 0.61, 'Assistants': 0.58 },
  },
  {
    id: 'm5',
    name: 'MiniMax Speech-02',
    provider: 'MiniMax',
    type: 'tts',
    tier: 'model',
    isOpenSource: false,
    arenaScore: 1134,
    ciLower: 1123,
    ciUpper: 1145,
    totalBattles: 2156,
    winRate: 0.52,
    metrics: { utmos: 4.08, nisqa: 3.92, wer: 3.8, ttfb: 190, secs: 0.82, dnsmos: 3.95, f0rmse: 15.3 },
    categories: { 'Customer Service': 0.54, 'Entertainment': 0.52, 'Knowledge': 0.50, 'Assistants': 0.53 },
  },
  {
    id: 'm6',
    name: 'GPT-4o Audio',
    provider: 'OpenAI',
    type: 's2s',
    tier: 'model',
    isOpenSource: false,
    arenaScore: 1198,
    ciLower: 1180,
    ciUpper: 1216,
    totalBattles: 1567,
    winRate: 0.66,
    metrics: { utmos: 4.28, nisqa: 4.10, wer: 2.5, ttfb: 320, secs: 0.85, dnsmos: 4.19, f0rmse: 11.0 },
    categories: { 'Customer Service': 0.70, 'Entertainment': 0.64, 'Knowledge': 0.68, 'Assistants': 0.66 },
  },
  {
    id: 'm7',
    name: 'Whisper Large v3',
    provider: 'OpenAI',
    type: 'asr',
    tier: 'model',
    isOpenSource: true,
    arenaScore: 1215,
    ciLower: 1201,
    ciUpper: 1229,
    totalBattles: 3890,
    winRate: 0.71,
    metrics: { wer: 2.1, cer: 1.4, ttfb: 95, robustWer: 5.8 },
    categories: { 'Clean Speech': 0.78, 'Noisy': 0.65, 'Accented': 0.62, 'Multilingual': 0.70 },
  },
  {
    id: 'm8',
    name: 'Deepgram Nova-3',
    provider: 'Deepgram',
    type: 'asr',
    tier: 'model',
    isOpenSource: false,
    arenaScore: 1192,
    ciLower: 1178,
    ciUpper: 1206,
    totalBattles: 2934,
    winRate: 0.63,
    metrics: { wer: 2.6, cer: 1.8, ttfb: 45, robustWer: 6.2 },
    categories: { 'Clean Speech': 0.72, 'Noisy': 0.61, 'Accented': 0.58, 'Multilingual': 0.55 },
  },
]

// ---- Agents (Tier 2) ----

export const agents: Model[] = [
  {
    id: 'a1',
    name: 'Vapi + GPT-4o',
    provider: 'Vapi',
    type: 'agent',
    tier: 'agent',
    isOpenSource: false,
    arenaScore: 1198,
    ciLower: 1182,
    ciUpper: 1214,
    totalBattles: 1247,
    winRate: 0.71,
    metrics: { taskCompletion: 91, medianLatency: 420, bargeIn: 0.87, humanPref: 71, ttfb: 380 },
    categories: { 'Transactional': 0.74, 'Informational': 0.72, 'Empathetic': 0.65, 'Multilingual': 0.58 },
  },
  {
    id: 'a2',
    name: 'Retell AI Pro',
    provider: 'Retell',
    type: 'agent',
    tier: 'agent',
    isOpenSource: false,
    arenaScore: 1182,
    ciLower: 1168,
    ciUpper: 1196,
    totalBattles: 1089,
    winRate: 0.65,
    metrics: { taskCompletion: 88, medianLatency: 380, bargeIn: 0.92, humanPref: 65, ttfb: 340 },
    categories: { 'Transactional': 0.68, 'Informational': 0.67, 'Empathetic': 0.62, 'Multilingual': 0.55 },
  },
  {
    id: 'a3',
    name: 'Bland AI v2',
    provider: 'Bland',
    type: 'agent',
    tier: 'agent',
    isOpenSource: false,
    arenaScore: 1156,
    ciLower: 1140,
    ciUpper: 1172,
    totalBattles: 987,
    winRate: 0.58,
    metrics: { taskCompletion: 85, medianLatency: 510, bargeIn: 0.78, humanPref: 58, ttfb: 480 },
    categories: { 'Transactional': 0.62, 'Informational': 0.60, 'Empathetic': 0.54, 'Multilingual': 0.48 },
  },
  {
    id: 'a4',
    name: 'LiveKit Agents',
    provider: 'LiveKit',
    type: 'agent',
    tier: 'agent',
    isOpenSource: true,
    arenaScore: 1143,
    ciLower: 1125,
    ciUpper: 1161,
    totalBattles: 756,
    winRate: 0.54,
    metrics: { taskCompletion: 82, medianLatency: 350, bargeIn: 0.91, humanPref: 54, ttfb: 310 },
    categories: { 'Transactional': 0.56, 'Informational': 0.58, 'Empathetic': 0.49, 'Multilingual': 0.52 },
  },
  {
    id: 'a5',
    name: 'Ultravox + Claude',
    provider: 'Fixie',
    type: 'agent',
    tier: 'agent',
    isOpenSource: false,
    arenaScore: 1171,
    ciLower: 1153,
    ciUpper: 1189,
    totalBattles: 634,
    winRate: 0.62,
    metrics: { taskCompletion: 89, medianLatency: 460, bargeIn: 0.83, humanPref: 62, ttfb: 420 },
    categories: { 'Transactional': 0.65, 'Informational': 0.70, 'Empathetic': 0.60, 'Multilingual': 0.53 },
  },
]

// ---- Recent Battles ----

export const recentBattles: Battle[] = [
  { id: 'b1', tier: 'model', category: 'TTS Naturalness', modelA: 'Cartesia Sonic 3', modelB: 'ElevenLabs v3', winner: 'a', timeAgo: '2m ago' },
  { id: 'b2', tier: 'agent', category: 'Restaurant Booking', modelA: 'Vapi + GPT-4o', modelB: 'Retell AI Pro', winner: 'tie', scenarioName: 'Restaurant Booking', timeAgo: '5m ago' },
  { id: 'b3', tier: 'model', category: 'ASR Robustness', modelA: 'Whisper Large v3', modelB: 'Deepgram Nova-3', winner: 'a', timeAgo: '8m ago' },
  { id: 'b4', tier: 'scenario', category: 'Medical Intake', modelA: 'Vapi + GPT-4o', modelB: 'Bland AI v2', winner: 'a', scenarioName: 'Medical Intake', timeAgo: '12m ago' },
  { id: 'b5', tier: 'model', category: 'TTS Expressiveness', modelA: 'Sesame CSM-1B', modelB: 'OpenAI TTS-1 HD', winner: 'a', timeAgo: '15m ago' },
  { id: 'b6', tier: 'agent', category: 'Technical Support', modelA: 'Ultravox + Claude', modelB: 'LiveKit Agents', winner: 'a', timeAgo: '18m ago' },
  { id: 'b7', tier: 'model', category: 'S2S Conversational', modelA: 'GPT-4o Audio', modelB: 'Sesame CSM-1B', winner: 'b', timeAgo: '22m ago' },
  { id: 'b8', tier: 'scenario', category: 'Financial Advisory', modelA: 'Retell AI Pro', modelB: 'Vapi + GPT-4o', winner: 'b', scenarioName: 'Financial Advisory', timeAgo: '28m ago' },
]

// ---- Scenarios ----

export const scenarios: Scenario[] = [
  {
    id: 's1',
    name: 'Medical Intake',
    description: 'Simulate a medical office intake call. The AI must collect patient demographics, symptoms, medication history, and insurance information.',
    difficulty: 4,
    domain: 'Healthcare',
    battlesRun: 847,
    avgDuration: '2m 40s',
    keyMetrics: ['Entity WER', 'HIPAA compliance', 'Empathy score', 'Task completion'],
    challengeVariants: [
      'Standard intake (clear speech, native English)',
      'Accented speech (South Asian English)',
      'Background noise (hospital ambient, 40dB)',
      'Emotional distress (crying patient)',
      'Code-switching (Spanish/English bilingual)',
      'Elderly speaker (slow speech, repetitions)',
      'Medical jargon stress test (rare conditions)',
    ],
  },
  {
    id: 's2',
    name: 'Restaurant Booking',
    description: 'Book dinner for a party with specific seating and dietary requirements. Tests entity extraction, preference handling, and conversational efficiency.',
    difficulty: 2,
    domain: 'Hospitality',
    battlesRun: 1203,
    avgDuration: '1m 50s',
    keyMetrics: ['Entity accuracy', 'Task completion', 'Conversational efficiency', 'Politeness'],
    challengeVariants: [
      'Standard booking (4 guests, Saturday evening)',
      'Dietary restrictions (vegetarian + gluten-free)',
      'Mid-conversation change ("actually, make it 5")',
      'Background noise (restaurant ambient)',
      'Rush request ("can we get a table in 30 minutes?")',
    ],
  },
  {
    id: 's3',
    name: 'Financial Advisory',
    description: 'Help user understand 401k rollover options. Tests financial terminology accuracy, appropriate disclaimers, and complex reasoning.',
    difficulty: 4,
    domain: 'Finance',
    battlesRun: 623,
    avgDuration: '3m 10s',
    keyMetrics: ['Terminology accuracy', 'Disclaimer compliance', 'Hallucination rate', 'Clarity'],
    challengeVariants: [
      'Standard rollover inquiry',
      'Complex multi-step reasoning',
      'User says "I don\'t understand"',
      'Comparison of multiple options',
      'Tax implications discussion',
    ],
  },
  {
    id: 's4',
    name: 'Technical Support',
    description: 'Troubleshoot customer internet connectivity. Tests systematic diagnosis, clear instruction delivery, and escalation handling.',
    difficulty: 3,
    domain: 'Technology',
    battlesRun: 534,
    avgDuration: '2m 20s',
    keyMetrics: ['Diagnosis accuracy', 'Instruction clarity', 'Escalation handling', 'Patience'],
    challengeVariants: [
      'Standard connectivity issue',
      'Frustrated caller',
      'Multiple simultaneous issues',
      'Insufficient information from caller',
      'Non-technical user',
    ],
  },
  {
    id: 's5',
    name: 'Adversarial Robustness',
    description: 'Test system behavior under adversarial conditions including prompt injection, noise, fast speech, and contradictions.',
    difficulty: 5,
    domain: 'Security',
    battlesRun: 312,
    avgDuration: '2m 00s',
    keyMetrics: ['Injection resistance', 'Noise tolerance', 'Contradiction handling', 'Safety score'],
    challengeVariants: [
      'Prompt injection via voice',
      'Background adversarial noise',
      'Extremely fast speech',
      'Unintelligible mumbling',
      'Deliberate contradictions',
    ],
  },
  {
    id: 's6',
    name: 'Multilingual Switching',
    description: 'Handle a conversation that transitions between 2-3 languages mid-conversation. Tests language detection and context maintenance.',
    difficulty: 5,
    domain: 'Languages',
    battlesRun: 289,
    avgDuration: '2m 30s',
    keyMetrics: ['Language detection accuracy', 'Context retention', 'Code-switch latency', 'Fluency'],
    challengeVariants: [
      'English to Spanish transition',
      'English to Mandarin transition',
      'Three-language conversation',
      'Rapid switching (every turn)',
      'Mixed-language utterances',
    ],
  },
]

// ---- Battle Prompts ----

export const battlePrompts: Prompt[] = [
  {
    id: 'p1',
    text: 'Explain to a customer that their flight has been delayed by 3 hours due to weather, and offer rebooking options.',
    category: 'Customer Service',
  },
  {
    id: 'p2',
    text: "I understand your frustration with the billing error. I've identified the duplicate charge of $47.99 and initiated a refund that will appear in 3-5 business days.",
    category: 'Customer Service',
  },
  {
    id: 'p3',
    text: "I'm so sorry for your loss. Please know that our entire team is here to support you during this difficult time. We've waived all cancellation fees.",
    category: 'Emotional Range',
  },
  {
    id: 'p4',
    text: 'Your hemoglobin A1C came back at 6.8 percent, which is slightly above our target of 6.5. I recommend we discuss adjusting your Metformin dosage.',
    category: 'Technical Precision',
  },
  {
    id: 'p5',
    text: 'The S&P 500 closed at 6,852.34, up 19.91, or 0.29 percent. The Nasdaq composite gained 1.2 percent, led by semiconductor stocks.',
    category: 'Technical Precision',
  },
]

// ---- Arena Stats ----

export const arenaStats = {
  totalBattles: 12847,
  totalModels: 94,
  totalAgents: 37,
  totalScenarios: 6,
  totalVotes: 47293,
  uniqueVoters: 8412,
  avgBattlesPerVoter: 5.6,
  interRaterAgreement: 0.73,
}

// ---- Correlation data for Analytics ----

export const metricCorrelations = [
  { metric: 'NISQA', pearson: 0.71, label: 'Perceptual quality' },
  { metric: 'UTMOS', pearson: 0.67, label: 'Neural MOS' },
  { metric: 'DNSMOS', pearson: 0.64, label: 'DNS MOS' },
  { metric: 'Latency (inv)', pearson: 0.58, label: 'Response speed' },
  { metric: 'WER (inv)', pearson: 0.52, label: 'Transcription accuracy' },
  { metric: 'SECS', pearson: 0.44, label: 'Speaker similarity' },
]

// ---- Fairness data ----

export const fairnessData = [
  { model: 'Whisper Large v3', genAm: 3.1, aae: 5.8, indian: 7.2, latAm: 4.9, faas: 'Moderately Fair' },
  { model: 'Deepgram Nova-3', genAm: 2.9, aae: 4.2, indian: 6.1, latAm: 4.5, faas: 'Fair' },
  { model: 'AssemblyAI Universal-2', genAm: 3.4, aae: 8.7, indian: 5.3, latAm: 3.8, faas: 'Severely Biased' },
]

// ---- Leaderboard history (for sparklines) ----

export const scoreHistory = [
  { day: 1, m1: 1160, m2: 1180, m3: 1150 },
  { day: 5, m1: 1168, m2: 1178, m3: 1155 },
  { day: 10, m1: 1175, m2: 1182, m3: 1162 },
  { day: 15, m1: 1185, m2: 1185, m3: 1170 },
  { day: 20, m1: 1195, m2: 1190, m3: 1175 },
  { day: 25, m1: 1200, m2: 1188, m3: 1178 },
  { day: 30, m1: 1205, m2: 1189, m3: 1178 },
]
