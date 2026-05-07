import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bot, ChevronLeft, ChevronRight, Loader2, Plus, Save, Send, User } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/contexts/SettingsContext';
import { useBotpressClient } from '@/hooks/useBotpressClient';
import { fetchCognitiveModels, generateTextWithCognitiveApi } from '@/lib/cognitiveApi';
import { cn } from '@/lib/utils';
import {
  getPromptSelectionKey,
  normalizePromptRow,
  partitionPromptRows,
  type PromptRow,
} from '@/lib/promptVersions';
import type {
  ChatTurn,
  CognitiveModel,
  LocalChatMessage,
  ModelResponse,
  PerModelHistory,
} from '@/types/modelTesting';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const TABLE_NAME = 'promptsTable';
const ALLOWED_PROMPT_BOTS = new Set(['fr', 'de', 'es']);
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 1200;
const MODEL_TESTING_STORAGE_KEY = 'model-testing-config-v4';
const THINKING_OPTIONS = ['none', 'low', 'medium', 'high', 'dynamic'] as const;
const STATIC_THINKING_OPTIONS = ['low', 'medium', 'high'] as const;

type ThinkingOption = (typeof THINKING_OPTIONS)[number];
type StaticThinkingOption = (typeof STATIC_THINKING_OPTIONS)[number];
type ModeKey = 'single' | 'compare';

type ModeSnapshot = {
  thinking: ThinkingOption;
  staticThinking: StaticThinkingOption;
  temperature: number;
  selectedProviderA: string;
  selectedProviderB: string;
  selectedModelA: string;
  selectedModelB: string;
  selectedPromptKey: string;
  turns: ChatTurn[];
  singleHistory: LocalChatMessage[];
  compareHistory: PerModelHistory;
};

type SavedBotState = {
  currentMode: ModeKey;
  modes: Partial<Record<ModeKey, ModeSnapshot>>;
};

function getProviderFromModelId(modelId: string) {
  return modelId.split(':')[0] || 'other';
}

function getProviderLabel(provider: string) {
  switch (provider) {
    case 'openai':
      return 'OpenAI';
    case 'anthropic':
      return 'Anthropic';
    case 'google-ai':
      return 'Google';
    case 'xai':
      return 'xAI';
    case 'mistral':
      return 'Mistral';
    case 'fireworks-ai':
      return 'Fireworks';
    default:
      return provider;
  }
}

function getPrettyModelName(model?: CognitiveModel | null) {
  if (!model) {
    return 'Modele';
  }

  if (model.name?.trim()) {
    return model.name.trim();
  }

  const parts = model.id.split(':');
  return parts[1] || model.id;
}

function clampPushTemperature(value: number) {
  return Math.min(1, Math.max(0, value));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function readSavedConfigs() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(MODEL_TESTING_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readSavedBotState(botId: string): SavedBotState | null {
  const config = readSavedConfigs()[botId];
  if (!config || typeof config !== 'object') {
    return null;
  }

  // Backward compatibility with the previous flat shape.
  if ('selectedModelA' in config) {
    const legacyMode: ModeKey = config.comparisonEnabled ? 'compare' : 'single';
    return {
      currentMode: legacyMode,
      modes: {
        [legacyMode]: {
          thinking: THINKING_OPTIONS.includes(config.thinking) ? config.thinking : 'medium',
          staticThinking: STATIC_THINKING_OPTIONS.includes(config.staticThinking) ? config.staticThinking : 'medium',
          temperature:
            typeof config.temperature === 'number' && Number.isFinite(config.temperature)
              ? config.temperature
              : DEFAULT_TEMPERATURE,
          selectedProviderA: typeof config.selectedProviderA === 'string' ? config.selectedProviderA : '',
          selectedProviderB: typeof config.selectedProviderB === 'string' ? config.selectedProviderB : '',
          selectedModelA: typeof config.selectedModelA === 'string' ? config.selectedModelA : '',
          selectedModelB: typeof config.selectedModelB === 'string' ? config.selectedModelB : '',
          selectedPromptKey: typeof config.selectedPromptKey === 'string' ? config.selectedPromptKey : '',
          turns: [],
          singleHistory: [],
          compareHistory: { modelA: [], modelB: [] },
        },
      },
    };
  }

  const modes = config.modes && typeof config.modes === 'object' ? config.modes : {};
  const normalizeModeSnapshot = (snapshot: any): ModeSnapshot => ({
    thinking: THINKING_OPTIONS.includes(snapshot?.thinking) ? snapshot.thinking : 'medium',
    staticThinking: STATIC_THINKING_OPTIONS.includes(snapshot?.staticThinking) ? snapshot.staticThinking : 'medium',
    temperature:
      typeof snapshot?.temperature === 'number' && Number.isFinite(snapshot.temperature)
        ? snapshot.temperature
        : DEFAULT_TEMPERATURE,
    selectedProviderA: typeof snapshot?.selectedProviderA === 'string' ? snapshot.selectedProviderA : '',
    selectedProviderB: typeof snapshot?.selectedProviderB === 'string' ? snapshot.selectedProviderB : '',
    selectedModelA: typeof snapshot?.selectedModelA === 'string' ? snapshot.selectedModelA : '',
    selectedModelB: typeof snapshot?.selectedModelB === 'string' ? snapshot.selectedModelB : '',
    selectedPromptKey: typeof snapshot?.selectedPromptKey === 'string' ? snapshot.selectedPromptKey : '',
    turns: Array.isArray(snapshot?.turns) ? snapshot.turns : [],
    singleHistory: Array.isArray(snapshot?.singleHistory) ? snapshot.singleHistory : [],
    compareHistory:
      snapshot?.compareHistory && typeof snapshot.compareHistory === 'object'
        ? {
            modelA: Array.isArray(snapshot.compareHistory.modelA) ? snapshot.compareHistory.modelA : [],
            modelB: Array.isArray(snapshot.compareHistory.modelB) ? snapshot.compareHistory.modelB : [],
          }
        : { modelA: [], modelB: [] },
  });

  return {
    currentMode: config.currentMode === 'single' ? 'single' : 'compare',
    modes: {
      single: modes.single ? normalizeModeSnapshot(modes.single) : undefined,
      compare: modes.compare ? normalizeModeSnapshot(modes.compare) : undefined,
    },
  };
}

function writeSavedBotState(botId: string, state: SavedBotState) {
  if (typeof window === 'undefined') {
    return;
  }

  const currentConfigs = readSavedConfigs();
  window.localStorage.setItem(
    MODEL_TESTING_STORAGE_KEY,
    JSON.stringify({
      ...currentConfigs,
      [botId]: state,
    })
  );
}

function getPromptBySelectionKey(
  prompts: ReturnType<typeof partitionPromptRows>,
  selectionKey: string | null
) {
  if (!selectionKey) {
    return null;
  }

  if (selectionKey === 'live') {
    return prompts.live;
  }

  if (selectionKey === 'testing') {
    return prompts.testing;
  }

  if (selectionKey.startsWith('legacy:')) {
    const promptId = Number(selectionKey.split(':')[1]);
    return prompts.legacy.find((prompt) => prompt.id === promptId) ?? null;
  }

  return null;
}

function getDefaultPromptSelectionKey(prompts: ReturnType<typeof partitionPromptRows>) {
  if (prompts.testing) {
    return 'testing';
  }

  if (prompts.live) {
    return 'live';
  }

  if (prompts.legacy[0]) {
    return getPromptSelectionKey(prompts.legacy[0]);
  }

  return '';
}

function formatTime(isoDate: string) {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function latencyLabel(latencyMs: number) {
  return `${(latencyMs / 1000).toFixed(1).replace('.', ',')} s`;
}

function costLabel(usage?: ModelResponse['usage']) {
  if (!usage) {
    return null;
  }

  const total = (usage.inputCost || 0) + (usage.outputCost || 0);
  if (!total) {
    return null;
  }

  return `${total.toFixed(3).replace('.', ',')} $`;
}

function buildModelResponse(params: {
  modelId: string;
  result?: Awaited<ReturnType<typeof generateTextWithCognitiveApi>>;
  error?: string;
}): ModelResponse {
  const { modelId, result, error } = params;

  if (error) {
    return {
      modelId,
      text: '',
      error,
      latencyMs: result?.latencyMs ?? 0,
      usage: result?.usage ?? null,
    };
  }

  return {
    modelId,
    text: result?.text ?? '',
    latencyMs: result?.latencyMs ?? 0,
    usage: result?.usage ?? null,
  };
}

function Toggle({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-blue-600' : 'bg-slate-300'
      )}
    >
      <span
        className={cn(
          'inline-block size-5 rounded-full bg-white transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

function UserMessageCard({ text, createdAt }: { text: string; createdAt: string }) {
  return (
    <div className="border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600">
            <User className="size-4" />
          </div>
          <span className="text-sm font-medium text-slate-800">User</span>
        </div>
        <span className="text-xs text-slate-400">{formatTime(createdAt)}</span>
      </div>

      <div className="border border-blue-100 bg-blue-50/70 px-4 py-4 text-[15px] leading-7 text-slate-800">
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

function ResponseCard({
  response,
  title,
  accentClassName,
}: {
  response: ModelResponse;
  title: string;
  accentClassName: string;
}) {
  const cost = costLabel(response.usage);

  return (
    <div className="border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn('size-3 shrink-0 rounded-full', accentClassName)} />
          <span className="truncate text-sm font-medium text-slate-900">{title}</span>
        </div>
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
          {getProviderLabel(getProviderFromModelId(response.modelId))}
        </Badge>
      </div>

      <div className="px-4 pb-4">
        {response.error ? (
          <div className="border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-700">
            {response.error}
          </div>
        ) : response.pending ? (
          <div className="min-h-[280px] py-2 text-[15px] leading-7 text-slate-500">
            <div className="inline-flex items-center gap-2">
              <span>Thinking</span>
              <span className="inline-flex gap-1">
                <span className="size-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:0ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        ) : (
          <div className="min-h-[280px] text-[15px] leading-7 text-slate-800">
            <p className="whitespace-pre-wrap">{response.text || '[Empty response]'}</p>
          </div>
        )}
      </div>

      <div className="px-4 pb-4 text-sm text-slate-500">
        <span>{cost ? `Cost ${cost}` : 'Cost -'}</span>
        <span className="mx-2">·</span>
        <span>Time {latencyLabel(response.latencyMs)}</span>
      </div>
    </div>
  );
}

export default function ModelTesting() {
  const { settings } = useSettings();
  const promptBots = useMemo(
    () => settings.bots.filter((bot) => ALLOWED_PROMPT_BOTS.has(bot.id) && bot.botId),
    [settings.bots]
  );

  const [selectedBotId, setSelectedBotId] = useState('');
  const [models, setModels] = useState<CognitiveModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [selectedProviderA, setSelectedProviderA] = useState('');
  const [selectedProviderB, setSelectedProviderB] = useState('');
  const [selectedModelA, setSelectedModelA] = useState('');
  const [selectedModelB, setSelectedModelB] = useState('');
  const [comparisonEnabled, setComparisonEnabled] = useState(true);
  const [thinking, setThinking] = useState<ThinkingOption>('medium');
  const [staticThinking, setStaticThinking] = useState<StaticThinkingOption>('medium');
  const [temperature, setTemperature] = useState<number>(DEFAULT_TEMPERATURE);

  const [promptRows, setPromptRows] = useState<PromptRow[]>([]);
  const [selectedPromptKey, setSelectedPromptKey] = useState('');

  const [configSaved, setConfigSaved] = useState(true);
  const configBootedRef = useRef(false);
  const restoringConfigRef = useRef(false);

  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [pushModelId, setPushModelId] = useState('');
  const [pushTemperature, setPushTemperature] = useState(String(DEFAULT_TEMPERATURE));
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  const hydratedBotIdRef = useRef<string | null>(null);

  const [userMessage, setUserMessage] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [singleHistory, setSingleHistory] = useState<LocalChatMessage[]>([]);
  const [compareHistory, setCompareHistory] = useState<PerModelHistory>({ modelA: [], modelB: [] });
  const [running, setRunning] = useState(false);

  const client = useBotpressClient(selectedBotId);
  const prompts = useMemo(() => partitionPromptRows(promptRows), [promptRows]);
  const selectedPrompt = useMemo(
    () => getPromptBySelectionKey(prompts, selectedPromptKey),
    [prompts, selectedPromptKey]
  );
  const promptOptions = useMemo(() => {
    const options: Array<{ key: string; label: string; version: PromptRow['version'] }> = [];

    if (prompts.testing) {
      options.push({
        key: 'testing',
        label: prompts.testing.label || 'Testing draft',
        version: 'testing',
      });
    }

    if (prompts.live) {
      options.push({
        key: 'live',
        label: prompts.live.label || 'Prompt live',
        version: 'live',
      });
    }

    prompts.legacy.slice(0, 3).forEach((prompt) => {
      options.push({
        key: getPromptSelectionKey(prompt),
        label: prompt.label || `Prompt ${prompt.id}`,
        version: 'legacy',
      });
    });

    return options;
  }, [prompts]);
  const providers = useMemo(() => {
    const values = new Set<string>();
    models.forEach((model) => values.add(getProviderFromModelId(model.id)));
    return Array.from(values);
  }, [models]);
  const modelsForProviderA = useMemo(
    () => models.filter((model) => getProviderFromModelId(model.id) === selectedProviderA),
    [models, selectedProviderA]
  );
  const modelsForProviderB = useMemo(
    () => models.filter((model) => getProviderFromModelId(model.id) === selectedProviderB),
    [models, selectedProviderB]
  );
  const selectedModelAData = useMemo(
    () => models.find((model) => model.id === selectedModelA) ?? null,
    [models, selectedModelA]
  );
  const selectedModelBData = useMemo(
    () => models.find((model) => model.id === selectedModelB) ?? null,
    [models, selectedModelB]
  );
  const selectedBot = useMemo(
    () => promptBots.find((bot) => bot.botId === selectedBotId) ?? null,
    [promptBots, selectedBotId]
  );
  const currentMode = comparisonEnabled ? 'compare' : 'single';

  function buildModeSnapshot(): ModeSnapshot {
    return {
      thinking,
      staticThinking,
      temperature,
      selectedProviderA,
      selectedProviderB,
      selectedModelA,
      selectedModelB,
      selectedPromptKey,
      turns,
      singleHistory,
      compareHistory,
    };
  }

  function applyModeSnapshot(mode: ModeKey, snapshot?: ModeSnapshot) {
    const fallbackProviderA = selectedProviderA;
    const fallbackProviderB = selectedProviderB;
    const fallbackModelA = selectedModelA;
    const fallbackModelB = selectedModelB;
    const fallbackPromptKey = selectedPromptKey;
    const fallbackThinking = thinking;
    const fallbackStaticThinking = staticThinking;
    const fallbackTemperature = temperature;

    restoringConfigRef.current = true;
    configBootedRef.current = false;
    setComparisonEnabled(mode === 'compare');
    setThinking(snapshot?.thinking ?? fallbackThinking);
    setStaticThinking(snapshot?.staticThinking ?? fallbackStaticThinking);
    setTemperature(snapshot?.temperature ?? fallbackTemperature);
    setSelectedProviderA(snapshot?.selectedProviderA ?? fallbackProviderA);
    setSelectedProviderB(snapshot?.selectedProviderB ?? fallbackProviderB);
    setSelectedModelA(snapshot?.selectedModelA ?? fallbackModelA);
    setSelectedModelB(snapshot?.selectedModelB ?? fallbackModelB);
    setSelectedPromptKey(snapshot?.selectedPromptKey ?? fallbackPromptKey);
    setTurns(snapshot?.turns ?? []);
    setSingleHistory(snapshot?.singleHistory ?? []);
    setCompareHistory(snapshot?.compareHistory ?? { modelA: [], modelB: [] });
    setUserMessage('');
  }

  function persistCurrentMode(targetMode?: ModeKey) {
    if (!selectedBotId) {
      return;
    }

    const existingState = readSavedBotState(selectedBotId);
    const modeToPersist = targetMode ?? currentMode;
    const nextState: SavedBotState = {
      currentMode: modeToPersist,
      modes: {
        ...(existingState?.modes ?? {}),
        [modeToPersist]: buildModeSnapshot(),
      },
    };

    writeSavedBotState(selectedBotId, nextState);
  }

  function persistModeConversation(
    mode: ModeKey,
    chatState: Pick<ModeSnapshot, 'turns' | 'singleHistory' | 'compareHistory'>
  ) {
    if (!selectedBotId) {
      return;
    }

    const existingState = readSavedBotState(selectedBotId);
    const baseSnapshot = existingState?.modes?.[mode] ?? buildModeSnapshot();

    writeSavedBotState(selectedBotId, {
      currentMode: mode === currentMode ? mode : existingState?.currentMode ?? currentMode,
      modes: {
        ...(existingState?.modes ?? {}),
        [mode]: {
          ...baseSnapshot,
          turns: chatState.turns,
          singleHistory: chatState.singleHistory,
          compareHistory: chatState.compareHistory,
        },
      },
    });
  }

  useEffect(() => {
    if (!selectedBotId && promptBots[0]) {
      setSelectedBotId(promptBots[0].botId);
    }
  }, [promptBots, selectedBotId]);

  useEffect(() => {
    if (!selectedBotId || !settings.token) {
      return;
    }

    let cancelled = false;

    const loadModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const nextModels = await fetchCognitiveModels(settings.token, selectedBotId);
        if (!cancelled) {
          setModels(nextModels);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading cognitive models:', error);
          setModelsError(getErrorMessage(error, 'Failed to load models'));
          toast.error('Failed to load cognitive models');
        }
      } finally {
        if (!cancelled) {
          setModelsLoading(false);
        }
      }
    };

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, [selectedBotId, settings.token]);

  useEffect(() => {
    if (!client || !selectedBotId) {
      return;
    }

    let cancelled = false;

    const loadPrompts = async () => {
      try {
        const response = await client.findTableRows({
          table: TABLE_NAME,
          limit: 100,
          orderBy: 'updatedAt',
          orderDirection: 'desc',
        });

        if (!cancelled) {
          const rows = response.rows.map((row: Record<string, unknown>) => normalizePromptRow(row));
          setPromptRows(rows);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading prompts:', error);
          toast.error('Failed to load prompts');
        }
      }
    };

    void loadPrompts();

    return () => {
      cancelled = true;
    };
  }, [client, selectedBotId]);

  useEffect(() => {
    setUserMessage('');
    hydratedBotIdRef.current = null;
  }, [selectedBotId]);

  useEffect(() => {
    if (!selectedBotId) {
      return;
    }

    const savedState = readSavedBotState(selectedBotId);
    restoringConfigRef.current = true;
    configBootedRef.current = false;

    if (savedState) {
      applyModeSnapshot(savedState.currentMode, savedState.modes[savedState.currentMode]);
    } else {
      setComparisonEnabled(true);
      setThinking('medium');
      setStaticThinking('medium');
      setTemperature(DEFAULT_TEMPERATURE);
      setSelectedProviderA('');
      setSelectedProviderB('');
      setSelectedModelA('');
      setSelectedModelB('');
      setSelectedPromptKey('');
      setTurns([]);
      setSingleHistory([]);
      setCompareHistory({ modelA: [], modelB: [] });
      setUserMessage('');
    }

    setConfigSaved(true);
  }, [selectedBotId]);

  useEffect(() => {
    if (!models.length) {
      setSelectedModelA('');
      setSelectedModelB('');
      return;
    }

    if (!selectedModelA || !models.some((model) => model.id === selectedModelA)) {
      const recommended = models.find((model) => model.tags?.includes('recommended')) ?? models[0];
      setSelectedModelA(recommended.id);
      setSelectedProviderA(getProviderFromModelId(recommended.id));
    }

    if (!selectedModelB || !models.some((model) => model.id === selectedModelB)) {
      const firstModelId = selectedModelA || models[0].id;
      const fallback = models.find((model) => model.id !== firstModelId) ?? models[0];
      setSelectedModelB(fallback.id);
      setSelectedProviderB(getProviderFromModelId(fallback.id));
    }
  }, [models, selectedModelA, selectedModelB]);

  useEffect(() => {
    if (!selectedBotId || !models.length || hydratedBotIdRef.current === selectedBotId) {
      return;
    }

    const savedState = readSavedBotState(selectedBotId);
    hydratedBotIdRef.current = selectedBotId;

    if (!savedState) {
      return;
    }

    applyModeSnapshot(savedState.currentMode, savedState.modes[savedState.currentMode]);
    setConfigSaved(true);
  }, [models.length, selectedBotId]);

  useEffect(() => {
    if (!selectedProviderA && selectedModelA) {
      setSelectedProviderA(getProviderFromModelId(selectedModelA));
    }
  }, [selectedProviderA, selectedModelA]);

  useEffect(() => {
    if (!selectedProviderB && selectedModelB) {
      setSelectedProviderB(getProviderFromModelId(selectedModelB));
    }
  }, [selectedProviderB, selectedModelB]);

  useEffect(() => {
    if (!selectedProviderA || !modelsForProviderA.length) {
      return;
    }

    if (!modelsForProviderA.some((model) => model.id === selectedModelA)) {
      setSelectedModelA(modelsForProviderA[0].id);
    }
  }, [modelsForProviderA, selectedModelA, selectedProviderA]);

  useEffect(() => {
    if (!selectedProviderB || !modelsForProviderB.length) {
      return;
    }

    if (!modelsForProviderB.some((model) => model.id === selectedModelB)) {
      setSelectedModelB(modelsForProviderB[0].id);
    }
  }, [modelsForProviderB, selectedModelB, selectedProviderB]);

  useEffect(() => {
    const nextSelection = getDefaultPromptSelectionKey(prompts);
    const currentPrompt = getPromptBySelectionKey(prompts, selectedPromptKey);

    if (!currentPrompt && nextSelection) {
      setSelectedPromptKey(nextSelection);
    }
  }, [prompts, selectedPromptKey]);

  useEffect(() => {
    const ready = Boolean(
      selectedProviderA &&
        selectedModelA &&
        selectedPromptKey &&
        thinking &&
        (!comparisonEnabled || (selectedProviderB && selectedModelB))
    );
    if (!ready) {
      return;
    }

    if (restoringConfigRef.current) {
      restoringConfigRef.current = false;
      return;
    }

    if (!configBootedRef.current) {
      configBootedRef.current = true;
      return;
    }

    setConfigSaved(false);
  }, [
    comparisonEnabled,
    selectedProviderA,
    selectedProviderB,
    selectedModelA,
    selectedModelB,
    selectedPromptKey,
    temperature,
    thinking,
    staticThinking,
  ]);

  async function saveConfig() {
    if (!selectedBotId) {
      return;
    }

    persistCurrentMode();

    setConfigSaved(true);
    toast.success(`Configuration locale enregistree pour ${selectedBot?.name || 'ce bot'}`);
  }

  function openPushDialog() {
    setPushModelId(selectedModelA);
    setPushTemperature(clampPushTemperature(temperature).toString());
    setPushDialogOpen(true);
  }

  async function handlePushToLive() {
    if (!pushModelId) {
      toast.error('Selectionnez un modele');
      return;
    }

    const nextTemperature = Number(pushTemperature);
    if (!Number.isFinite(nextTemperature) || nextTemperature < 0 || nextTemperature > 1) {
      toast.error('La temperature doit etre comprise entre 0 et 1');
      return;
    }

    toast.info('Push to live non connecte a Botpress pour le moment');
    setPushDialogOpen(false);
  }

  function clearConversation() {
    setTurns([]);
    setSingleHistory([]);
    setCompareHistory({ modelA: [], modelB: [] });
    setUserMessage('');
    if (selectedBotId) {
      const existingState = readSavedBotState(selectedBotId);
      const nextSnapshot: ModeSnapshot = {
        ...buildModeSnapshot(),
        turns: [],
        singleHistory: [],
        compareHistory: { modelA: [], modelB: [] },
      };
      writeSavedBotState(selectedBotId, {
        currentMode,
        modes: {
          ...(existingState?.modes ?? {}),
          [currentMode]: nextSnapshot,
        },
      });
    }
  }

  function handleComparisonToggle() {
    if (!selectedBotId) {
      setComparisonEnabled((prev) => !prev);
      return;
    }

    const nextMode: ModeKey = comparisonEnabled ? 'single' : 'compare';
    const existingState = readSavedBotState(selectedBotId);
    const currentSnapshot = buildModeSnapshot();

    writeSavedBotState(selectedBotId, {
      currentMode: nextMode,
      modes: {
        ...(existingState?.modes ?? {}),
        [currentMode]: currentSnapshot,
      },
    });

    applyModeSnapshot(nextMode, existingState?.modes?.[nextMode]);
  }

  async function runSingleTurn(message: string) {
    const turnId = crypto.randomUUID();
    const historyWithMessage: LocalChatMessage[] = [...singleHistory, { role: 'user', content: message }];
    const pendingTurn: ChatTurn = {
      id: turnId,
      createdAt: new Date().toISOString(),
      userText: message,
      modelA: {
        modelId: selectedModelA,
        text: '',
        pending: true,
        latencyMs: 0,
        usage: null,
      },
    };
    const pendingTurns = [...turns, pendingTurn];

    setTurns(pendingTurns);
    persistModeConversation('single', {
      turns: pendingTurns,
      singleHistory: historyWithMessage,
      compareHistory,
    });

    const result = await generateTextWithCognitiveApi({
      token: settings.token,
      botId: selectedBotId,
      model: selectedModelA,
      systemPrompt: selectedPrompt?.prompt ?? '',
      messages: historyWithMessage,
      temperature,
      maxTokens: DEFAULT_MAX_TOKENS,
      reasoningEffort: thinking,
    });

    const responseText = result.text || '[Empty response]';
    const modelA = buildModelResponse({ modelId: selectedModelA, result });
    const completedTurns = pendingTurns.map((turn) =>
      turn.id === turnId
        ? {
            ...turn,
            modelA: { ...modelA, text: responseText, pending: false },
          }
        : turn
    );
    const nextSingleHistory: LocalChatMessage[] = [
      ...singleHistory,
      { role: 'user', content: message },
      { role: 'assistant', content: responseText },
    ];

    setTurns(completedTurns);
    setSingleHistory(nextSingleHistory);
    persistModeConversation('single', {
      turns: completedTurns,
      singleHistory: nextSingleHistory,
      compareHistory,
    });
  }

  async function runCompareTurn(message: string) {
    const turnId = crypto.randomUUID();
    const historyA: LocalChatMessage[] = [...compareHistory.modelA, { role: 'user', content: message }];
    const historyB: LocalChatMessage[] = [...compareHistory.modelB, { role: 'user', content: message }];
    const pendingTurn: ChatTurn = {
      id: turnId,
      createdAt: new Date().toISOString(),
      userText: message,
      modelA: {
        modelId: selectedModelA,
        text: '',
        pending: true,
        latencyMs: 0,
        usage: null,
      },
      modelB: {
        modelId: selectedModelB,
        text: '',
        pending: true,
        latencyMs: 0,
        usage: null,
      },
    };
    const pendingTurns = [...turns, pendingTurn];

    setTurns(pendingTurns);
    persistModeConversation('compare', {
      turns: pendingTurns,
      singleHistory,
      compareHistory: {
        modelA: historyA,
        modelB: historyB,
      },
    });

    const [resultA, resultB] = await Promise.allSettled([
      generateTextWithCognitiveApi({
        token: settings.token,
        botId: selectedBotId,
        model: selectedModelA,
        systemPrompt: selectedPrompt?.prompt ?? '',
        messages: historyA,
        temperature,
        maxTokens: DEFAULT_MAX_TOKENS,
        reasoningEffort: thinking,
      }),
      generateTextWithCognitiveApi({
        token: settings.token,
        botId: selectedBotId,
        model: selectedModelB,
        systemPrompt: selectedPrompt?.prompt ?? '',
        messages: historyB,
        temperature,
        maxTokens: DEFAULT_MAX_TOKENS,
        reasoningEffort: thinking,
      }),
    ]);

    const modelA =
      resultA.status === 'fulfilled'
        ? buildModelResponse({ modelId: selectedModelA, result: resultA.value })
        : buildModelResponse({ modelId: selectedModelA, error: getErrorMessage(resultA.reason, 'Generation failed') });

    const modelB =
      resultB.status === 'fulfilled'
        ? buildModelResponse({ modelId: selectedModelB, result: resultB.value })
        : buildModelResponse({ modelId: selectedModelB, error: getErrorMessage(resultB.reason, 'Generation failed') });
    const completedTurns = pendingTurns.map((turn) =>
      turn.id === turnId
        ? {
            ...turn,
            modelA: { ...modelA, pending: false },
            modelB: { ...modelB, pending: false },
          }
        : turn
    );
    const nextCompareHistory: PerModelHistory = {
      modelA: [
        ...compareHistory.modelA,
        { role: 'user', content: message },
        { role: 'assistant', content: modelA.error ? `[Error] ${modelA.error}` : modelA.text || '[Empty response]' },
      ],
      modelB: [
        ...compareHistory.modelB,
        { role: 'user', content: message },
        { role: 'assistant', content: modelB.error ? `[Error] ${modelB.error}` : modelB.text || '[Empty response]' },
      ],
    };

    setTurns(completedTurns);
    setCompareHistory(nextCompareHistory);
    persistModeConversation('compare', {
      turns: completedTurns,
      singleHistory,
      compareHistory: nextCompareHistory,
    });
  }

  async function handleRun() {
    const trimmedMessage = userMessage.trim();

    if (!selectedBotId || !settings.token) {
      toast.error('Botpress configuration is missing');
      return;
    }

    if (!selectedPrompt?.prompt.trim()) {
      toast.error('Selectionnez un prompt');
      return;
    }

    if (!trimmedMessage) {
      toast.error('Entrez un message utilisateur');
      return;
    }

    if (!selectedModelA) {
      toast.error('Selectionnez le modele A');
      return;
    }

    if (comparisonEnabled && !selectedModelB) {
      toast.error('Selectionnez le modele B');
      return;
    }

    if (comparisonEnabled && selectedModelA === selectedModelB) {
      toast.error('Choisissez deux modeles differents en mode comparaison');
      return;
    }

    setRunning(true);
    setUserMessage('');
    try {
      if (comparisonEnabled) {
        await runCompareTurn(trimmedMessage);
      } else {
        await runSingleTurn(trimmedMessage);
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error(getErrorMessage(error, 'Generation failed'));
    } finally {
      setRunning(false);
    }
  }

  if (!settings.token || !settings.workspaceId || promptBots.length === 0) {
    return (
      <div className="flex w-full justify-center px-6 py-12">
        <div className="w-full max-w-4xl">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Configuration Required</CardTitle>
              <CardDescription>
                Configure the FR, DE and ES Botpress bots before testing models.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4">
      <section className="space-y-4 px-1">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-[2.15rem] font-semibold tracking-[-0.045em] text-foreground">Model Testing</h1>
            <p className="text-[15px] text-muted-foreground">
              Test system prompts across models and compare outputs.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2">
              <span className="text-sm font-medium text-slate-700">Comparison</span>
              <Toggle checked={comparisonEnabled} onToggle={handleComparisonToggle} />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-sm font-medium text-muted-foreground">Bot:</span>
              <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Select a bot" />
                </SelectTrigger>
                <SelectContent>
                  {promptBots.map((bot) => (
                    <SelectItem key={bot.id} value={bot.botId}>
                      {bot.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-lg border-slate-200 bg-white text-sm"
                onClick={() => void saveConfig()}
              >
                <Save className="size-4" />
                Save configuration
              </Button>
              <Button className="h-10 rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" onClick={openPushDialog}>
                Push to live
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section
        className={cn(
          'grid min-h-0 items-stretch gap-4 px-1',
          settingsCollapsed
            ? 'lg:grid-cols-[68px_minmax(0,1fr)]'
            : 'lg:grid-cols-[320px_minmax(0,1fr)]'
        )}
      >
        <div className="min-w-0">
          <Card
            className={cn(
              'border-slate-200 shadow-sm',
              settingsCollapsed && 'cursor-pointer transition-colors hover:bg-slate-50/80'
            )}
            onClick={settingsCollapsed ? () => setSettingsCollapsed(false) : undefined}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className={cn('space-y-1.5', settingsCollapsed && 'hidden')}>
                <CardTitle className="text-[1.05rem] tracking-[-0.02em]">Settings</CardTitle>
                <CardDescription>
                  Select providers, models, thinking, temperature, and the prompt used for this version.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={(event) => {
                  event.stopPropagation();
                  setSettingsCollapsed((prev) => !prev);
                }}
              >
                {settingsCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
              </Button>
            </CardHeader>

            {settingsCollapsed && (
              <CardContent className="flex items-center justify-center px-0 pb-4 pt-2">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
                    <Save className="size-4" />
                  </div>
                  <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-medium tracking-[0.18em] text-slate-400 uppercase">
                    Settings
                  </span>
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      configSaved ? 'bg-emerald-500' : 'bg-amber-500'
                    )}
                  />
                </div>
              </CardContent>
            )}

            {!settingsCollapsed && (
              <CardContent className="space-y-4">
              {modelsError && (
                <Alert className="border-rose-200 bg-rose-50 text-rose-900">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Erreur de chargement modeles</AlertTitle>
                  <AlertDescription>{modelsError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
                <div className="space-y-2">
                  <Label htmlFor="provider-a">Provider A</Label>
                  <Select value={selectedProviderA} onValueChange={setSelectedProviderA} disabled={modelsLoading}>
                    <SelectTrigger id="provider-a">
                      <SelectValue placeholder="Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {getProviderLabel(provider)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model-a">Model A</Label>
                  <Select value={selectedModelA} onValueChange={setSelectedModelA} disabled={modelsLoading}>
                    <SelectTrigger id="model-a" className="w-full min-w-0">
                      <SelectValue placeholder="Choisir un modele">
                        {selectedModelAData ? (
                          <span className="block truncate">{getPrettyModelName(selectedModelAData)}</span>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {modelsForProviderA.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {getPrettyModelName(model)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {comparisonEnabled && (
                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="provider-b">Provider B</Label>
                    <Select value={selectedProviderB} onValueChange={setSelectedProviderB} disabled={modelsLoading}>
                      <SelectTrigger id="provider-b">
                        <SelectValue placeholder="Provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {getProviderLabel(provider)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="model-b">Model B</Label>
                    <Select value={selectedModelB} onValueChange={setSelectedModelB} disabled={modelsLoading}>
                      <SelectTrigger id="model-b" className="w-full min-w-0">
                        <SelectValue placeholder="Choisir un modele">
                          {selectedModelBData ? (
                            <span className="block truncate">{getPrettyModelName(selectedModelBData)}</span>
                          ) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {modelsForProviderB.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {getPrettyModelName(model)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Thinking</Label>
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700">Enable thinking</span>
                    <Toggle
                      checked={thinking !== 'none'}
                      onToggle={() => setThinking((prev) => (prev === 'none' ? staticThinking : 'none'))}
                    />
                  </div>

                  {thinking !== 'none' && (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700">Dynamic</span>
                        <Toggle
                          checked={thinking === 'dynamic'}
                          onToggle={() => setThinking((prev) => (prev === 'dynamic' ? staticThinking : 'dynamic'))}
                        />
                      </div>

                      {thinking !== 'dynamic' && (
                        <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1">
                          {STATIC_THINKING_OPTIONS.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                setStaticThinking(option);
                                setThinking(option);
                              }}
                              className={cn(
                                'rounded-lg px-2 py-2 text-sm font-medium capitalize transition-colors',
                                staticThinking === option
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                              )}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sidebar-temperature">Temperature</Label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-600">Precision</span>
                    <span className="font-medium text-slate-900">{temperature.toFixed(1)}</span>
                  </div>
                  <input
                    id="sidebar-temperature"
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={temperature}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setTemperature(Number.isFinite(value) ? value : DEFAULT_TEMPERATURE);
                    }}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600"
                  />
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>0.0</span>
                    <span>1.0</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt-selector">Prompt</Label>
                <Select value={selectedPromptKey} onValueChange={setSelectedPromptKey}>
                  <SelectTrigger id="prompt-selector">
                    <SelectValue placeholder="Choisir un prompt" />
                  </SelectTrigger>
                  <SelectContent>
                    {promptOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        <div className="flex items-center gap-2">
                          <span className="truncate">{option.label}</span>
                          {option.version === 'testing' && (
                            <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
                              Test
                            </Badge>
                          )}
                          {option.version === 'live' && (
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                              Live
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPrompt ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                      {selectedPrompt.version === 'testing'
                        ? 'Test Prompt'
                        : selectedPrompt.version === 'live'
                          ? 'Live Prompt'
                          : 'Legacy'}
                    </Badge>
                    <span className="truncate">{selectedPrompt.label || 'Sans label'}</span>
                  </div>
                  <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {selectedPrompt.prompt || 'Prompt vide.'}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  Aucun prompt disponible pour cette version.
                </div>
              )}

              <Badge
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs',
                  configSaved
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                )}
              >
                {configSaved ? 'Sauvegarde' : 'Non sauvegarde'}
              </Badge>
              </CardContent>
            )}
          </Card>
        </div>

        <div className="min-w-0 min-h-0">
          <div className="flex h-[calc(100vh-120px)] min-h-[860px] flex-col overflow-hidden border border-slate-200 bg-white">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-slate-950">
                    {comparisonEnabled ? 'Comparison Chat' : 'Chat'}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {comparisonEnabled
                      ? 'The same prompt is sent to both models with the same context.'
                      : 'Single-model test conversation for the selected configuration.'}
                  </p>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                  {selectedPrompt?.label || 'No prompt selected'}
                </Badge>
              </div>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg border-slate-200 bg-white"
                  onClick={clearConversation}
                >
                  <Plus className="size-4" />
                  New conversation
                </Button>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 border-t border-slate-200 bg-slate-50/40">
              <div className="space-y-5 px-4 py-4">
                {turns.length === 0 ? (
                  <div className="flex min-h-[420px] items-center justify-center">
                    <div className="max-w-md text-center">
                      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                        {comparisonEnabled ? <Bot className="size-5" /> : <Send className="size-5" />}
                      </div>
                      <p className="text-lg font-medium text-slate-900">
                        {comparisonEnabled ? 'Run your first comparison' : 'Start a conversation'}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Write a user message below, then {comparisonEnabled ? 'run both models in parallel.' : 'test the selected model.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  turns.map((turn) => (
                    <article key={turn.id} className="space-y-4">
                      <UserMessageCard text={turn.userText} createdAt={turn.createdAt} />

                      {turn.modelB ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <ResponseCard
                            response={turn.modelA}
                            title={getPrettyModelName(selectedModelAData)}
                            accentClassName="bg-blue-500"
                          />
                          <ResponseCard
                            response={turn.modelB}
                            title={getPrettyModelName(selectedModelBData)}
                            accentClassName="bg-orange-400"
                          />
                        </div>
                      ) : (
                        <ResponseCard
                          response={turn.modelA}
                          title={getPrettyModelName(selectedModelAData)}
                          accentClassName="bg-blue-500"
                        />
                      )}
                    </article>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-slate-200 bg-white px-4 py-4">
              <div className="border border-slate-200 p-3">
                <Textarea
                  value={userMessage}
                  onChange={(event) => setUserMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      if (!running) {
                        void handleRun();
                      }
                    }
                  }}
                  placeholder={
                    comparisonEnabled
                      ? 'Write the user message to compare both models...'
                      : 'Write the user message to test the selected model...'
                  }
                  className="min-h-[92px] resize-none border-0 bg-transparent px-1 py-1 text-[15px] leading-7 shadow-none focus-visible:ring-0"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {comparisonEnabled
                      ? 'The same conversation history is sent to both models.'
                      : 'Conversation history is preserved for the selected model.'}
                  </div>

                  <Button
                    onClick={() => void handleRun()}
                    disabled={
                      running ||
                      modelsLoading ||
                      !selectedModelA ||
                      !selectedPrompt?.prompt ||
                      (comparisonEnabled && (!selectedModelB || selectedModelA === selectedModelB))
                    }
                    className="h-10 rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-700"
                  >
                    {running ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {comparisonEnabled ? 'Run Comparison' : 'Send'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={pushDialogOpen} onOpenChange={setPushDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Push to live</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="push-model">Modele</Label>
              <Select value={pushModelId} onValueChange={setPushModelId}>
                <SelectTrigger id="push-model">
                  <SelectValue placeholder="Choisir un modele" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {getProviderLabel(getProviderFromModelId(model.id))} - {getPrettyModelName(model)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="push-temperature">Temperature</Label>
              <Input
                id="push-temperature"
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={pushTemperature}
                onChange={(event) => setPushTemperature(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => void handlePushToLive()}>
              Push
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
