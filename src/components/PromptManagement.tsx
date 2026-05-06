import { startTransition, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Eye,
  FilePenLine,
  GitCompareArrows,
  History,
  Loader2,
  Lock,
  Plus,
  Rocket,
  Save,
} from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useBotpressClient } from '@/hooks/useBotpressClient';
import { cn } from '@/lib/utils';
import {
  buildPromotionUpdates,
  buildTestingDraftValues,
  getPromptSelectionKey,
  normalizePromptRow,
  partitionPromptRows,
  type PromptRow,
} from '@/lib/promptVersions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const TABLE_NAME = 'promptsTable';
const ALLOWED_PROMPT_BOTS = new Set(['fr', 'de', 'es']);
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

type PromptTab = 'testing' | 'live' | 'legacy';

type DiffRow = {
  leftLine: number | null;
  rightLine: number | null;
  leftText: string;
  rightText: string;
  state: 'same' | 'added' | 'removed' | 'changed';
};

function formatDate(value?: string | null) {
  if (!value) {
    return 'Not deployed';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return DATE_TIME_FORMATTER.format(date);
}

function PromptVersionBadge({ version }: { version: PromptRow['version'] }) {
  if (version === 'live') {
    return (
      <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
        Live Prompt
      </Badge>
    );
  }

  if (version === 'testing') {
    return (
      <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
        Test Prompt
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      Legacy
    </Badge>
  );
}

function getPreferredSelectionKey(prompts: ReturnType<typeof partitionPromptRows>) {
  if (prompts.testing) {
    return 'testing';
  }

  if (prompts.live) {
    return 'live';
  }

  if (prompts.legacy[0]) {
    return getPromptSelectionKey(prompts.legacy[0]);
  }

  return null;
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

function buildDiffRows(livePrompt: string, testingPrompt: string): DiffRow[] {
  const liveLines = livePrompt.split('\n');
  const testingLines = testingPrompt.split('\n');
  const maxLength = Math.max(liveLines.length, testingLines.length);
  const rows: DiffRow[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const leftText = liveLines[index] ?? '';
    const rightText = testingLines[index] ?? '';

    rows.push({
      leftLine: liveLines[index] !== undefined ? index + 1 : null,
      rightLine: testingLines[index] !== undefined ? index + 1 : null,
      leftText,
      rightText,
      state:
        leftText === rightText
          ? 'same'
          : !leftText && rightText
            ? 'added'
            : leftText && !rightText
              ? 'removed'
              : 'changed',
    });
  }

  return rows;
}

function PromptPreview({ markdown }: { markdown: string }) {
  if (!markdown.trim()) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/15 text-sm text-muted-foreground">
        Nothing to preview yet.
      </div>
    );
  }

  return (
    <div className="prose prose-slate max-w-none text-[14px] leading-6 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:mb-4 [&_h1]:text-[2rem] [&_h1]:font-semibold [&_h1]:tracking-[-0.04em] [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-[1.5rem] [&_h2]:font-semibold [&_h2]:tracking-[-0.03em] [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[1.125rem] [&_h3]:font-semibold [&_li]:my-1 [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-50 [&_ul]:pl-5">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
}

function ReadOnlyPromptPanel({
  title,
  label,
  description,
  markdown,
  badge,
  footer,
}: {
  title: string;
  label?: string;
  description?: string;
  markdown: string;
  badge?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-border/70 bg-background shadow-[0_1px_0_rgba(16,24,40,0.02)]">
      <div className="border-b border-border/70 px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em]">{title}</h3>
          {badge}
        </div>
        {label ? <p className="mt-2 text-sm font-medium text-foreground/90">{label}</p> : null}
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>

      <ScrollArea className="h-[560px] bg-muted/10">
        <div className="min-h-[560px] px-6 py-6">
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-6 text-foreground/90">
            {markdown || 'Nothing to display yet.'}
          </pre>
        </div>
      </ScrollArea>

      {footer ? <div className="border-t border-border/70 px-6 py-4">{footer}</div> : null}
    </section>
  );
}

function EditorSurface({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const lineCount = Math.max(20, value.split('\n').length);

  return (
    <div className="overflow-hidden rounded-[18px] border border-border/70 bg-background shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      <div className="grid min-h-[440px] grid-cols-[48px_minmax(0,1fr)]">
        <div className="border-r border-border/70 bg-muted/20 px-2 py-4 text-right font-mono text-[12px] leading-6 text-muted-foreground">
          {Array.from({ length: lineCount }, (_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>

        <Textarea
          id="prompt-markdown"
          name="promptMarkdown"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder="Write the prompt in Markdown..."
          className="min-h-[440px] resize-none border-0 rounded-none bg-background px-4 py-4 font-mono text-[13px] leading-6 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}

export default function PromptManagement() {
  const { settings } = useSettings();
  const promptBots = useMemo(
    () => settings.bots.filter((bot) => ALLOWED_PROMPT_BOTS.has(bot.id) && bot.botId),
    [settings.bots]
  );
  const [selectedBotId, setSelectedBotId] = useState('');
  const [promptRows, setPromptRows] = useState<PromptRow[]>([]);
  const [selectedPromptKey, setSelectedPromptKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PromptTab>('testing');
  const [draftLabel, setDraftLabel] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  const client = useBotpressClient(selectedBotId);
  const prompts = useMemo(() => partitionPromptRows(promptRows), [promptRows]);
  const selectedLegacyPrompt = useMemo(() => {
    const currentSelection = getPromptBySelectionKey(prompts, selectedPromptKey);
    return currentSelection?.version === 'legacy' ? currentSelection : prompts.legacy[0] ?? null;
  }, [prompts, selectedPromptKey]);
  const activePrompt = useMemo(() => {
    if (activeTab === 'testing') {
      return prompts.testing
        ? {
            ...prompts.testing,
            label: draftLabel,
            prompt: draftPrompt,
          }
        : null;
    }

    if (activeTab === 'live') {
      return prompts.live;
    }

    return selectedLegacyPrompt;
  }, [activeTab, draftLabel, draftPrompt, prompts.live, prompts.testing, selectedLegacyPrompt]);
  const previewMarkdown = useDeferredValue(activePrompt?.prompt ?? '');
  const diffRows = useMemo(
    () => buildDiffRows(prompts.live?.prompt ?? '', draftPrompt),
    [draftPrompt, prompts.live?.prompt]
  );
  const hasUnsavedTestingChanges = Boolean(
    prompts.testing &&
      (draftLabel.trim() !== prompts.testing.label.trim() || draftPrompt !== prompts.testing.prompt)
  );
  const canPromote = Boolean(prompts.testing && draftLabel.trim() && draftPrompt.trim());

  useEffect(() => {
    if (!selectedBotId && promptBots[0]) {
      setSelectedBotId(promptBots[0].botId);
    }
  }, [promptBots, selectedBotId]);

  useEffect(() => {
    if (prompts.testing) {
      setDraftLabel(prompts.testing.label);
      setDraftPrompt(prompts.testing.prompt);
      return;
    }

    setDraftLabel('');
    setDraftPrompt('');
  }, [prompts.testing]);

  useEffect(() => {
    const currentSelection = getPromptBySelectionKey(prompts, selectedPromptKey);

    if (!currentSelection) {
      const nextSelectionKey = getPreferredSelectionKey(prompts);

      if (nextSelectionKey !== selectedPromptKey) {
        startTransition(() => setSelectedPromptKey(nextSelectionKey));
      }
    }
  }, [prompts, selectedPromptKey]);

  useEffect(() => {
    if (activeTab === 'testing') {
      if (prompts.testing && selectedPromptKey !== 'testing') {
        startTransition(() => setSelectedPromptKey('testing'));
      }
      return;
    }

    if (activeTab === 'live') {
      if (prompts.live && selectedPromptKey !== 'live') {
        startTransition(() => setSelectedPromptKey('live'));
      }
      return;
    }

    const currentSelection = getPromptBySelectionKey(prompts, selectedPromptKey);
    if ((!currentSelection || currentSelection.version !== 'legacy') && prompts.legacy[0]) {
      startTransition(() => setSelectedPromptKey(getPromptSelectionKey(prompts.legacy[0])));
    }
  }, [activeTab, prompts, selectedPromptKey]);

  useEffect(() => {
    if (client && selectedBotId) {
      void loadPrompts();
    }
  }, [client, selectedBotId]);

  async function loadPrompts() {
    if (!client) {
      return;
    }

    setLoading(true);
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
      toast.error('Failed to load prompts from Botpress');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTestingDraft() {
    if (!client || prompts.testing) {
      return;
    }

    const source = activeTab === 'legacy' ? selectedLegacyPrompt : prompts.live ?? selectedLegacyPrompt;
    const nextDraft = buildTestingDraftValues(source);

    setSaving(true);
    try {
      await client.createTableRows({
        table: TABLE_NAME,
        rows: [nextDraft],
      });
      toast.success('Testing draft created');
      await loadPrompts();
      startTransition(() => {
        setSelectedPromptKey('testing');
        setActiveTab('testing');
      });
    } catch (error) {
      console.error('Error creating testing draft:', error);
      toast.error('Failed to create the testing draft');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTestingDraft() {
    if (!client) {
      return;
    }

    const trimmedLabel = draftLabel.trim();
    const trimmedPrompt = draftPrompt.trim();

    if (!trimmedLabel || !trimmedPrompt) {
      toast.error('Label and prompt are required');
      return;
    }

    setSaving(true);
    try {
      if (prompts.testing) {
        await client.updateTableRows({
          table: TABLE_NAME,
          rows: [
            {
              id: prompts.testing.id,
              label: trimmedLabel,
              prompt: trimmedPrompt,
              version: 'testing',
              deployDate: null,
            },
          ],
        });
      } else {
        await client.createTableRows({
          table: TABLE_NAME,
          rows: [
            {
              label: trimmedLabel,
              prompt: trimmedPrompt,
              version: 'testing',
              deployDate: null,
            },
          ],
        });
      }

      toast.success('Testing draft saved');
      await loadPrompts();
      startTransition(() => {
        setSelectedPromptKey('testing');
        setActiveTab('testing');
      });
    } catch (error) {
      console.error('Error saving testing draft:', error);
      toast.error('Failed to save the testing draft');
    } finally {
      setSaving(false);
    }
  }

  async function handlePromoteToLive() {
    if (!client || !prompts.testing) {
      return;
    }

    setSaving(true);
    try {
      await client.updateTableRows({
        table: TABLE_NAME,
        rows: buildPromotionUpdates({
          live: prompts.live,
          testing: prompts.testing,
          now: new Date().toISOString(),
        }),
      });

      toast.success('Testing prompt promoted to live');
      setPromotionDialogOpen(false);
      setComparisonOpen(false);
      await loadPrompts();
      startTransition(() => {
        setSelectedPromptKey('live');
        setActiveTab('live');
      });
    } catch (error) {
      console.error('Error promoting prompt:', error);
      toast.error('Failed to promote the testing prompt');
    } finally {
      setSaving(false);
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
                Configure the FR, DE and ES Botpress bots before managing prompts.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 pb-6">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-[2.15rem] font-semibold tracking-[-0.045em] text-foreground">Prompt Management</h1>
            <p className="text-[15px] text-muted-foreground">Create, edit, and manage versions of prompts.</p>
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
        </div>
      </section>

      <section>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PromptTab)} className="w-full">
          <div className="border-b border-border/70">
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-none bg-transparent p-0">
              <TabsTrigger
                value="testing"
                className="relative gap-2 rounded-none border-b-2 border-transparent px-4 py-4 text-[15px] font-medium text-muted-foreground data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-50 data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <FilePenLine className="size-4" />
                Test Prompt
              </TabsTrigger>
              <TabsTrigger
                value="live"
                className="relative gap-2 rounded-none border-b-2 border-transparent px-4 py-4 text-[15px] font-medium text-muted-foreground data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-50 data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <Lock className="size-4" />
                Live Prompt
              </TabsTrigger>
              <TabsTrigger
                value="legacy"
                className="relative gap-2 rounded-none border-b-2 border-transparent px-4 py-4 text-[15px] font-medium text-muted-foreground data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-50 data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <History className="size-4" />
                Legacy Prompts
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="testing" className="m-0 pt-5">
            <div className="space-y-4">
                <div className="rounded-[20px] border border-blue-200/80 bg-blue-50/55 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-white p-1.5 text-blue-700 shadow-[0_1px_0_rgba(16,24,40,0.04)]">
                      <AlertTriangle className="size-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[15px] font-semibold text-slate-900">Editing Test Prompt</p>
                      <p className="text-sm leading-6 text-slate-700">
                        {prompts.testing
                          ? 'Only this version can be edited. Validate it, compare it to live when needed, then push it live.'
                          : 'No testing draft exists yet. Create one from the current live prompt or the latest legacy version.'}
                      </p>
                    </div>
                  </div>
                </div>

                <section className="overflow-hidden rounded-[22px] border border-border/70 bg-background shadow-[0_1px_0_rgba(16,24,40,0.02)]">
                  <div className="border-b border-border/70 px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1.5">
                        <h3 className="text-[1.03rem] font-semibold tracking-[-0.02em]">Prompt (Markdown)</h3>
                        <p className="text-sm text-muted-foreground">
                          Edit the draft directly, then preview or compare it before publishing.
                        </p>
                        {prompts.testing ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <PromptVersionBadge version="testing" />
                            <span>{hasUnsavedTestingChanges ? 'Unsaved changes' : 'All changes saved'}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-lg px-3"
                          onClick={() => setPreviewOpen(true)}
                          disabled={saving || !activePrompt?.prompt.trim()}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-lg px-3"
                          onClick={() => setComparisonOpen(true)}
                          disabled={saving || !prompts.live || !prompts.testing}
                        >
                          <GitCompareArrows className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {prompts.testing ? (
                    <>
                      <div className="space-y-4 px-5 py-5">
                        <div className="space-y-2">
                          <Label htmlFor="prompt-label" className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Prompt Name
                          </Label>
                          <Input
                            id="prompt-label"
                            name="promptLabel"
                            autoComplete="off"
                            spellCheck={false}
                            value={draftLabel}
                            onChange={(event) => setDraftLabel(event.target.value)}
                            disabled={saving}
                            placeholder="Enter a prompt label..."
                            className="h-11 rounded-[14px] border-border/70 bg-background px-4"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Prompt Body
                          </Label>
                          <EditorSurface value={draftPrompt} onChange={setDraftPrompt} disabled={saving} />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/70 px-5 py-4">
                        <Button
                          variant="outline"
                          onClick={handleSaveTestingDraft}
                          disabled={saving || loading}
                          className="h-10 rounded-xl px-4"
                        >
                          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                          Save Draft
                        </Button>
                        <Button
                          onClick={() => setPromotionDialogOpen(true)}
                          disabled={saving || loading || !canPromote}
                          className="h-10 rounded-xl border border-[#009baa] bg-[#009baa] px-4 text-white hover:bg-[#008896]"
                        >
                          {saving ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                          Push to Live
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="px-5 py-8">
                      <div className="space-y-4 rounded-[18px] bg-muted/15 p-5">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">No test prompt yet</p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            Create a draft to start iterating. The draft will be initialized from the best available source.
                          </p>
                        </div>

                        <div className="flex justify-end">
                          <Button onClick={() => void handleCreateTestingDraft()} disabled={saving || loading} className="rounded-xl">
                            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                            Create Test Prompt
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
            </div>
          </TabsContent>

          <TabsContent value="live" className="m-0 pt-5">
            {prompts.live ? (
              <ReadOnlyPromptPanel
                title="Live Prompt"
                label={prompts.live.label}
                description={`Currently deployed on ${formatDate(prompts.live.deployDate)}.`}
                markdown={prompts.live.prompt}
                badge={<PromptVersionBadge version="live" />}
                footer={
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      This version is read-only. Make changes in the Test Prompt, then push them live.
                    </p>
                    <Button variant="outline" onClick={() => setPreviewOpen(true)} className="rounded-xl">
                      <Eye className="size-4" />
                      View Rendered Prompt
                    </Button>
                  </div>
                }
              />
            ) : (
              <section className="rounded-[24px] border border-border/70 bg-background px-5 py-8 shadow-[0_1px_0_rgba(16,24,40,0.02)]">
                <Alert className="border-border/70">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>No live prompt</AlertTitle>
                  <AlertDescription>No production prompt has been deployed yet.</AlertDescription>
                </Alert>
              </section>
            )}
          </TabsContent>

          <TabsContent value="legacy" className="m-0 pt-5">
            <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
              <section className="overflow-hidden rounded-[24px] border border-border/70 bg-background shadow-[0_1px_0_rgba(16,24,40,0.02)]">
                <div className="border-b border-border/70 px-5 py-5">
                  <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em]">Legacy Prompt Versions</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Archived prompts stay read-only and can be inspected version by version.
                  </p>
                </div>

                <ScrollArea className="h-[620px]">
                  <div className="space-y-2 px-4 py-4">
                    {prompts.legacy.length === 0 ? (
                      <div className="rounded-[18px] bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                        No legacy prompts available yet.
                      </div>
                    ) : (
                      prompts.legacy.map((prompt) => {
                        const promptKey = getPromptSelectionKey(prompt);
                        const isSelected = selectedPromptKey === promptKey;

                        return (
                          <button
                            key={prompt.id}
                            type="button"
                            className={cn(
                              'flex w-full cursor-pointer items-start justify-between rounded-[18px] border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                              isSelected
                                ? 'border-blue-200 bg-blue-50/55'
                                : 'border-border/65 bg-background hover:bg-muted/20'
                            )}
                            onClick={() => setSelectedPromptKey(promptKey)}
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {prompt.label || `Legacy #${prompt.id}`}
                              </p>
                              <p className="text-xs text-muted-foreground">{formatDate(prompt.deployDate)}</p>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">View</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </section>

              <div>
                {selectedLegacyPrompt ? (
                  <ReadOnlyPromptPanel
                    title="Legacy Prompt"
                    label={selectedLegacyPrompt.label || `Legacy #${selectedLegacyPrompt.id}`}
                    description={`Last deployed ${formatDate(selectedLegacyPrompt.deployDate)}.`}
                    markdown={selectedLegacyPrompt.prompt}
                    badge={<PromptVersionBadge version="legacy" />}
                    footer={
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                          Legacy prompts are preserved for reference and remain read-only.
                        </p>
                        <Button variant="outline" onClick={() => setPreviewOpen(true)} className="rounded-xl">
                          <Eye className="size-4" />
                          View Rendered Prompt
                        </Button>
                      </div>
                    }
                  />
                ) : (
                  <section className="rounded-[24px] border border-border/70 bg-background px-5 py-8 shadow-[0_1px_0_rgba(16,24,40,0.02)]">
                    <Alert className="border-border/70">
                      <AlertTriangle className="size-4" />
                      <AlertTitle>No legacy prompt selected</AlertTitle>
                      <AlertDescription>Select a legacy prompt to inspect its content.</AlertDescription>
                    </Alert>
                  </section>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[96vw] max-w-none sm:max-w-none rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Prompt Preview</DialogTitle>
            <DialogDescription>
              {activePrompt?.label || 'Preview the currently selected prompt in rendered form.'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[72vh] pr-4">
            <div className="rounded-[20px] border border-border/70 bg-background px-6 py-5">
              <PromptPreview markdown={previewMarkdown} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
        <DialogContent className="w-[97vw] max-w-none sm:max-w-none overflow-hidden rounded-[24px] p-0">
          <DialogHeader className="border-b border-border/70 px-6 py-5">
            <DialogTitle>Compare Live vs Test</DialogTitle>
            <DialogDescription>
              Validate the testing draft against the currently deployed prompt before pushing changes live.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-[580px] divide-y divide-border/70 md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="flex min-h-[580px] flex-col">
              <div className="border-b border-border/70 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <PromptVersionBadge version="live" />
                  <span className="text-sm font-medium">{prompts.live?.label || 'No live prompt'}</span>
                </div>
              </div>

              <ScrollArea className="h-[520px]">
                <div className="space-y-px bg-border/60">
                  {prompts.live ? (
                    diffRows.map((row, index) => (
                      <div
                        key={`live-${index}`}
                        className={cn(
                          'grid grid-cols-[42px_minmax(0,1fr)] bg-background px-3 py-1.5 font-mono text-[12px] leading-5',
                          row.state === 'removed' && 'bg-rose-50/90',
                          row.state === 'changed' && 'bg-amber-50/80'
                        )}
                      >
                        <span className="pr-4 text-right text-muted-foreground">{row.leftLine ?? ''}</span>
                        <span className="whitespace-pre-wrap break-words">{row.leftText || ' '}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-10 text-sm text-muted-foreground">No live prompt available for comparison.</div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="flex min-h-[580px] flex-col">
              <div className="border-b border-border/70 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <PromptVersionBadge version="testing" />
                  <span className="text-sm font-medium">{draftLabel || 'Testing draft'}</span>
                </div>
              </div>

              <ScrollArea className="h-[520px]">
                <div className="space-y-px bg-border/60">
                  {prompts.testing ? (
                    diffRows.map((row, index) => (
                      <div
                        key={`testing-${index}`}
                        className={cn(
                          'grid grid-cols-[42px_minmax(0,1fr)] bg-background px-3 py-1.5 font-mono text-[12px] leading-5',
                          row.state === 'added' && 'bg-emerald-50/90',
                          row.state === 'changed' && 'bg-amber-50/80'
                        )}
                      >
                        <span className="pr-4 text-right text-muted-foreground">{row.rightLine ?? ''}</span>
                        <span className="whitespace-pre-wrap break-words">{row.rightText || ' '}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-10 text-sm text-muted-foreground">No testing draft available for comparison.</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={promotionDialogOpen} onOpenChange={setPromotionDialogOpen}>
        <DialogContent className="rounded-[22px]">
          <DialogHeader>
            <DialogTitle>Push test prompt to live?</DialogTitle>
            <DialogDescription>
              The current live prompt will be archived as legacy, and the testing draft will become the new live version.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromotionDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handlePromoteToLive}
              disabled={saving || !prompts.testing}
              className="h-10 rounded-xl border border-[#009baa] bg-[#009baa] px-4 text-white hover:bg-[#008896]"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              Confirm push
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
