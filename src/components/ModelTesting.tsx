import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bot, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/contexts/SettingsContext';
import { useBotpressClient } from '@/hooks/useBotpressClient';
import { usePromptRows } from '@/queries/usePromptRows';
import { fetchCognitiveModels } from '@/lib/cognitiveApi';
import { filterDisplayableCognitiveModels } from '@/lib/modelTestingModels';
import {
  buildSavedStateWithClearedConversation,
  buildSavedStateWithConversation,
  STATIC_THINKING_OPTIONS,
  THINKING_OPTIONS,
  type ModeKey,
  type ModeSnapshot,
  type SavedBotState,
  type StaticThinkingOption,
  type ThinkingOption,
} from '@/lib/modelTestingConfig';
import {
  runCompareModelTestingTurn,
  runSingleModelTestingTurn,
} from '@/lib/modelTestingAgent';
import {
  buildAiModelTableUpdateRow,
  buildPushLivePayload,
  getProviderFromModelId,
  normalizeAiModelConfigRow,
  type AiModelConfigRow,
} from '@/lib/modelTestingPushLive';
import {
  getPromptSelectionKey,
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
import type { SourceItem } from '@/types/structuredMessage';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatusBadge as Badge } from '@/components/dashboard';
import { Button } from '@/components/ui/button';
import {
  PageHeader,
  PageTabs,
  PageTab,
  PageTabList,
  PageTabPanel,
  Toolbar,
  SplitPane,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/dashboard';
import { ResponsePanel } from '@/features/model-testing/ResponsePanel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TestComposer } from '@/features/model-testing/TestComposer';

const EMPTY_PROMPT_ROWS: PromptRow[] = [];
const AI_MODEL_TABLE_NAME = 'AIModelTable';
const ALLOWED_PROMPT_BOTS = new Set(['fr', 'de', 'es']);
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 1200;
const MODEL_TESTING_STORAGE_KEY = 'model-testing-config-v4';

type TestSettingsDraft = {
  selectedProviderA: string;
  selectedProviderB: string;
  selectedModelA: string;
  selectedModelB: string;
  selectedCheapProvider: string;
  selectedCheapModel: string;
  thinking: ThinkingOption;
  temperature: number;
  cheapReasoningEffort: ThinkingOption;
  cheapTemperature: number;
  selectedPromptKey: string;
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isThinkingOption(value: unknown): value is ThinkingOption {
  return (
    typeof value === 'string' &&
    THINKING_OPTIONS.includes(value as ThinkingOption)
  );
}

function isStaticThinkingOption(value: unknown): value is StaticThinkingOption {
  return (
    typeof value === 'string' &&
    STATIC_THINKING_OPTIONS.includes(value as StaticThinkingOption)
  );
}

function readSavedConfigs(): Record<string, unknown> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(MODEL_TESTING_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readSavedBotState(botId: string): SavedBotState | null {
  const config = readSavedConfigs()[botId];
  if (!config || typeof config !== 'object') {
    return null;
  }

  const configRecord = config as Record<string, unknown>;

  // Backward compatibility with the previous flat shape.
  if ('selectedModelA' in configRecord) {
    const legacyMode: ModeKey = configRecord.comparisonEnabled
      ? 'compare'
      : 'single';
    return {
      currentMode: legacyMode,
      modes: {
        [legacyMode]: {
          thinking: isThinkingOption(configRecord.thinking)
            ? configRecord.thinking
            : 'medium',
          staticThinking: isStaticThinkingOption(configRecord.staticThinking)
            ? configRecord.staticThinking
            : 'medium',
          temperature:
            typeof configRecord.temperature === 'number' &&
            Number.isFinite(configRecord.temperature)
              ? configRecord.temperature
              : DEFAULT_TEMPERATURE,
          selectedProviderA:
            typeof configRecord.selectedProviderA === 'string'
              ? configRecord.selectedProviderA
              : '',
          selectedProviderB:
            typeof configRecord.selectedProviderB === 'string'
              ? configRecord.selectedProviderB
              : '',
          selectedModelA:
            typeof configRecord.selectedModelA === 'string'
              ? configRecord.selectedModelA
              : '',
          selectedModelB:
            typeof configRecord.selectedModelB === 'string'
              ? configRecord.selectedModelB
              : '',
          selectedCheapProvider:
            typeof configRecord.selectedCheapProvider === 'string'
              ? configRecord.selectedCheapProvider
              : '',
          selectedCheapModel:
            typeof configRecord.selectedCheapModel === 'string'
              ? configRecord.selectedCheapModel
              : '',
          cheapTemperature:
            typeof configRecord.cheapTemperature === 'number'
              ? configRecord.cheapTemperature
              : DEFAULT_TEMPERATURE,
          cheapReasoningEffort: isThinkingOption(
            configRecord.cheapReasoningEffort,
          )
            ? configRecord.cheapReasoningEffort
            : 'high',
          selectedPromptKey:
            typeof configRecord.selectedPromptKey === 'string'
              ? configRecord.selectedPromptKey
              : '',
          turns: [],
          singleHistory: [],
          compareHistory: { modelA: [], modelB: [] },
        },
      },
    };
  }

  const modes = isRecord(configRecord.modes) ? configRecord.modes : {};
  const normalizeModeSnapshot = (
    snapshot: Record<string, unknown>,
  ): ModeSnapshot => {
    const compareHistory = isRecord(snapshot.compareHistory)
      ? snapshot.compareHistory
      : {};

    return {
      thinking: isThinkingOption(snapshot.thinking)
        ? snapshot.thinking
        : 'medium',
      staticThinking: isStaticThinkingOption(snapshot.staticThinking)
        ? snapshot.staticThinking
        : 'medium',
      temperature:
        typeof snapshot.temperature === 'number' &&
        Number.isFinite(snapshot.temperature)
          ? snapshot.temperature
          : DEFAULT_TEMPERATURE,
      selectedProviderA:
        typeof snapshot.selectedProviderA === 'string'
          ? snapshot.selectedProviderA
          : '',
      selectedProviderB:
        typeof snapshot.selectedProviderB === 'string'
          ? snapshot.selectedProviderB
          : '',
      selectedModelA:
        typeof snapshot.selectedModelA === 'string'
          ? snapshot.selectedModelA
          : '',
      selectedModelB:
        typeof snapshot.selectedModelB === 'string'
          ? snapshot.selectedModelB
          : '',
      selectedCheapProvider:
        typeof snapshot.selectedCheapProvider === 'string'
          ? snapshot.selectedCheapProvider
          : '',
      selectedCheapModel:
        typeof snapshot.selectedCheapModel === 'string'
          ? snapshot.selectedCheapModel
          : '',
      cheapTemperature:
        typeof snapshot.cheapTemperature === 'number'
          ? snapshot.cheapTemperature
          : DEFAULT_TEMPERATURE,
      cheapReasoningEffort: isThinkingOption(snapshot.cheapReasoningEffort)
        ? snapshot.cheapReasoningEffort
        : 'high',
      selectedPromptKey:
        typeof snapshot.selectedPromptKey === 'string'
          ? snapshot.selectedPromptKey
          : '',
      turns: Array.isArray(snapshot.turns) ? snapshot.turns : [],
      singleHistory: Array.isArray(snapshot.singleHistory)
        ? snapshot.singleHistory
        : [],
      compareHistory: {
        modelA: Array.isArray(compareHistory.modelA)
          ? compareHistory.modelA
          : [],
        modelB: Array.isArray(compareHistory.modelB)
          ? compareHistory.modelB
          : [],
      },
    };
  };

  return {
    currentMode: configRecord.currentMode === 'single' ? 'single' : 'compare',
    modes: {
      single: isRecord(modes.single)
        ? normalizeModeSnapshot(modes.single)
        : undefined,
      compare: isRecord(modes.compare)
        ? normalizeModeSnapshot(modes.compare)
        : undefined,
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
    }),
  );
}

function getPromptBySelectionKey(
  prompts: ReturnType<typeof partitionPromptRows>,
  selectionKey: string | null,
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

function getDefaultPromptSelectionKey(
  prompts: ReturnType<typeof partitionPromptRows>,
) {
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

function UserMessage({ text, createdAt }: { text: string; createdAt: string }) {
  return (
    <div className="flex flex-col items-end gap-2 pl-8 sm:pl-16">
      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-muted px-5 py-3 text-[15px] leading-7">{text}</p>
      <span className="pr-2 text-[11px] text-muted-foreground">You · {formatTime(createdAt)}</span>
    </div>
  );
}

function responseHasProgress(response: ModelResponse | undefined) {
  if (!response) {
    return false;
  }

  return Boolean(
    response.steps?.length ||
      response.messages?.length ||
      response.responseParts?.length ||
      response.text ||
      response.error ||
      response.latencyMs ||
      response.usage,
  );
}

export default function ModelTesting() {
  const { settings } = useSettings();
  const promptBots = useMemo(
    () =>
      settings.bots.filter(
        (bot) => ALLOWED_PROMPT_BOTS.has(bot.id) && bot.botId,
      ),
    [settings.bots],
  );

  const [selectedBotId, setSelectedBotId] = useState('');
  const [models, setModels] = useState<CognitiveModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [selectedProviderA, setSelectedProviderA] = useState('');
  const [selectedProviderB, setSelectedProviderB] = useState('');
  const [selectedModelA, setSelectedModelA] = useState('');
  const [selectedModelB, setSelectedModelB] = useState('');
  const [selectedCheapProvider, setSelectedCheapProvider] = useState('');
  const [selectedCheapModel, setSelectedCheapModel] = useState('');
  const [comparisonEnabled, setComparisonEnabled] = useState(true);
  const [thinking, setThinking] = useState<ThinkingOption>('medium');
  const [staticThinking, setStaticThinking] =
    useState<StaticThinkingOption>('medium');
  const [temperature, setTemperature] = useState<number>(DEFAULT_TEMPERATURE);
  const [cheapTemperature, setCheapTemperature] =
    useState<number>(DEFAULT_TEMPERATURE);
  const [cheapReasoningEffort, setCheapReasoningEffort] =
    useState<ThinkingOption>('high');

  const [selectedPromptKey, setSelectedPromptKey] = useState('');

  const [configSaved, setConfigSaved] = useState(true);
  const [testSettingsOpen, setTestSettingsOpen] = useState(false);
  const [testSettingsDraft, setTestSettingsDraft] =
    useState<TestSettingsDraft | null>(null);
  const configBootedRef = useRef(false);
  const restoringConfigRef = useRef(false);
  const modelSelectionResetRef = useRef(false);

  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [pushModelId, setPushModelId] = useState('');
  const [pushCheapModelId, setPushCheapModelId] = useState('');
  const [pushTemperature, setPushTemperature] = useState(
    String(DEFAULT_TEMPERATURE),
  );
  const [pushReasoningEffort, setPushReasoningEffort] =
    useState<ThinkingOption>('medium');
  const [pushCheapTemperature, setPushCheapTemperature] = useState(
    String(DEFAULT_TEMPERATURE),
  );
  const [pushCheapReasoningEffort, setPushCheapReasoningEffort] =
    useState<ThinkingOption>('high');
  const [liveStrongModelConfig, setLiveStrongModelConfig] =
    useState<AiModelConfigRow | null>(null);
  const [liveCheapModelConfig, setLiveCheapModelConfig] =
    useState<AiModelConfigRow | null>(null);
  const [pushConfigLoading, setPushConfigLoading] = useState(false);
  const [pushConfigSaving, setPushConfigSaving] = useState(false);
  const hydratedBotIdRef = useRef<string | null>(null);

  const [userMessage, setUserMessage] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [singleHistory, setSingleHistory] = useState<LocalChatMessage[]>([]);
  const [compareHistory, setCompareHistory] = useState<PerModelHistory>({
    modelA: [],
    modelB: [],
  });
  const [running, setRunning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const followConversationRef = useRef(true);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousModelSelectionRef = useRef<{
    modelA: string;
    modelB: string;
  } | null>(null);

  const client = useBotpressClient(selectedBotId);
  const promptQuery = usePromptRows(
    client,
    settings.workspaceId,
    selectedBotId,
  );
  const promptRows = promptQuery.data ?? EMPTY_PROMPT_ROWS;
  const prompts = useMemo(() => partitionPromptRows(promptRows), [promptRows]);
  const selectedPrompt = useMemo(
    () => getPromptBySelectionKey(prompts, selectedPromptKey),
    [prompts, selectedPromptKey],
  );
  const promptOptions = useMemo(() => {
    const options: Array<{
      key: string;
      label: string;
      version: PromptRow['version'];
    }> = [];

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
    () =>
      models.filter(
        (model) => getProviderFromModelId(model.id) === selectedProviderA,
      ),
    [models, selectedProviderA],
  );
  const modelsForProviderB = useMemo(
    () =>
      models.filter(
        (model) => getProviderFromModelId(model.id) === selectedProviderB,
      ),
    [models, selectedProviderB],
  );
  const modelsForCheapProvider = useMemo(
    () =>
      models.filter(
        (model) => getProviderFromModelId(model.id) === selectedCheapProvider,
      ),
    [models, selectedCheapProvider],
  );
  const selectedModelAData = useMemo(
    () => models.find((model) => model.id === selectedModelA) ?? null,
    [models, selectedModelA],
  );
  const selectedModelBData = useMemo(
    () => models.find((model) => model.id === selectedModelB) ?? null,
    [models, selectedModelB],
  );
  const selectedBot = useMemo(
    () => promptBots.find((bot) => bot.botId === selectedBotId) ?? null,
    [promptBots, selectedBotId],
  );
  const draftModelsForProviderA = useMemo(
    () =>
      models.filter(
        (model) =>
          getProviderFromModelId(model.id) ===
          testSettingsDraft?.selectedProviderA,
      ),
    [models, testSettingsDraft?.selectedProviderA],
  );
  const draftModelsForProviderB = useMemo(
    () =>
      models.filter(
        (model) =>
          getProviderFromModelId(model.id) ===
          testSettingsDraft?.selectedProviderB,
      ),
    [models, testSettingsDraft?.selectedProviderB],
  );
  const draftDecisionModels = useMemo(
    () =>
      models.filter(
        (model) =>
          getProviderFromModelId(model.id) ===
          testSettingsDraft?.selectedCheapProvider,
      ),
    [models, testSettingsDraft?.selectedCheapProvider],
  );
  const draftPrompt = useMemo(
    () =>
      getPromptBySelectionKey(
        prompts,
        testSettingsDraft?.selectedPromptKey ?? null,
      ),
    [prompts, testSettingsDraft?.selectedPromptKey],
  );
  const canApplyTestSettings = Boolean(
    testSettingsDraft?.selectedProviderA &&
      testSettingsDraft.selectedModelA &&
      testSettingsDraft.selectedCheapProvider &&
      testSettingsDraft.selectedCheapModel &&
      testSettingsDraft.selectedPromptKey &&
      (!comparisonEnabled ||
        (testSettingsDraft.selectedProviderB &&
          testSettingsDraft.selectedModelB &&
          testSettingsDraft.selectedModelA !==
            testSettingsDraft.selectedModelB)),
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
      selectedCheapProvider,
      selectedCheapModel,
      cheapTemperature,
      cheapReasoningEffort,
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
    setSelectedCheapProvider(
      snapshot?.selectedCheapProvider ?? selectedCheapProvider,
    );
    setSelectedCheapModel(snapshot?.selectedCheapModel ?? selectedCheapModel);
    setCheapTemperature(snapshot?.cheapTemperature ?? cheapTemperature);
    setCheapReasoningEffort(
      snapshot?.cheapReasoningEffort ?? cheapReasoningEffort,
    );
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
    chatState: Pick<ModeSnapshot, 'turns' | 'singleHistory' | 'compareHistory'>,
  ) {
    if (!selectedBotId) {
      return;
    }

    const existingState = readSavedBotState(selectedBotId);
    writeSavedBotState(
      selectedBotId,
      buildSavedStateWithConversation({
        existingState,
        currentMode,
        mode,
        currentSnapshot: buildModeSnapshot(),
        chatState,
      }),
    );
  }

  function resetConversationForModelSelection(
    nextModelA: string,
    nextModelB = selectedModelB,
  ) {
    const normalizedSelection = {
      modelA: nextModelA,
      modelB: comparisonEnabled ? nextModelB : '',
    };
    const clearedSnapshot: ModeSnapshot = {
      thinking,
      staticThinking,
      temperature,
      selectedProviderA,
      selectedProviderB,
      selectedModelA: nextModelA,
      selectedModelB: nextModelB,
      selectedCheapProvider,
      selectedCheapModel,
      cheapTemperature,
      cheapReasoningEffort,
      selectedPromptKey,
      turns: [],
      singleHistory: [],
      compareHistory: { modelA: [], modelB: [] },
    };

    previousModelSelectionRef.current = normalizedSelection;
    configBootedRef.current = true;
    modelSelectionResetRef.current = true;
    setTurns([]);
    setSingleHistory([]);
    setCompareHistory({ modelA: [], modelB: [] });
    setUserMessage('');

    if (selectedBotId) {
      const existingState = readSavedBotState(selectedBotId);
      writeSavedBotState(
        selectedBotId,
        buildSavedStateWithClearedConversation({
          existingState,
          currentMode,
          currentSnapshot: clearedSnapshot,
        }),
      );
    }

    setConfigSaved(true);
  }

  function handleModelAChange(nextModel: string) {
    if (nextModel === selectedModelA) {
      return;
    }

    setSelectedModelA(nextModel);
    setSelectedProviderA(getProviderFromModelId(nextModel));
    resetConversationForModelSelection(nextModel);
  }

  function handleModelBChange(nextModel: string) {
    if (nextModel === selectedModelB) {
      return;
    }

    setSelectedModelB(nextModel);
    setSelectedProviderB(getProviderFromModelId(nextModel));
    resetConversationForModelSelection(selectedModelA, nextModel);
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
        const nextModels = await fetchCognitiveModels(
          settings.token,
          selectedBotId,
        );
        if (!cancelled) {
          setModels(filterDisplayableCognitiveModels(nextModels));
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
    if (promptQuery.error) toast.error('Failed to load prompts');
  }, [promptQuery.error]);

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
      applyModeSnapshot(
        savedState.currentMode,
        savedState.modes[savedState.currentMode],
      );
    } else {
      setComparisonEnabled(true);
      setThinking('medium');
      setStaticThinking('medium');
      setTemperature(DEFAULT_TEMPERATURE);
      setSelectedProviderA('');
      setSelectedProviderB('');
      setSelectedModelA('');
      setSelectedModelB('');
      setSelectedCheapProvider('');
      setSelectedCheapModel('');
      setCheapTemperature(DEFAULT_TEMPERATURE);
      setCheapReasoningEffort('high');
      setSelectedPromptKey('');
      setTurns([]);
      setSingleHistory([]);
      setCompareHistory({ modelA: [], modelB: [] });
      setUserMessage('');
    }

    setConfigSaved(true);
  }, [selectedBotId]);

  useEffect(() => {
    const node = conversationRef.current;
    if (node && followConversationRef.current) node.scrollTop = node.scrollHeight;
  }, [turns]);

  useEffect(() => {
    if (!models.length) {
      setSelectedModelA('');
      setSelectedModelB('');
      return;
    }

    if (
      !selectedModelA ||
      !models.some((model) => model.id === selectedModelA)
    ) {
      const recommended =
        models.find((model) => model.tags?.includes('recommended')) ??
        models[0];
      setSelectedModelA(recommended.id);
      setSelectedProviderA(getProviderFromModelId(recommended.id));
    }

    if (
      !selectedModelB ||
      !models.some((model) => model.id === selectedModelB)
    ) {
      const firstModelId = selectedModelA || models[0].id;
      const fallback =
        models.find((model) => model.id !== firstModelId) ?? models[0];
      setSelectedModelB(fallback.id);
      setSelectedProviderB(getProviderFromModelId(fallback.id));
    }
    if (
      !selectedCheapModel ||
      !models.some((model) => model.id === selectedCheapModel)
    ) {
      const cheap =
        models.find((model) => /mini|flash|lite/i.test(model.id)) ?? models[0];
      setSelectedCheapModel(cheap.id);
      setSelectedCheapProvider(getProviderFromModelId(cheap.id));
    }
  }, [models, selectedModelA, selectedModelB, selectedCheapModel]);

  useEffect(() => {
    if (
      !selectedBotId ||
      !models.length ||
      hydratedBotIdRef.current === selectedBotId
    ) {
      return;
    }

    const savedState = readSavedBotState(selectedBotId);
    hydratedBotIdRef.current = selectedBotId;

    if (!savedState) {
      return;
    }

    applyModeSnapshot(
      savedState.currentMode,
      savedState.modes[savedState.currentMode],
    );
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
    if (!selectedCheapProvider && selectedCheapModel)
      setSelectedCheapProvider(getProviderFromModelId(selectedCheapModel));
  }, [selectedCheapProvider, selectedCheapModel]);
  useEffect(() => {
    if (
      selectedCheapProvider &&
      modelsForCheapProvider.length &&
      !modelsForCheapProvider.some((model) => model.id === selectedCheapModel)
    ) {
      setSelectedCheapModel(modelsForCheapProvider[0].id);
    }
  }, [modelsForCheapProvider, selectedCheapModel, selectedCheapProvider]);

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
        selectedCheapModel &&
        selectedPromptKey &&
        thinking &&
        (!comparisonEnabled || (selectedProviderB && selectedModelB)),
    );
    if (!ready) {
      return;
    }

    const currentModelSelection = {
      modelA: selectedModelA,
      modelB: comparisonEnabled ? selectedModelB : '',
    };

    if (restoringConfigRef.current) {
      restoringConfigRef.current = false;
      previousModelSelectionRef.current = currentModelSelection;
      return;
    }

    if (!configBootedRef.current) {
      configBootedRef.current = true;
      previousModelSelectionRef.current = currentModelSelection;
      return;
    }

    const previousModelSelection = previousModelSelectionRef.current;
    previousModelSelectionRef.current = currentModelSelection;

    if (modelSelectionResetRef.current) {
      modelSelectionResetRef.current = false;
      return;
    }

    if (
      previousModelSelection &&
      (previousModelSelection.modelA !== currentModelSelection.modelA ||
        previousModelSelection.modelB !== currentModelSelection.modelB)
    ) {
      const clearedSnapshot: ModeSnapshot = {
        thinking,
        staticThinking,
        temperature,
        selectedProviderA,
        selectedProviderB,
        selectedModelA,
        selectedModelB,
        selectedCheapProvider,
        selectedCheapModel,
        cheapTemperature,
        cheapReasoningEffort,
        selectedPromptKey,
        turns: [],
        singleHistory: [],
        compareHistory: { modelA: [], modelB: [] },
      };

      setTurns([]);
      setSingleHistory([]);
      setCompareHistory({ modelA: [], modelB: [] });
      setUserMessage('');
      if (selectedBotId) {
        const existingState = readSavedBotState(selectedBotId);
        writeSavedBotState(
          selectedBotId,
          buildSavedStateWithClearedConversation({
            existingState,
            currentMode,
            currentSnapshot: clearedSnapshot,
          }),
        );
      }
      setConfigSaved(true);
      return;
    }

    setConfigSaved(false);
  }, [
    comparisonEnabled,
    selectedProviderA,
    selectedProviderB,
    selectedModelA,
    selectedModelB,
    selectedCheapProvider,
    selectedCheapModel,
    cheapTemperature,
    cheapReasoningEffort,
    selectedPromptKey,
    temperature,
    thinking,
    staticThinking,
    selectedBotId,
    currentMode,
  ]);

  async function saveConfig() {
    if (!selectedBotId) {
      return;
    }

    persistCurrentMode();

    setConfigSaved(true);
    toast.success(
      `Configuration locale enregistree pour ${selectedBot?.name || 'ce bot'}`,
    );
  }

  function openTestSettings() {
    setTestSettingsDraft({
      selectedProviderA,
      selectedProviderB,
      selectedModelA,
      selectedModelB,
      selectedCheapProvider,
      selectedCheapModel,
      thinking,
      temperature,
      cheapReasoningEffort,
      cheapTemperature,
      selectedPromptKey,
    });
    setTestSettingsOpen(true);
  }

  function closeTestSettings() {
    setTestSettingsOpen(false);
    setTestSettingsDraft(null);
    window.requestAnimationFrame(() => settingsButtonRef.current?.focus());
  }

  function applyTestSettings() {
    if (!testSettingsDraft || !canApplyTestSettings) return;

    const conversationMustReset =
      selectedModelA !== testSettingsDraft.selectedModelA ||
      selectedModelB !== testSettingsDraft.selectedModelB ||
      selectedCheapModel !== testSettingsDraft.selectedCheapModel ||
      selectedPromptKey !== testSettingsDraft.selectedPromptKey;

    setSelectedProviderA(testSettingsDraft.selectedProviderA);
    setSelectedProviderB(testSettingsDraft.selectedProviderB);
    setSelectedModelA(testSettingsDraft.selectedModelA);
    setSelectedModelB(testSettingsDraft.selectedModelB);
    setSelectedCheapProvider(testSettingsDraft.selectedCheapProvider);
    setSelectedCheapModel(testSettingsDraft.selectedCheapModel);
    setThinking(testSettingsDraft.thinking);
    if (
      testSettingsDraft.thinking !== 'none' &&
      testSettingsDraft.thinking !== 'dynamic'
    ) {
      setStaticThinking(testSettingsDraft.thinking);
    }
    setTemperature(testSettingsDraft.temperature);
    setCheapReasoningEffort(testSettingsDraft.cheapReasoningEffort);
    setCheapTemperature(testSettingsDraft.cheapTemperature);
    setSelectedPromptKey(testSettingsDraft.selectedPromptKey);
    setConfigSaved(false);

    if (conversationMustReset) {
      setTurns([]);
      setSingleHistory([]);
      setCompareHistory({ modelA: [], modelB: [] });
      setUserMessage('');
    }

    closeTestSettings();
  }

  function openPushDialog() {
    setPushModelId(selectedModelA);
    setPushCheapModelId(selectedCheapModel);
    setPushTemperature(clampPushTemperature(temperature).toString());
    setPushReasoningEffort(thinking);
    setPushCheapTemperature(clampPushTemperature(cheapTemperature).toString());
    setPushCheapReasoningEffort(cheapReasoningEffort);
    setPushDialogOpen(true);
    void loadLiveAiModelConfig();
  }

  async function loadLiveAiModelConfig() {
    if (!client) {
      setLiveStrongModelConfig(null);
      setLiveCheapModelConfig(null);
      return;
    }

    setPushConfigLoading(true);
    try {
      const response = await client.findTableRows({
        table: AI_MODEL_TABLE_NAME,
        limit: 10,
      });
      const rows = response.rows
        .map((row: Record<string, unknown>) => normalizeAiModelConfigRow(row))
        .filter((row): row is AiModelConfigRow => Boolean(row));
      const strongRow = rows.find((row) => row.modelType === 'strong') ?? null;
      const cheapRow = rows.find((row) => row.modelType === 'cheap') ?? null;
      setLiveStrongModelConfig(strongRow);
      setLiveCheapModelConfig(cheapRow);
      if (strongRow) {
        setPushModelId(strongRow.model);
        setPushTemperature(
          clampPushTemperature(strongRow.temperature).toString(),
        );
        setPushReasoningEffort(strongRow.reasoningEffort);
      }
      if (cheapRow) {
        setPushCheapModelId(cheapRow.model);
        setPushCheapTemperature(
          clampPushTemperature(cheapRow.temperature).toString(),
        );
        setPushCheapReasoningEffort(cheapRow.reasoningEffort);
      }
      if (!strongRow || !cheapRow) {
        toast.error(
          'AIModelTable doit contenir une ligne strong et une ligne cheap',
        );
      }
    } catch (error) {
      console.error('Error loading AI model config:', error);
      setLiveStrongModelConfig(null);
      setLiveCheapModelConfig(null);
      toast.error('Impossible de charger AIModelTable');
    } finally {
      setPushConfigLoading(false);
    }
  }

  async function handlePushToLive() {
    if (!client) {
      toast.error('Botpress client indisponible');
      return;
    }

    if (!pushModelId) {
      toast.error('Selectionnez un modele');
      return;
    }
    if (!pushCheapModelId) {
      toast.error('Selectionnez un modele cheap');
      return;
    }

    const nextTemperature = Number(pushTemperature);
    const nextCheapTemperature = Number(pushCheapTemperature);
    if (
      !Number.isFinite(nextTemperature) ||
      nextTemperature < 0 ||
      nextTemperature > 1
    ) {
      toast.error('La temperature doit etre comprise entre 0 et 1');
      return;
    }
    if (
      !Number.isFinite(nextCheapTemperature) ||
      nextCheapTemperature < 0 ||
      nextCheapTemperature > 1
    ) {
      toast.error(
        'La temperature du modele de decision doit etre comprise entre 0 et 1',
      );
      return;
    }

    if (!liveStrongModelConfig || !liveCheapModelConfig) {
      toast.error('Les lignes strong et cheap sont requises dans AIModelTable');
      return;
    }

    const strongPayload = buildPushLivePayload({
      modelType: 'strong',
      modelId: pushModelId,
      temperature: nextTemperature,
      reasoningEffort: pushReasoningEffort,
    });
    const cheapPayload = buildPushLivePayload({
      modelType: 'cheap',
      modelId: pushCheapModelId,
      temperature: nextCheapTemperature,
      reasoningEffort: pushCheapReasoningEffort,
    });

    setPushConfigSaving(true);
    try {
      await client.updateTableRows({
        table: AI_MODEL_TABLE_NAME,
        rows: [
          buildAiModelTableUpdateRow(liveStrongModelConfig, strongPayload),
          buildAiModelTableUpdateRow(liveCheapModelConfig, cheapPayload),
        ],
      });
      toast.success('Configuration IA live mise a jour');
      setPushDialogOpen(false);
      setLiveStrongModelConfig(
        buildAiModelTableUpdateRow(liveStrongModelConfig, strongPayload),
      );
      setLiveCheapModelConfig(
        buildAiModelTableUpdateRow(liveCheapModelConfig, cheapPayload),
      );
    } catch (error) {
      console.error('Error updating AI model config:', error);
      toast.error('Impossible de mettre a jour AIModelTable');
    } finally {
      setPushConfigSaving(false);
    }
  }

  function clearConversation() {
    setTurns([]);
    setSingleHistory([]);
    setCompareHistory({ modelA: [], modelB: [] });
    setUserMessage('');
    if (selectedBotId) {
      const existingState = readSavedBotState(selectedBotId);
      writeSavedBotState(
        selectedBotId,
        buildSavedStateWithClearedConversation({
          existingState,
          currentMode,
          currentSnapshot: buildModeSnapshot(),
        }),
      );
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

  async function resolveDocuments(docNames: string[]): Promise<SourceItem[]> {
    if (!client || docNames.length === 0) {
      return [];
    }

    try {
      const response = await client.findTableRows({
        table: 'documentsTable',
        limit: Math.min(6, docNames.length),
        filter: { docName: { $in: docNames } },
        select: ['docName', 'title', 'description', 'picture', 'url'],
      });
      const rows = response.rows as Array<Record<string, unknown>>;
      const rowsByDocName = new Map(
        rows
          .map(
            (row) =>
              [
                typeof row.docName === 'string' ? row.docName : '',
                row,
              ] as const,
          )
          .filter(([docName]) => Boolean(docName)),
      );

      return docNames.flatMap((docName) => {
        const row = rowsByDocName.get(docName);
        if (!row) return [];

        const asString = (value: unknown) =>
          typeof value === 'string' ? value : '';
        return [
          {
            docName,
            title: asString(row.title) || docName,
            description: asString(row.description),
            picture: asString(row.picture),
            url: asString(row.url),
          },
        ];
      });
    } catch (error) {
      console.warn('Unable to resolve documents for model testing:', error);
      return [];
    }
  }

  async function runSingleTurn(message: string) {
    const result = await runSingleModelTestingTurn({
      token: settings.token,
      botId: selectedBotId,
      modelId: selectedModelA,
      cheapModelId: selectedCheapModel,
      cheapTemperature,
      cheapReasoningEffort,
      rawSystemPrompt: selectedPrompt?.prompt ?? '',
      message,
      turns,
      singleHistory,
      temperature,
      maxTokens: DEFAULT_MAX_TOKENS,
      reasoningEffort: thinking,
      resolveDocuments,
      onPending: ({ turns: pendingTurns, singleHistory: pendingHistory }) => {
        setTurns(pendingTurns);
        persistModeConversation('single', {
          turns: pendingTurns,
          singleHistory: pendingHistory,
          compareHistory,
        });
      },
      onProgress: ({
        turns: progressTurns,
        singleHistory: progressHistory,
      }) => {
        setTurns(progressTurns);
        persistModeConversation('single', {
          turns: progressTurns,
          singleHistory: progressHistory,
          compareHistory,
        });
      },
    });

    setTurns(result.turns);
    setSingleHistory(result.singleHistory);
    persistModeConversation('single', {
      turns: result.turns,
      singleHistory: result.singleHistory,
      compareHistory,
    });
  }

  async function runCompareTurn(message: string) {
    const result = await runCompareModelTestingTurn({
      token: settings.token,
      botId: selectedBotId,
      modelAId: selectedModelA,
      modelBId: selectedModelB,
      cheapModelId: selectedCheapModel,
      cheapTemperature,
      cheapReasoningEffort,
      rawSystemPrompt: selectedPrompt?.prompt ?? '',
      message,
      turns,
      compareHistory,
      temperature,
      maxTokens: DEFAULT_MAX_TOKENS,
      reasoningEffort: thinking,
      resolveDocuments,
      onPending: ({ turns: pendingTurns, compareHistory: pendingHistory }) => {
        setTurns(pendingTurns);
        persistModeConversation('compare', {
          turns: pendingTurns,
          singleHistory,
          compareHistory: pendingHistory,
        });
      },
      onProgress: ({
        turns: progressTurns,
        compareHistory: progressHistory,
      }) => {
        setTurns((previousTurns) => {
          const mergedTurns = previousTurns.map((previousTurn) => {
            const nextTurn = progressTurns.find(
              (turn) => turn.id === previousTurn.id,
            );
            if (!nextTurn) {
              return previousTurn;
            }

            return {
              ...previousTurn,
              modelA: responseHasProgress(nextTurn.modelA)
                ? nextTurn.modelA
                : previousTurn.modelA,
              modelB:
                nextTurn.modelB && responseHasProgress(nextTurn.modelB)
                  ? nextTurn.modelB
                  : previousTurn.modelB,
            };
          });

          persistModeConversation('compare', {
            turns: mergedTurns,
            singleHistory,
            compareHistory: progressHistory,
          });

          return mergedTurns;
        });
      },
    });

    setTurns(result.turns);
    setCompareHistory(result.compareHistory);
    persistModeConversation('compare', {
      turns: result.turns,
      singleHistory,
      compareHistory: result.compareHistory,
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

    followConversationRef.current = true;
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

  if (!settings.token || !settings.workspaceId || promptBots.length === 0)
    return (
      <>
        <PageHeader title="Model Testing" />
        <EmptyState
          title="Configuration required"
          description="Configure the FR, DE and ES bots in Settings."
        />
      </>
    );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Model Testing"
        description="Test prompts and compare model responses"
        actions={
          <Select
            value={selectedBotId}
            onValueChange={setSelectedBotId}
            disabled={running}
          >
            <SelectTrigger aria-label="Bot" className="h-9 w-[180px]">
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
        }
      />
      {modelsError && (
        <ErrorState title="Unable to load models" description={modelsError} />
      )}
      {modelsLoading && (
        <LoadingState variant="inline" label="Loading models…" />
      )}
      {promptQuery.error && (
        <ErrorState
          title="Unable to load prompts"
          onRetry={() => void promptQuery.refetch()}
        />
      )}
      <PageTabs
        value={comparisonEnabled ? 'compare' : 'single'}
        onValueChange={(value) => {
          if ((value === 'compare') !== comparisonEnabled)
            handleComparisonToggle();
        }}
      >
        <PageTabList aria-label="Test mode">
          <PageTab value="single" disabled={running}>
            Single
          </PageTab>
          <PageTab value="compare" disabled={running}>
            Compare
          </PageTab>
        </PageTabList>
        <PageTabPanel value={comparisonEnabled ? 'compare' : 'single'}>
          <Toolbar
            actions={
              <>
                <Button
                  ref={settingsButtonRef}
                  variant="outline"
                  onClick={openTestSettings}
                  disabled={running}
                >
                  Test settings
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void saveConfig()}
                  disabled={running}
                >
                  Save configuration
                </Button>
                <Button onClick={openPushDialog} disabled={running}>
                  Push to live
                </Button>
              </>
            }
          >
            <Select
              value={selectedModelA}
              onValueChange={handleModelAChange}
              disabled={running || modelsLoading}
            >
              <SelectTrigger aria-label="Model A" className="w-[220px]">
                <SelectValue placeholder="Model A" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {getPrettyModelName(model)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {comparisonEnabled && (
              <Select
                value={selectedModelB}
                onValueChange={handleModelBChange}
                disabled={running || modelsLoading}
              >
                <SelectTrigger aria-label="Model B" className="w-[220px]">
                  <SelectValue placeholder="Model B" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {getPrettyModelName(model)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span className="text-xs text-muted-foreground">
              Thinking: {thinking} · Temperature: {temperature}
            </span>
          </Toolbar>
        </PageTabPanel>
      </PageTabs>
      <section aria-label="Conversation" className="min-h-0">
        <div className="min-w-0 min-h-0">
          <div className="flex min-w-0 flex-col">
            <div className="px-1 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                  <Badge
                    variant="neutral"
                    className="max-w-[260px] truncate border-border bg-surface text-foreground"
                  >
                    Prompt: {selectedPrompt?.label || 'Not selected'}
                  </Badge>
                  <Badge variant={configSaved ? 'success' : 'warning'}>
                    {configSaved ? 'Saved' : 'Unsaved'}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg border-border bg-surface"
                  disabled={running}
                  onClick={clearConversation}
                >
                  <Plus className="size-4" />
                  New conversation
                </Button>
              </div>
            </div>

            <div ref={conversationRef} onScroll={(event) => {
              const node = event.currentTarget;
              followConversationRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100;
            }} role="region" aria-label="Conversation messages" tabIndex={0} className="h-[55dvh] min-h-[280px] overflow-y-auto overscroll-contain">
              <div className={`mx-auto space-y-10 px-2 py-8 sm:px-6 ${comparisonEnabled ? 'max-w-6xl' : 'max-w-3xl'}`}>
                {turns.length === 0 ? (
                  <div className="flex min-h-[30dvh] items-center justify-center">
                    <div className="max-w-md text-center">
                      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
                        <Bot className="size-5" />
                      </div>
                      <p className="text-lg font-medium text-foreground">
                        {comparisonEnabled
                          ? 'Run your first comparison'
                          : 'Start a conversation'}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Write a message below, then{' '}
                        {comparisonEnabled
                          ? 'run both models in parallel.'
                          : 'test the selected model.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  turns.map((turn) => (
                    <article key={turn.id} className="space-y-6">
                      <UserMessage
                        text={turn.userText}
                        createdAt={turn.createdAt}
                      />

                      {turn.modelB ? (
                        <SplitPane
                          left={
                            <ResponsePanel
                              response={turn.modelA}
                              title={getPrettyModelName(selectedModelAData)}
                            />
                          }
                          right={
                            <ResponsePanel
                              response={turn.modelB}
                              title={getPrettyModelName(selectedModelBData)}
                            />
                          }
                        />
                      ) : (
                        <ResponsePanel
                          response={turn.modelA}
                          title={getPrettyModelName(selectedModelAData)}
                        />
                      )}
                    </article>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <div className={`mx-auto w-full px-2 pt-4 sm:px-6 ${comparisonEnabled ? 'max-w-6xl' : 'max-w-3xl'}`}>
            <TestComposer
              value={userMessage}
              onChange={setUserMessage}
              onRun={() => void handleRun()}
              running={running}
              compare={comparisonEnabled}
              disabled={
                running ||
                modelsLoading ||
                !userMessage.trim() ||
                !selectedModelA ||
                !selectedPrompt?.prompt ||
                (comparisonEnabled &&
                  (!selectedModelB || selectedModelA === selectedModelB))
              }
            />
            </div>
          </div>
        </div>
      </section>

      <Dialog
        open={testSettingsOpen}
        onOpenChange={(open) =>
          open ? setTestSettingsOpen(true) : closeTestSettings()
        }
      >
        <DialogContent
          className="grid max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[1100px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0 sm:max-w-[1100px]"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById('test-settings-provider-a')?.focus();
          }}
        >
          <DialogHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
            <DialogTitle>Test settings</DialogTitle>
            <DialogDescription>
              Configure the response and decision models used for this test
              session.
            </DialogDescription>
          </DialogHeader>

          {testSettingsDraft && (
            <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
              {modelsError && (
                <Alert className="mb-5 border-danger/30 bg-danger/10 text-danger">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Unable to load models</AlertTitle>
                  <AlertDescription>{modelsError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="space-y-5 border-t pt-4">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Response models
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Models that compose the final response.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <Label htmlFor="test-settings-provider-a">
                        Provider A
                      </Label>
                      <Select
                        value={testSettingsDraft.selectedProviderA}
                        onValueChange={(provider) => {
                          const firstModel = models.find(
                            (model) =>
                              getProviderFromModelId(model.id) === provider,
                          );
                          setTestSettingsDraft((draft) =>
                            draft
                              ? {
                                  ...draft,
                                  selectedProviderA: provider,
                                  selectedModelA: firstModel?.id ?? '',
                                }
                              : draft,
                          );
                        }}
                      >
                        <SelectTrigger id="test-settings-provider-a">
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
                      <Label htmlFor="test-settings-model-a">Model A</Label>
                      <Select
                        value={testSettingsDraft.selectedModelA}
                        onValueChange={(model) =>
                          setTestSettingsDraft((draft) =>
                            draft ? { ...draft, selectedModelA: model } : draft,
                          )
                        }
                      >
                        <SelectTrigger id="test-settings-model-a">
                          <SelectValue placeholder="Select model A" />
                        </SelectTrigger>
                        <SelectContent>
                          {draftModelsForProviderA.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {getPrettyModelName(model)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {comparisonEnabled && (
                    <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <Label htmlFor="test-settings-provider-b">
                          Provider B
                        </Label>
                        <Select
                          value={testSettingsDraft.selectedProviderB}
                          onValueChange={(provider) => {
                            const firstModel = models.find(
                              (model) =>
                                getProviderFromModelId(model.id) === provider,
                            );
                            setTestSettingsDraft((draft) =>
                              draft
                                ? {
                                    ...draft,
                                    selectedProviderB: provider,
                                    selectedModelB: firstModel?.id ?? '',
                                  }
                                : draft,
                            );
                          }}
                        >
                          <SelectTrigger id="test-settings-provider-b">
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
                        <Label htmlFor="test-settings-model-b">Model B</Label>
                        <Select
                          value={testSettingsDraft.selectedModelB}
                          onValueChange={(model) =>
                            setTestSettingsDraft((draft) =>
                              draft
                                ? { ...draft, selectedModelB: model }
                                : draft,
                            )
                          }
                        >
                          <SelectTrigger id="test-settings-model-b">
                            <SelectValue placeholder="Select model B" />
                          </SelectTrigger>
                          <SelectContent>
                            {draftModelsForProviderB.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {getPrettyModelName(model)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="test-settings-response-thinking">
                        Reasoning effort
                      </Label>
                      <Select
                        value={testSettingsDraft.thinking}
                        onValueChange={(value) =>
                          setTestSettingsDraft((draft) =>
                            draft
                              ? { ...draft, thinking: value as ThinkingOption }
                              : draft,
                          )
                        }
                      >
                        <SelectTrigger id="test-settings-response-thinking">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {THINKING_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="test-settings-response-temperature">
                        Temperature{' '}
                        <span className="font-normal text-muted-foreground">
                          {testSettingsDraft.temperature.toFixed(1)}
                        </span>
                      </Label>
                      <input
                        id="test-settings-response-temperature"
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={testSettingsDraft.temperature}
                        onChange={(event) =>
                          setTestSettingsDraft((draft) =>
                            draft
                              ? {
                                  ...draft,
                                  temperature: Number(event.target.value),
                                }
                              : draft,
                          )
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-5 border-t pt-4">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Decision model
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Model used for routing and tool decisions.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <Label htmlFor="test-settings-decision-provider">
                        Provider
                      </Label>
                      <Select
                        value={testSettingsDraft.selectedCheapProvider}
                        onValueChange={(provider) => {
                          const firstModel = models.find(
                            (model) =>
                              getProviderFromModelId(model.id) === provider,
                          );
                          setTestSettingsDraft((draft) =>
                            draft
                              ? {
                                  ...draft,
                                  selectedCheapProvider: provider,
                                  selectedCheapModel: firstModel?.id ?? '',
                                }
                              : draft,
                          );
                        }}
                      >
                        <SelectTrigger id="test-settings-decision-provider">
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
                      <Label htmlFor="test-settings-decision-model">
                        Model
                      </Label>
                      <Select
                        value={testSettingsDraft.selectedCheapModel}
                        onValueChange={(model) =>
                          setTestSettingsDraft((draft) =>
                            draft
                              ? { ...draft, selectedCheapModel: model }
                              : draft,
                          )
                        }
                      >
                        <SelectTrigger id="test-settings-decision-model">
                          <SelectValue placeholder="Select decision model" />
                        </SelectTrigger>
                        <SelectContent>
                          {draftDecisionModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {getPrettyModelName(model)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="test-settings-decision-thinking">
                        Reasoning effort
                      </Label>
                      <Select
                        value={testSettingsDraft.cheapReasoningEffort}
                        onValueChange={(value) =>
                          setTestSettingsDraft((draft) =>
                            draft
                              ? {
                                  ...draft,
                                  cheapReasoningEffort: value as ThinkingOption,
                                }
                              : draft,
                          )
                        }
                      >
                        <SelectTrigger id="test-settings-decision-thinking">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {THINKING_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="test-settings-decision-temperature">
                        Temperature{' '}
                        <span className="font-normal text-muted-foreground">
                          {testSettingsDraft.cheapTemperature.toFixed(1)}
                        </span>
                      </Label>
                      <input
                        id="test-settings-decision-temperature"
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={testSettingsDraft.cheapTemperature}
                        onChange={(event) =>
                          setTestSettingsDraft((draft) =>
                            draft
                              ? {
                                  ...draft,
                                  cheapTemperature: Number(event.target.value),
                                }
                              : draft,
                          )
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                      />
                    </div>
                  </div>
                </section>
              </div>

              <section className="mt-5 space-y-4 border-t pt-4">
                <div>
                  <h3 className="font-semibold text-foreground">Prompt</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose the system prompt used by both response models.
                  </p>
                </div>
                <Select
                  value={testSettingsDraft.selectedPromptKey}
                  onValueChange={(key) =>
                    setTestSettingsDraft((draft) =>
                      draft ? { ...draft, selectedPromptKey: key } : draft,
                    )
                  }
                >
                  <SelectTrigger
                    id="test-settings-prompt"
                    aria-label="System prompt"
                  >
                    <SelectValue placeholder="Select a prompt" />
                  </SelectTrigger>
                  <SelectContent>
                    {promptOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {draftPrompt ? (
                  <div className="rounded-lg bg-muted p-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral" className="bg-surface">
                        {draftPrompt.version}
                      </Badge>
                      <span className="truncate text-sm font-medium text-foreground">
                        {draftPrompt.label || 'Untitled prompt'}
                      </span>
                    </div>
                    <p className="mt-3 max-h-36 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {draftPrompt.prompt || 'Empty prompt.'}
                    </p>
                  </div>
                ) : null}
              </section>
            </div>
          )}

          <DialogFooter className="border-t border-border bg-surface px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={closeTestSettings}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!canApplyTestSettings || modelsLoading}
              onClick={applyTestSettings}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pushDialogOpen}
        onOpenChange={(open) => !pushConfigSaving && setPushDialogOpen(open)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Push to live</DialogTitle>
            <DialogDescription>
              Confirm the response and decision model settings to publish to the
              selected bot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                className="flex flex-wrap items-center gap-2"
                htmlFor="push-model"
              >
                Response model
                <Badge
                  variant="neutral"
                  className="max-w-full truncate border-border bg-muted text-muted-foreground"
                >
                  Current:{' '}
                  {pushConfigLoading
                    ? 'loading'
                    : liveStrongModelConfig?.model || '-'}
                </Badge>
              </Label>
              <Select value={pushModelId} onValueChange={setPushModelId}>
                <SelectTrigger id="push-model">
                  <SelectValue placeholder="Choisir un model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {getProviderLabel(getProviderFromModelId(model.id))} -{' '}
                      {getPrettyModelName(model)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                className="flex flex-wrap items-center gap-2"
                htmlFor="push-cheap-model"
              >
                Decision model
                <Badge
                  variant="neutral"
                  className="max-w-full truncate border-border bg-muted text-muted-foreground"
                >
                  Current:{' '}
                  {pushConfigLoading
                    ? 'loading'
                    : liveCheapModelConfig?.model || '-'}
                </Badge>
              </Label>
              <Select
                value={pushCheapModelId}
                onValueChange={setPushCheapModelId}
              >
                <SelectTrigger id="push-cheap-model">
                  <SelectValue placeholder="Choisir un modele de decision" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {getProviderLabel(getProviderFromModelId(model.id))} -{' '}
                      {getPrettyModelName(model)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                className="flex flex-wrap items-center gap-2"
                htmlFor="push-decision-temperature"
              >
                Decision temperature
                <Badge
                  variant="neutral"
                  className="border-border bg-muted text-muted-foreground"
                >
                  Current:{' '}
                  {pushConfigLoading
                    ? 'loading'
                    : (liveCheapModelConfig?.temperature.toFixed(1) ?? '-')}
                </Badge>
              </Label>
              <input
                id="push-decision-temperature"
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={pushCheapTemperature}
                onChange={(event) =>
                  setPushCheapTemperature(event.target.value)
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <div className="text-right text-sm font-medium">
                {(Number(pushCheapTemperature) || 0).toFixed(1)}
              </div>
            </div>

            <div className="space-y-2">
              <Label
                className="flex flex-wrap items-center gap-2"
                htmlFor="push-decision-thinking"
              >
                Decision thinking
                <Badge
                  variant="neutral"
                  className="border-border bg-muted text-muted-foreground"
                >
                  Current:{' '}
                  {pushConfigLoading
                    ? 'loading'
                    : liveCheapModelConfig?.reasoningEffort || '-'}
                </Badge>
              </Label>
              <Select
                value={pushCheapReasoningEffort}
                onValueChange={(value) =>
                  setPushCheapReasoningEffort(value as ThinkingOption)
                }
              >
                <SelectTrigger id="push-decision-thinking">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THINKING_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                className="flex flex-wrap items-center gap-2"
                htmlFor="push-temperature"
              >
                Response temperature
                <Badge
                  variant="neutral"
                  className="border-border bg-muted text-muted-foreground"
                >
                  Current:{' '}
                  {pushConfigLoading
                    ? 'loading'
                    : (liveStrongModelConfig?.temperature.toFixed(1) ?? '-')}
                </Badge>
              </Label>
              <div className="rounded-xl border border-border bg-muted px-3 py-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-foreground">Precision</span>
                  <span className="font-medium text-foreground">
                    {(Number(pushTemperature) || 0).toFixed(1)}
                  </span>
                </div>
                <input
                  id="push-temperature"
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={pushTemperature}
                  onChange={(event) => setPushTemperature(event.target.value)}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>0.0</span>
                  <span>1.0</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                className="flex flex-wrap items-center gap-2"
                htmlFor="push-reasoning-effort"
              >
                Response thinking
                <Badge
                  variant="neutral"
                  className="border-border bg-muted text-muted-foreground"
                >
                  Current:{' '}
                  {pushConfigLoading
                    ? 'loading'
                    : liveStrongModelConfig?.reasoningEffort || '-'}
                </Badge>
              </Label>
              <Select
                value={pushReasoningEffort}
                onValueChange={(value) =>
                  setPushReasoningEffort(value as ThinkingOption)
                }
              >
                <SelectTrigger id="push-reasoning-effort">
                  <SelectValue placeholder="Choisir le thinking" />
                </SelectTrigger>
                <SelectContent>
                  {THINKING_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={
                pushConfigLoading ||
                pushConfigSaving ||
                !liveStrongModelConfig ||
                !liveCheapModelConfig
              }
              onClick={() => void handlePushToLive()}
            >
              {pushConfigSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Push
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
