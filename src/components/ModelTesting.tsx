import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  Check,
  Copy,
  ExternalLink,
  ImageIcon,
  Info,
  Languages,
  Loader2,
  MessageCircleMore,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  SlidersHorizontal,
  Sparkles,
  Split,
} from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useBotpressClient } from '@/hooks/useBotpressClient';
import { fetchCognitiveModels, generateTextWithCognitiveApi } from '@/lib/cognitiveApi';
import { cn } from '@/lib/utils';
import { normalizePromptRow, partitionPromptRows, type PromptRow } from '@/lib/promptVersions';
import type {
  ChatTurn,
  CognitiveModel,
  LocalChatMessage,
  ModelResponse,
  ModelTestMode,
  PerModelHistory,
} from '@/types/modelTesting';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const TABLE_NAME = 'promptsTable';
const ALLOWED_PROMPT_BOTS = new Set(['fr', 'de', 'es']);
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 1200;

const STARTER_SUGGESTIONS = [
  'Aide-moi a analyser un ticket client',
  'Comment gerer une demande de remboursement ?',
  'Quels sont les delais de livraison actuels ?',
];

type ProviderKey = string;

function getProviderFromModelId(modelId: string): ProviderKey {
  return modelId.split(':')[0] || 'other';
}

function getProviderLabel(provider: ProviderKey) {
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

function formatTime(isoDate: string) {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

function latencyLabel(latencyMs: number) {
  return `${(latencyMs / 1000).toFixed(1).replace('.', ',')} s`;
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

export default function ModelTesting() {
  const { settings } = useSettings();
  const promptBots = useMemo(
    () => settings.bots.filter((bot) => ALLOWED_PROMPT_BOTS.has(bot.id) && bot.botId),
    [settings.bots]
  );

  const [selectedBotId, setSelectedBotId] = useState('');
  const [mode, setMode] = useState<ModelTestMode>('single');
  const [temperature, setTemperature] = useState<number>(DEFAULT_TEMPERATURE);
  const [userMessage, setUserMessage] = useState('');
  const [syncScroll, setSyncScroll] = useState(true);
  const [configSaved, setConfigSaved] = useState(true);
  const [configSheetOpen, setConfigSheetOpen] = useState(false);
  const configBootedRef = useRef(false);

  const [models, setModels] = useState<CognitiveModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [selectedProviderA, setSelectedProviderA] = useState<ProviderKey>('');
  const [selectedProviderB, setSelectedProviderB] = useState<ProviderKey>('');
  const [selectedModelA, setSelectedModelA] = useState('');
  const [selectedModelB, setSelectedModelB] = useState('');

  const [promptRows, setPromptRows] = useState<PromptRow[]>([]);

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [singleHistory, setSingleHistory] = useState<LocalChatMessage[]>([]);
  const [compareHistory, setCompareHistory] = useState<PerModelHistory>({ modelA: [], modelB: [] });
  const [running, setRunning] = useState(false);
  const [preferredByTurn, setPreferredByTurn] = useState<Record<string, 'A' | 'B' | null>>({});

  const client = useBotpressClient(selectedBotId);
  const prompts = useMemo(() => partitionPromptRows(promptRows), [promptRows]);
  const activePrompt = prompts.live?.prompt ?? '';
  const activePromptLabel = prompts.live?.label || 'Prompt live';

  const providers = useMemo(() => {
    const set = new Set<ProviderKey>();
    for (const model of models) {
      set.add(getProviderFromModelId(model.id));
    }
    return Array.from(set);
  }, [models]);

  const modelsForProviderA = useMemo(
    () => models.filter((model) => getProviderFromModelId(model.id) === selectedProviderA),
    [models, selectedProviderA]
  );
  const modelsForProviderB = useMemo(
    () => models.filter((model) => getProviderFromModelId(model.id) === selectedProviderB),
    [models, selectedProviderB]
  );

  const modelAData = useMemo(
    () => models.find((model) => model.id === selectedModelA) ?? null,
    [models, selectedModelA]
  );
  const modelBData = useMemo(
    () => models.find((model) => model.id === selectedModelB) ?? null,
    [models, selectedModelB]
  );

  useEffect(() => {
    if (!selectedBotId && promptBots[0]) {
      setSelectedBotId(promptBots[0].botId);
    }
  }, [promptBots, selectedBotId]);

  useEffect(() => {
    if (!selectedBotId || !settings.token) {
      return;
    }

    void loadModels();
    if (client) {
      void loadPrompts();
    }

    setTurns([]);
    setSingleHistory([]);
    setCompareHistory({ modelA: [], modelB: [] });
    setPreferredByTurn({});
    setUserMessage('');
  }, [selectedBotId, settings.token, client]);

  useEffect(() => {
    if (!models.length) {
      setSelectedModelA('');
      setSelectedModelB('');
      setSelectedProviderA('');
      setSelectedProviderB('');
      return;
    }

    if (!selectedModelA || !models.some((model) => model.id === selectedModelA)) {
      const recommended = models.find((model) => model.tags?.includes('recommended'));
      const fallback = recommended ?? models[0];
      setSelectedModelA(fallback.id);
      setSelectedProviderA(getProviderFromModelId(fallback.id));
    }
  }, [models, selectedModelA]);

  useEffect(() => {
    if (!models.length) {
      return;
    }

    const modelA = selectedModelA || models[0].id;
    const secondModel = models.find((model) => model.id !== modelA) ?? models[0];

    if (!selectedModelB || !models.some((model) => model.id === selectedModelB)) {
      setSelectedModelB(secondModel.id);
      setSelectedProviderB(getProviderFromModelId(secondModel.id));
    }
  }, [models, selectedModelA, selectedModelB]);

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
  }, [selectedProviderA, modelsForProviderA, selectedModelA]);

  useEffect(() => {
    if (!selectedProviderB || !modelsForProviderB.length) {
      return;
    }
    if (!modelsForProviderB.some((model) => model.id === selectedModelB)) {
      setSelectedModelB(modelsForProviderB[0].id);
    }
  }, [selectedProviderB, modelsForProviderB, selectedModelB]);

  useEffect(() => {
    const ready = Boolean(selectedModelA && temperature);
    if (!ready) {
      return;
    }
    if (!configBootedRef.current) {
      configBootedRef.current = true;
      return;
    }
    setConfigSaved(false);
  }, [mode, selectedProviderA, selectedProviderB, selectedModelA, selectedModelB, temperature]);

  async function loadModels() {
    if (!selectedBotId || !settings.token) {
      return;
    }

    setModelsLoading(true);
    setModelsError(null);
    try {
      const nextModels = await fetchCognitiveModels(settings.token, selectedBotId);
      setModels(nextModels);
    } catch (error: any) {
      console.error('Error loading cognitive models:', error);
      setModelsError(error?.message || 'Failed to load models');
      toast.error('Failed to load cognitive models');
    } finally {
      setModelsLoading(false);
    }
  }

  async function loadPrompts() {
    if (!client) {
      return;
    }

    try {
      const response = await client.findTableRows({
        table: TABLE_NAME,
        limit: 100,
        orderBy: 'updatedAt',
        orderDirection: 'desc',
      });
      const rows = response.rows.map((row: Record<string, unknown>) => normalizePromptRow(row));
      setPromptRows(rows);
    } catch (error) {
      console.error('Error loading prompts:', error);
      toast.error('Failed to load prompts');
    }
  }

  async function saveConfig() {
    setConfigSaved(true);
    toast.success('Configuration enregistree');
    setConfigSheetOpen(false);
  }

  function clearHistory() {
    setTurns([]);
    setSingleHistory([]);
    setCompareHistory({ modelA: [], modelB: [] });
    setPreferredByTurn({});
  }

  function startNewConversation() {
    clearHistory();
    setUserMessage('');
    toast.success('Nouvelle conversation');
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copie');
    } catch {
      toast.error('Impossible de copier');
    }
  }

  async function runSingleTurn(message: string) {
    const historyWithMessage: LocalChatMessage[] = [...singleHistory, { role: 'user', content: message }];
    const result = await generateTextWithCognitiveApi({
      token: settings.token,
      botId: selectedBotId,
      model: selectedModelA,
      systemPrompt: activePrompt,
      messages: historyWithMessage,
      temperature,
      maxTokens: DEFAULT_MAX_TOKENS,
    });

    const responseText = result.text || '[Empty response]';
    const modelA = buildModelResponse({ modelId: selectedModelA, result });

    setTurns((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userText: message,
        modelA: { ...modelA, text: responseText },
      },
    ]);

    setSingleHistory((prev) => [
      ...prev,
      { role: 'user', content: message },
      { role: 'assistant', content: responseText },
    ]);
  }

  async function runCompareTurn(message: string) {
    if (!selectedModelB) {
      throw new Error('Model B is missing');
    }
    if (selectedModelA === selectedModelB) {
      throw new Error('Choose two different models in compare mode');
    }

    const historyA: LocalChatMessage[] = [...compareHistory.modelA, { role: 'user', content: message }];
    const historyB: LocalChatMessage[] = [...compareHistory.modelB, { role: 'user', content: message }];

    const [resultA, resultB] = await Promise.allSettled([
      generateTextWithCognitiveApi({
        token: settings.token,
        botId: selectedBotId,
        model: selectedModelA,
        systemPrompt: activePrompt,
        messages: historyA,
        temperature,
        maxTokens: DEFAULT_MAX_TOKENS,
      }),
      generateTextWithCognitiveApi({
        token: settings.token,
        botId: selectedBotId,
        model: selectedModelB,
        systemPrompt: activePrompt,
        messages: historyB,
        temperature,
        maxTokens: DEFAULT_MAX_TOKENS,
      }),
    ]);

    const modelA =
      resultA.status === 'fulfilled'
        ? buildModelResponse({ modelId: selectedModelA, result: resultA.value })
        : buildModelResponse({ modelId: selectedModelA, error: resultA.reason?.message || 'Generation failed' });
    const modelB =
      resultB.status === 'fulfilled'
        ? buildModelResponse({ modelId: selectedModelB, result: resultB.value })
        : buildModelResponse({ modelId: selectedModelB, error: resultB.reason?.message || 'Generation failed' });

    setTurns((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userText: message,
        modelA,
        modelB,
      },
    ]);

    setCompareHistory({
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
    });
  }

  async function handleRun() {
    const trimmedMessage = userMessage.trim();

    if (!selectedBotId || !settings.token) {
      toast.error('Botpress configuration is missing');
      return;
    }
    if (!activePrompt.trim()) {
      toast.error('Aucun prompt live trouve pour ce bot');
      return;
    }
    if (!trimmedMessage) {
      toast.error('User message is required');
      return;
    }
    if (!selectedModelA) {
      toast.error('Please select model A');
      return;
    }

    setRunning(true);
    try {
      if (mode === 'single') {
        await runSingleTurn(trimmedMessage);
      } else {
        await runCompareTurn(trimmedMessage);
      }
      setUserMessage('');
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error?.message || 'Generation failed');
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
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <section className="space-y-2 px-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[2.05rem] font-semibold tracking-[-0.04em] text-slate-900">Test de modeles</h2>
            <p className="text-[1rem] text-slate-500">
              {mode === 'single'
                ? "Testez l'agent de production avec un autre modele."
                : "Testez l'agent de production avec deux modeles en parallele."}
            </p>
          </div>

          <div className="flex h-10 min-w-[180px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5">
            <Languages className="size-4 text-slate-500" />
            <Select value={selectedBotId} onValueChange={setSelectedBotId}>
              <SelectTrigger className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0">
                <SelectValue placeholder="Version" />
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
        </div>
      </section>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Info className="size-4 text-slate-500" />
            <span className="font-medium">Prompt actif</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-600">{activePromptLabel}</span>
            <span className="text-slate-400">gere dans l'onglet Prompt</span>
          </div>
          <Button
            variant="ghost"
            className="h-8 px-2.5 text-sm text-teal-700 hover:bg-teal-50 hover:text-teal-800"
            onClick={() => toast.info('Ouvre l onglet Prompts depuis la sidebar Test.')}
          >
            Voir le prompt
            <ExternalLink className="size-3.5" />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200 py-0 shadow-sm">
        <CardContent className="space-y-3 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={mode} onValueChange={(value) => setMode(value as ModelTestMode)}>
              <TabsList className="h-10 rounded-lg border border-slate-200 bg-slate-50 p-1">
                <TabsTrigger value="single" className="h-8 rounded-md px-4 text-sm">
                  <Sparkles className="size-4" />
                  Simple
                </TabsTrigger>
                <TabsTrigger value="compare" className="h-8 rounded-md px-4 text-sm">
                  <Split className="size-4" />
                  Comparaison A/B
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Separator orientation="vertical" className="mx-1 hidden h-6 md:block" />

            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
              <Bot className="size-4 text-teal-600" />
              <span>
                {getProviderLabel(selectedProviderA)} · {getPrettyModelName(modelAData)} · Temp {temperature}
              </span>
            </div>

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

            <Button
              variant="ghost"
              className="h-8 px-2.5 text-sm"
              onClick={() => setConfigSheetOpen(true)}
            >
              <Pencil className="size-4" />
              Modifier
            </Button>

            <Button
              variant="outline"
              className="ml-auto h-8 rounded-lg border-slate-200 bg-white text-sm"
              onClick={() => void saveConfig()}
            >
              <Save className="size-4" />
              Enregistrer la config
            </Button>
          </div>

          {mode === 'compare' && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <Badge className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                A
              </Badge>
              <span>
                {getProviderLabel(selectedProviderA)} · {getPrettyModelName(modelAData)} · Temp {temperature}
              </span>
              <span className="mx-1 text-slate-300">|</span>
              <Badge className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                B
              </Badge>
              <span>
                {getProviderLabel(selectedProviderB)} · {getPrettyModelName(modelBData)} · Temp {temperature}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {modelsError && (
        <Alert className="border-rose-200 bg-rose-50 text-rose-900">
          <AlertCircle className="size-4" />
          <AlertTitle>Erreur de chargement modeles</AlertTitle>
          <AlertDescription>{modelsError}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between px-1 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span>
            {mode === 'single'
              ? 'Config active pour cette conversation'
              : 'Meme entree envoyee aux deux modeles'}
          </span>
        </div>
        {mode === 'compare' && (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-slate-600"
            onClick={() => setSyncScroll((prev) => !prev)}
          >
            <span>Defilement synchronise</span>
            <span
              className={cn(
                'relative inline-flex h-5 w-9 rounded-full transition-colors',
                syncScroll ? 'bg-teal-600' : 'bg-slate-300'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full bg-white transition-transform',
                  syncScroll ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </span>
          </button>
        )}
      </div>

      <Card className="overflow-hidden border-slate-200 py-0 shadow-sm">
        <CardHeader className="border-b border-slate-200/80 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-[1.8rem] tracking-[-0.03em]">
                <MessageCircleMore className="size-5 text-slate-700" />
                {mode === 'single' ? 'Conversation' : 'Conversation comparative'}
              </CardTitle>
              <div className="mt-1">
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                  Contexte conserve dans cette conversation
                </Badge>
              </div>
            </div>

            <Button
              variant="outline"
              className="h-9 rounded-lg border-slate-200 bg-white"
              onClick={startNewConversation}
            >
              <Plus className="size-4" />
              Nouvelle conversation
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-4 py-4">
          {turns.length === 0 ? (
            <div className="space-y-4 py-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-teal-700">
                <MessageCircleMore className="size-6" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">Bienvenue !</p>
                <p className="mt-1 text-slate-500">
                  Commencez a tester votre agent avec l une des suggestions ci dessous
                </p>
              </div>

              <div className="mx-auto grid max-w-xl gap-2">
                {STARTER_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setUserMessage(suggestion)}
                  >
                    <Sparkles className="size-4 text-slate-400" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {turns.map((turn) => {
                const preferred = preferredByTurn[turn.id];

                return (
                  <article key={turn.id} className="space-y-3">
                    <div className="text-xs text-slate-400">{formatTime(turn.createdAt)}</div>

                    <div className="flex justify-end gap-2">
                      <div className="max-w-[80%] rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-[15px] leading-7 text-slate-800">
                        <p className="whitespace-pre-wrap">{turn.userText}</p>
                      </div>
                      <Avatar className="size-9 border border-slate-200">
                        <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-600">
                          AD
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {turn.modelB ? (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {[{ key: 'A', response: turn.modelA }, { key: 'B', response: turn.modelB }].map(
                          (entry) => {
                            const response = entry.response as ModelResponse;
                            const cost = costLabel(response.usage);
                            const modelData = models.find((model) => model.id === response.modelId) ?? null;

                            return (
                              <div
                                key={`${turn.id}-${entry.key}`}
                                className="rounded-xl border border-slate-200 bg-white p-3"
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Badge className="rounded-full bg-slate-100 text-slate-700">
                                      {entry.key}
                                    </Badge>
                                    <span className="text-base font-semibold text-slate-900">
                                      Reponse {entry.key}
                                    </span>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="border-slate-200 bg-slate-50 text-slate-600"
                                  >
                                    {getProviderLabel(getProviderFromModelId(response.modelId))} ·{' '}
                                    {getPrettyModelName(modelData)}
                                  </Badge>
                                </div>

                                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                  <Badge variant="outline" className="border-slate-200 bg-slate-50">
                                    Latence {latencyLabel(response.latencyMs)}
                                  </Badge>
                                  {cost && (
                                    <Badge variant="outline" className="border-slate-200 bg-slate-50">
                                      Cout {cost}
                                    </Badge>
                                  )}
                                  <button
                                    type="button"
                                    className="ml-auto text-slate-500 hover:text-slate-700"
                                    onClick={() => void copyText(response.text)}
                                  >
                                    <Copy className="size-4" />
                                  </button>
                                  <button
                                    type="button"
                                    className="text-slate-500 hover:text-slate-700"
                                    onClick={() => setUserMessage(turn.userText)}
                                  >
                                    <RefreshCw className="size-4" />
                                  </button>
                                </div>

                                {response.error ? (
                                  <p className="whitespace-pre-wrap text-sm leading-7 text-rose-700">
                                    {response.error}
                                  </p>
                                ) : (
                                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                                    {response.text || '[Empty response]'}
                                  </p>
                                )}

                                <Button
                                  variant={preferred === entry.key ? 'default' : 'outline'}
                                  className={cn(
                                    'mt-3 h-9 w-full',
                                    preferred === entry.key
                                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                  )}
                                  onClick={() =>
                                    setPreferredByTurn((prev) => ({
                                      ...prev,
                                      [turn.id]:
                                        prev[turn.id] === entry.key ? null : (entry.key as 'A' | 'B'),
                                    }))
                                  }
                                >
                                  <Check className="size-4" />
                                  Preferer {entry.key}
                                </Button>
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-teal-700 text-white shadow-sm">
                          <Sparkles className="size-4" />
                        </div>

                        <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <Badge variant="outline" className="border-slate-200 bg-slate-50">
                              {getProviderLabel(getProviderFromModelId(turn.modelA.modelId))} ·{' '}
                              {getPrettyModelName(modelAData)}
                            </Badge>
                            <Badge variant="outline" className="border-slate-200 bg-slate-50">
                              Latence {latencyLabel(turn.modelA.latencyMs)}
                            </Badge>
                            {costLabel(turn.modelA.usage) && (
                              <Badge variant="outline" className="border-slate-200 bg-slate-50">
                                Cout {costLabel(turn.modelA.usage)}
                              </Badge>
                            )}
                            <button
                              type="button"
                              className="ml-auto text-slate-500 hover:text-slate-700"
                              onClick={() => void copyText(turn.modelA.text)}
                            >
                              <Copy className="size-4" />
                            </button>
                            <button
                              type="button"
                              className="text-slate-500 hover:text-slate-700"
                              onClick={() => setUserMessage(turn.userText)}
                            >
                              <RefreshCw className="size-4" />
                            </button>
                          </div>

                          {turn.modelA.error ? (
                            <p className="whitespace-pre-wrap text-sm leading-7 text-rose-700">
                              {turn.modelA.error}
                            </p>
                          ) : (
                            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                              {turn.modelA.text || '[Empty response]'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>

        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <Textarea
              value={userMessage}
              onChange={(event) => setUserMessage(event.target.value)}
              placeholder={
                mode === 'single'
                  ? 'Pose une question a l agent...'
                  : 'Pose une question aux deux modeles...'
              }
              className="min-h-[82px] border-0 bg-transparent px-1 py-1 text-[15px] leading-7 shadow-none focus-visible:ring-0"
            />

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-slate-500">
                <Button variant="ghost" size="icon-sm" className="rounded-md">
                  <Paperclip className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" className="rounded-md">
                  <ImageIcon className="size-4" />
                </Button>
              </div>

              <Button
                onClick={() => void handleRun()}
                disabled={
                  running ||
                  modelsLoading ||
                  !selectedModelA ||
                  (mode === 'compare' && selectedModelA === selectedModelB)
                }
                className="h-10 rounded-lg bg-teal-700 px-4 text-white hover:bg-teal-800"
              >
                {running ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {mode === 'single' ? 'Envoyer' : 'Comparer'}
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Entree pour envoyer · Shift + Entree pour passer a la ligne</span>
            {mode === 'compare' && (
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5" />
                Le meme contexte de conversation est envoye aux deux modeles.
              </span>
            )}
          </div>
        </div>
      </Card>

      <Sheet open={configSheetOpen} onOpenChange={setConfigSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Modifier la configuration</SheetTitle>
            <SheetDescription>
              {mode === 'single'
                ? 'Selectionnez le provider, le modele et la temperature.'
                : 'Selectionnez les modeles A/B et la temperature.'}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="space-y-2">
              <Label>Provider A</Label>
              <Select value={selectedProviderA} onValueChange={setSelectedProviderA}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un provider" />
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
              <Label>Modele A</Label>
              <Select value={selectedModelA} onValueChange={setSelectedModelA}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un modele" />
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

            {mode === 'compare' && (
              <>
                <div className="space-y-2">
                  <Label>Provider B</Label>
                  <Select value={selectedProviderB} onValueChange={setSelectedProviderB}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un provider" />
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
                  <Label>Modele B</Label>
                  <Select value={selectedModelB} onValueChange={setSelectedModelB}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un modele" />
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
              </>
            )}

            <div className="space-y-2">
              <Label>Temperature</Label>
              <Input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setTemperature(Number.isFinite(value) ? value : DEFAULT_TEMPERATURE);
                }}
              />
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setConfigSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveConfig()}>
              <Save className="size-4" />
              Enregistrer
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
