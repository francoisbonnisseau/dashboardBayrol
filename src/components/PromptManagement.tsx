import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { useSettings } from '@/contexts/SettingsContext';
import { useBotpressClient } from '@/hooks/useBotpressClient';
import { usePromptRows, usePromptMutations } from '@/queries/usePromptRows';
import {
  buildPromotionUpdates,
  buildTestingDraftValues,
  getPromptSelectionKey,
  partitionPromptRows,
  type PromptRow,
} from '@/lib/promptVersions';
import {
  PageHeader,
  PageTabs,
  PageTabList,
  PageTab,
  PageTabPanel,
  Toolbar,
  EditorSurface,
  DetailPanel,
  DataTableShell,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/dashboard';
import { PromptEditor } from '@/features/prompts/PromptEditor';
import { PromptCompare } from '@/features/prompts/PromptCompare';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
const EMPTY_PROMPT_ROWS: PromptRow[] = [];
const TABLE_NAME = 'promptsTable';
const ALLOWED_PROMPT_BOTS = new Set(['fr', 'de', 'es']);
type PromptTab = 'testing' | 'live' | 'legacy';
const formatDate = (value?: string | null) =>
  !value
    ? 'Not deployed'
    : Number.isNaN(Date.parse(value))
      ? value
      : new Date(value).toLocaleString();
function getPreferredSelectionKey(
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

  return null;
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

export default function PromptManagement() {
  const { settings } = useSettings();
  const promptBots = useMemo(
    () =>
      settings.bots.filter(
        (bot) => ALLOWED_PROMPT_BOTS.has(bot.id) && bot.botId,
      ),
    [settings.bots],
  );
  const [selectedBotId, setSelectedBotId] = useState('');
  const [selectedPromptKey, setSelectedPromptKey] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<PromptTab>('testing');
  const [draftLabel, setDraftLabel] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  const client = useBotpressClient(selectedBotId);
  const promptQuery = usePromptRows(
    client,
    settings.workspaceId,
    selectedBotId,
  );
  const promptMutations = usePromptMutations(
    client,
    settings.workspaceId,
    selectedBotId,
  );
  const promptRows = promptQuery.data ?? EMPTY_PROMPT_ROWS;
  const loading = promptQuery.isLoading;
  const editorBaseline = useRef<{
    scope: string;
    label: string;
    prompt: string;
    server: PromptRow | null;
  } | null>(null);
  const prompts = useMemo(() => partitionPromptRows(promptRows), [promptRows]);
  const selectedLegacyPrompt = useMemo(() => {
    const currentSelection = getPromptBySelectionKey(
      prompts,
      selectedPromptKey,
    );
    return currentSelection?.version === 'legacy'
      ? currentSelection
      : (prompts.legacy[0] ?? null);
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
  }, [
    activeTab,
    draftLabel,
    draftPrompt,
    prompts.live,
    prompts.testing,
    selectedLegacyPrompt,
  ]);
  const previewMarkdown = useDeferredValue(activePrompt?.prompt ?? '');
  const hasUnsavedTestingChanges = Boolean(
    prompts.testing &&
      (draftLabel.trim() !== prompts.testing.label.trim() ||
        draftPrompt !== prompts.testing.prompt),
  );
  const canPromote = Boolean(
    prompts.testing && draftLabel.trim() && draftPrompt.trim(),
  );

  useEffect(() => {
    if (!selectedBotId && promptBots[0]) {
      setSelectedBotId(promptBots[0].botId);
    }
  }, [promptBots, selectedBotId]);

  useEffect(() => {
    const scope = settings.workspaceId + ':' + selectedBotId;
    const baseline = editorBaseline.current;
    if (baseline?.scope === scope && baseline.server === prompts.testing)
      return;
    // A background refresh must not overwrite the user's unsaved editor buffer.
    if (
      baseline?.scope === scope &&
      !saving &&
      (draftLabel !== baseline.label || draftPrompt !== baseline.prompt)
    )
      return;
    const label = prompts.testing?.label ?? '';
    const prompt = prompts.testing?.prompt ?? '';
    editorBaseline.current = { scope, label, prompt, server: prompts.testing };
    setDraftLabel(label);
    setDraftPrompt(prompt);
  }, [
    prompts.testing,
    settings.workspaceId,
    selectedBotId,
    draftLabel,
    draftPrompt,
    saving,
  ]);

  useEffect(() => {
    const currentSelection = getPromptBySelectionKey(
      prompts,
      selectedPromptKey,
    );

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

    const currentSelection = getPromptBySelectionKey(
      prompts,
      selectedPromptKey,
    );
    if (
      (!currentSelection || currentSelection.version !== 'legacy') &&
      prompts.legacy[0]
    ) {
      startTransition(() =>
        setSelectedPromptKey(getPromptSelectionKey(prompts.legacy[0])),
      );
    }
  }, [activeTab, prompts, selectedPromptKey]);

  useEffect(() => {
    if (promptQuery.error) toast.error('Failed to load prompts from Botpress');
  }, [promptQuery.error]);

  async function handleCreateTestingDraft() {
    if (!client || prompts.testing) {
      return;
    }

    const source =
      activeTab === 'legacy'
        ? selectedLegacyPrompt
        : (prompts.live ?? selectedLegacyPrompt);
    const nextDraft = buildTestingDraftValues(source);

    setSaving(true);
    try {
      await promptMutations.create.mutateAsync({
        table: TABLE_NAME,
        rows: [nextDraft],
      });
      toast.success('Testing draft created');
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
        await promptMutations.update.mutateAsync({
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
        await promptMutations.create.mutateAsync({
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
      await promptMutations.update.mutateAsync({
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

  if (!settings.token || !settings.workspaceId || !promptBots.length)
    return (
      <>
        <PageHeader title="Prompts" />
        <EmptyState
          title="Configuration required"
          description="Configure the FR, DE and ES bots in Settings."
        />
      </>
    );
  const previewAction = (
    <Button
      variant="outline"
      onClick={() => setPreviewOpen(true)}
      disabled={saving || !activePrompt?.prompt.trim()}
    >
      Preview
    </Button>
  );
  const compareAction = (
    <Button
      variant="outline"
      onClick={() => setComparisonOpen(!comparisonOpen)}
      disabled={saving || !prompts.live || !prompts.testing}
    >
      {comparisonOpen ? 'Close comparison' : 'Compare'}
    </Button>
  );
  return (
    <>
      <PageHeader
        title="Prompts"
        description="Edit, validate and publish assistant prompts"
        actions={
          <Select
            value={selectedBotId}
            onValueChange={setSelectedBotId}
            disabled={saving}
          >
            <SelectTrigger aria-label="Bot" className="w-[180px]">
              <SelectValue />
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
      {promptQuery.error && (
        <ErrorState
          title="Unable to load prompts"
          onRetry={() => void promptQuery.refetch()}
          retrying={promptQuery.isFetching}
        />
      )}
      {loading ? (
        <LoadingState />
      ) : (
        <PageTabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value as PromptTab);
            setComparisonOpen(false);
          }}
        >
          <PageTabList aria-label="Prompt version">
            <PageTab value="testing">Testing</PageTab>
            <PageTab value="live">Live</PageTab>
            <PageTab value="legacy">History</PageTab>
          </PageTabList>
          <PageTabPanel value="testing" className="space-y-4">
            {prompts.testing ? (
              <>
                <Toolbar>
                  <StatusBadge variant="info">Testing</StatusBadge>
                  {prompts.testing.updatedAt && (
                    <span className="text-xs text-muted-foreground">
                      Modified {formatDate(prompts.testing.updatedAt)}
                    </span>
                  )}
                  <StatusBadge
                    variant={hasUnsavedTestingChanges ? 'warning' : 'neutral'}
                  >
                    {hasUnsavedTestingChanges ? 'Unsaved' : 'Saved'}
                  </StatusBadge>
                </Toolbar>
                <div className="space-y-2">
                  <Label htmlFor="prompt-label">Prompt label</Label>
                  <Input
                    id="prompt-label"
                    value={draftLabel}
                    onChange={(event) => setDraftLabel(event.target.value)}
                    disabled={saving}
                  />
                </div>
                {comparisonOpen ? (
                  <PromptCompare
                    live={prompts.live?.prompt || ''}
                    testing={draftPrompt}
                  />
                ) : (
                  <PromptEditor
                    value={draftPrompt}
                    onChange={setDraftPrompt}
                    disabled={saving}
                  />
                )}
                <Toolbar
                  actions={
                    <>
                      <Button
                        variant="outline"
                        onClick={handleSaveTestingDraft}
                        disabled={saving || loading}
                      >
                        {saving ? 'Saving…' : 'Save draft'}
                      </Button>
                      <Button
                        onClick={() => setPromotionDialogOpen(true)}
                        disabled={
                          saving ||
                          loading ||
                          !canPromote ||
                          hasUnsavedTestingChanges
                        }
                      >
                        Push live
                      </Button>
                    </>
                  }
                >
                  {previewAction}
                  {compareAction}
                  {hasUnsavedTestingChanges && (
                    <span className="text-xs text-muted-foreground">
                      Save the draft before publishing.
                    </span>
                  )}
                </Toolbar>
              </>
            ) : (
              <EmptyState
                title="No testing draft"
                description="Create a draft from the current live prompt or the latest history version."
                action={
                  <Button onClick={handleCreateTestingDraft} disabled={saving}>
                    {saving ? 'Creating…' : 'Create testing draft'}
                  </Button>
                }
              />
            )}
          </PageTabPanel>
          <PageTabPanel value="live" className="space-y-4">
            {prompts.live ? (
              <>
                <Toolbar>
                  <StatusBadge variant="primary">Live</StatusBadge>
                  <span className="text-sm">
                    {prompts.live.label} · Deployed{' '}
                    {formatDate(prompts.live.deployDate)}
                  </span>
                </Toolbar>
                {comparisonOpen ? (
                  <PromptCompare
                    live={prompts.live.prompt}
                    testing={draftPrompt}
                  />
                ) : (
                  <EditorSurface title="Live prompt">
                    <pre className="min-h-[40vh] whitespace-pre-wrap break-words p-3">
                      {prompts.live.prompt}
                    </pre>
                  </EditorSurface>
                )}
                <Toolbar>
                  {previewAction}
                  {compareAction}
                </Toolbar>
              </>
            ) : (
              <EmptyState
                title="No live prompt"
                description="Publish a saved testing draft to deploy it."
              />
            )}
          </PageTabPanel>
          <PageTabPanel value="legacy" className="space-y-4">
            <DataTableShell
              label="Prompt history"
              empty={!prompts.legacy.length}
              emptyState={
                <EmptyState
                  title="No prompt history"
                  description="Previous live versions appear here after publishing."
                />
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Deployed</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prompts.legacy.map((prompt) => (
                    <TableRow
                      key={prompt.id}
                      data-state={
                        selectedLegacyPrompt?.id === prompt.id
                          ? 'selected'
                          : undefined
                      }
                    >
                      <TableCell>
                        <StatusBadge>Legacy</StatusBadge>
                      </TableCell>
                      <TableCell>{prompt.label}</TableCell>
                      <TableCell>{formatDate(prompt.deployDate)}</TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          onClick={() =>
                            setSelectedPromptKey(getPromptSelectionKey(prompt))
                          }
                        >
                          View<span className="sr-only"> {prompt.label}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTableShell>
            {selectedLegacyPrompt && (
              <>
                <EditorSurface
                  title={selectedLegacyPrompt.label || 'Legacy prompt'}
                >
                  <pre className="whitespace-pre-wrap break-words p-3">
                    {selectedLegacyPrompt.prompt}
                  </pre>
                </EditorSurface>
                <Toolbar>{previewAction}</Toolbar>
              </>
            )}
          </PageTabPanel>
        </PageTabs>
      )}
      <DetailPanel
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Prompt preview"
        description={activePrompt?.label}
      >
        <div className="space-y-3 text-sm leading-6 [&_pre]:overflow-x-auto [&_h2]:mt-4 [&_h2]:font-semibold">
          <ReactMarkdown>{previewMarkdown}</ReactMarkdown>
        </div>
      </DetailPanel>
      <Dialog
        open={promotionDialogOpen}
        onOpenChange={(open) => !saving && setPromotionDialogOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push testing prompt live?</DialogTitle>
            <DialogDescription>
              The current live prompt will be archived as legacy. The saved
              testing draft will become the new live version.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPromotionDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePromoteToLive}
              disabled={saving || !prompts.testing || hasUnsavedTestingChanges}
            >
              {saving ? 'Publishing…' : 'Confirm push'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
