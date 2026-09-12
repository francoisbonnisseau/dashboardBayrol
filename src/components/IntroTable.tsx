import { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useIntroRows } from '../queries/useKnowledgeRows';
import type { IntroEntry } from '../api/botpress/knowledge';
import {
  publishConversationStarters,
  type ConversationStarter,
  type ConversationStarterLocale,
} from '../lib/edgeFunctions';
import {
  PageHeader,
  FilterBar,
  DataTableShell,
  EmptyState,
  ErrorState,
} from '@/components/dashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  RefreshCw,
  Loader2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

const TABLE_NAME = 'introTable';

interface IntroFormData {
  sentence: string;
  season: string;
  live: string;
}

const publishableBotIds = new Set<ConversationStarterLocale>([
  'fr',
  'de',
  'es',
]);

export default function IntroTable() {
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const { sessionToken } = useAuth();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [publishing, setPublishing] = useState(false);
  const [publicationPreview, setPublicationPreview] = useState<
    ConversationStarter[] | null
  >(null);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<IntroEntry | null>(null);
  const [formData, setFormData] = useState<IntroFormData>({
    sentence: '',
    season: '',
    live: '',
  });

  const rowsQuery = useIntroRows(selectedBotId);
  const { client } = rowsQuery;
  const saving = rowsQuery.saving || rowsQuery.remove.isPending;
  const entries = rowsQuery.data ?? [];
  const visibleEntries = entries.filter((entry) =>
    JSON.stringify(entry).toLowerCase().includes(search.toLowerCase()),
  );
  const loading = rowsQuery.isLoading;
  useEffect(() => {
    if (rowsQuery.error) toast.error('Failed to load intro entries');
  }, [rowsQuery.error]);

  const availableBots = useMemo(
    () =>
      settings.bots.filter((bot) =>
        publishableBotIds.has(bot.id as ConversationStarterLocale),
      ),
    [settings.bots],
  );
  const selectedBot = availableBots.find((bot) => bot.botId === selectedBotId);
  const selectedLocale = selectedBot?.id as
    | ConversationStarterLocale
    | undefined;

  useEffect(() => {
    if (!selectedBotId && availableBots.length > 0) {
      const firstBot = availableBots.find((b) => b.botId);
      if (firstBot) setSelectedBotId(firstBot.botId);
    }
  }, [availableBots, selectedBotId]);

  const resetForm = () => setFormData({ sentence: '', season: '', live: '' });

  const handleAdd = async () => {
    if (!client || !formData.sentence.trim()) {
      toast.error('Sentence is required');
      return;
    }
    try {
      await rowsQuery.create.mutateAsync({
        table: TABLE_NAME,
        rows: [
          {
            sentence: formData.sentence.trim(),
            season: formData.season.trim(),
            // convert yes/no to boolean; if empty keep undefined
            ...(formData.live ? { live: formData.live === 'yes' } : {}),
          },
        ],
      });
      toast.success('Intro entry added');
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error adding intro entry:', error);
      toast.error('Failed to add entry');
    }
  };

  const handleUpdate = async () => {
    if (!client || !editingEntry || !formData.sentence.trim()) {
      toast.error('Sentence is required');
      return;
    }
    try {
      await rowsQuery.update.mutateAsync({
        table: TABLE_NAME,
        rows: [
          {
            id: editingEntry.id,
            sentence: formData.sentence.trim(),
            season: formData.season.trim(),
            ...(formData.live ? { live: formData.live === 'yes' } : {}),
          },
        ],
      });
      toast.success('Intro entry updated');
      setIsEditDialogOpen(false);
      setEditingEntry(null);
      resetForm();
    } catch (error) {
      console.error('Error updating intro entry:', error);
      toast.error('Failed to update entry');
    }
  };

  const handleDelete = async (id: number) => {
    if (!client) return;
    try {
      await rowsQuery.remove.mutateAsync({ table: TABLE_NAME, ids: [id] });
      toast.success('Intro entry deleted');
    } catch (error) {
      console.error('Error deleting intro entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  const getActiveStarters = (): ConversationStarter[] =>
    entries
      .filter((entry) => entry.live === 'yes')
      .map((entry) => ({
        id: `intro-${entry.id}`,
        title: entry.sentence,
        icon: 'message-circle',
      }));

  const openPublishDialog = () => {
    if (!selectedLocale) {
      toast.error('Select a FR, DE or ES bot before publishing');
      return;
    }

    setPublicationPreview(getActiveStarters());
    setIsPublishDialogOpen(true);
  };

  const handlePublish = async () => {
    if (!publicationPreview || !selectedLocale) return;
    if (!sessionToken) {
      toast.error('An active session is required to publish questions');
      return;
    }

    try {
      setPublishing(true);
      const result = await publishConversationStarters(
        sessionToken,
        selectedLocale,
        publicationPreview,
      );
      setIsPublishDialogOpen(false);
      setPublicationPreview(null);
      toast.success(
        result.changedFiles.length > 0
          ? `${publicationPreview.length} question(s) published to ${selectedLocale.toUpperCase()}`
          : 'The conversation starters are already up to date',
      );
    } catch (error) {
      console.error('Error publishing conversation starters:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to publish conversation starters',
      );
    } finally {
      setPublishing(false);
    }
  };

  const openEditDialog = (entry: IntroEntry) => {
    setEditingEntry(entry);
    setFormData({
      sentence: entry.sentence,
      season: entry.season,
      live: entry.live,
    });
    setIsEditDialogOpen(true);
  };

  if (!settings.token || !settings.workspaceId || settings.bots.length === 0)
    return (
      <>
        <PageHeader title="Intro" />
        <EmptyState
          title="Configuration required"
          description="Configure your workspace and bots in Settings."
        />
      </>
    );
  return (
    <>
      <PageHeader title="Intro" />
      {/* Header Card */}
      <FilterBar>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              Bot:
            </span>
            <Select
              value={selectedBotId}
              onValueChange={setSelectedBotId}
              disabled={saving}
            >
              <SelectTrigger aria-label="Bot" className="w-[180px] h-9">
                <SelectValue placeholder="Select a bot" />
              </SelectTrigger>
              <SelectContent>
                {availableBots
                  .filter((bot) => bot.botId)
                  .map((bot) => (
                    <SelectItem key={bot.id} value={bot.botId}>
                      {bot.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Manage introductory sentences per season & live status
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openPublishDialog}
                disabled={
                  !client ||
                  rowsQuery.isFetching ||
                  saving ||
                  rowsQuery.remove.isPending ||
                  publishing ||
                  !selectedLocale
                }
                className="h-9"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Publier les questions actives
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void rowsQuery.refetch()}
                disabled={!client || rowsQuery.isFetching || publishing}
                className="h-9"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${rowsQuery.isFetching ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>
        <Input
          disabled={saving}
          aria-label="Search Intro"
          placeholder="Search…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full sm:w-[240px]"
        />
      </FilterBar>

      {selectedBotId && (
        <section className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Entries</h2>
                <p className="text-sm text-muted-foreground">
                  Manage intro sentences for the selected bot
                </p>
              </div>
              <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => !saving && setIsAddDialogOpen(open)}
              >
                <DialogTrigger asChild>
                  <Button disabled={saving} onClick={() => resetForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl bg-surface max-h-[90dvh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Intro Entry</DialogTitle>
                    <DialogDescription>
                      Create a new intro entry
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sentence">Sentence *</Label>
                      <Textarea
                        disabled={saving}
                        id="sentence"
                        placeholder="Enter the sentence..."
                        value={formData.sentence}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            sentence: e.target.value,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="season">Season</Label>
                        <Input
                          disabled={saving}
                          id="season"
                          placeholder="e.g. summer"
                          value={formData.season}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              season: e.target.value,
                            }))
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="live">Live</Label>
                        <Select
                          disabled={saving}
                          value={formData.live}
                          onValueChange={(v) =>
                            setFormData((prev) => ({ ...prev, live: v }))
                          }
                        >
                          <SelectTrigger id="live" className="mt-1">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      disabled={saving}
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAdd} disabled={loading || saving}>
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {saving ? 'Saving...' : 'Add Entry'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <DataTableShell
            label="Intro"
            empty={!visibleEntries.length}
            emptyState={
              <EmptyState
                title={search ? 'No matching entries' : 'No entries yet'}
                description={
                  search
                    ? 'Try another search.'
                    : 'Add an entry to get started.'
                }
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (search) setSearch('');
                      else {
                        resetForm();
                        setIsAddDialogOpen(true);
                      }
                    }}
                  >
                    {search ? 'Clear search' : 'Add entry'}
                  </Button>
                }
              />
            }
            loading={loading}
            refreshing={rowsQuery.isFetching && !loading}
            error={
              rowsQuery.error && !rowsQuery.data ? (
                <ErrorState
                  title="Unable to load entries"
                  onRetry={() => void rowsQuery.refetch()}
                />
              ) : undefined
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sentence</TableHead>
                    <TableHead>Season</TableHead>
                    <TableHead>Live</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={entry.sentence}>
                          {entry.sentence}
                        </div>
                      </TableCell>
                      <TableCell>{entry.season || '—'}</TableCell>
                      <TableCell>
                        {entry.live
                          ? entry.live === 'yes'
                            ? 'Yes'
                            : 'No'
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {entry.createdAt
                          ? new Date(entry.createdAt).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Edit entry"
                            disabled={saving}
                            onClick={() => openEditDialog(entry)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Delete entry"
                            disabled={saving}
                            onClick={() => {
                              if (confirm('Delete this entry?'))
                                handleDelete(entry.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DataTableShell>
        </section>
      )}

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => !saving && setIsEditDialogOpen(open)}
      >
        <DialogContent className="max-w-xl bg-surface max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Intro Entry</DialogTitle>
            <DialogDescription>
              Update the intro sentence details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-sentence">Sentence *</Label>
              <Textarea
                disabled={saving}
                id="edit-sentence"
                placeholder="Enter the sentence..."
                value={formData.sentence}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sentence: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-season">Season</Label>
                <Input
                  disabled={saving}
                  id="edit-season"
                  placeholder="e.g. winter"
                  value={formData.season}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, season: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-live">Live</Label>
                <Select
                  disabled={saving}
                  value={formData.live}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, live: v }))
                  }
                >
                  <SelectTrigger id="edit-live" className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={saving}
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Saving...' : 'Update Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPublishDialogOpen}
        onOpenChange={(open) => {
          if (!publishing) {
            setIsPublishDialogOpen(open);
            if (!open) setPublicationPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-xl bg-surface max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Publier les questions actives</DialogTitle>
            <DialogDescription>
              Les questions ci-dessous seront publiées dans les configurations{' '}
              {selectedLocale?.toUpperCase()} web et app.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto rounded-md border p-4">
            {publicationPreview?.length ? (
              <ul className="space-y-3">
                {publicationPreview.map((starter) => (
                  <li key={starter.id} className="text-sm">
                    {starter.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune question active : la publication videra les conversation
                starters de cette langue.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPublishDialogOpen(false)}
              disabled={publishing}
            >
              Annuler
            </Button>
            <Button
              onClick={handlePublish}
              disabled={publishing || publicationPreview === null}
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {publishing ? 'Publication...' : 'Confirmer la publication'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
