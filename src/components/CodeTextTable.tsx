import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useCodeTextRows } from '../queries/useKnowledgeRows';
import type { CodeTextEntry } from '../api/botpress/knowledge';
import {
  DetailPanel,
  EditorSurface,
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
import { Plus, Edit2, Trash2, Save, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TABLE_NAME = 'codeTextTable';

interface CodeTextFormData {
  code: string;
  text: string;
}

export default function CodeTextTable() {
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CodeTextEntry | null>(null);
  const [formData, setFormData] = useState<CodeTextFormData>({
    code: '',
    text: '',
  });

  const rowsQuery = useCodeTextRows(selectedBotId);
  const { client } = rowsQuery;
  const saving = rowsQuery.saving || rowsQuery.remove.isPending;
  const entries = rowsQuery.data ?? [];
  const visibleEntries = entries.filter((entry) =>
    JSON.stringify(entry).toLowerCase().includes(search.toLowerCase()),
  );
  const loading = rowsQuery.isLoading;
  useEffect(() => {
    if (rowsQuery.error) toast.error('Failed to load code/text entries');
  }, [rowsQuery.error]);

  useEffect(() => {
    if (!selectedBotId && settings.bots.length > 0) {
      const firstBot = settings.bots.find((bot) => bot.botId);
      if (firstBot) setSelectedBotId(firstBot.botId);
    }
  }, [settings.bots, selectedBotId]);

  const resetForm = () => setFormData({ code: '', text: '' });

  const handleAdd = async () => {
    if (!client || !formData.code.trim() || !formData.text.trim()) {
      toast.error('Code and text are required');
      return;
    }

    try {
      await rowsQuery.create.mutateAsync({
        table: TABLE_NAME,
        rows: [
          {
            code: formData.code.trim(),
            text: formData.text.trim(),
          },
        ],
      });
      toast.success('Entry added');
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error adding code/text entry:', error);
      toast.error('Failed to add entry');
    }
  };

  const handleUpdate = async () => {
    if (
      !client ||
      !editingEntry ||
      !formData.code.trim() ||
      !formData.text.trim()
    ) {
      toast.error('Code and text are required');
      return;
    }

    try {
      await rowsQuery.update.mutateAsync({
        table: TABLE_NAME,
        rows: [
          {
            id: editingEntry.id,
            code: formData.code.trim(),
            text: formData.text.trim(),
          },
        ],
      });
      toast.success('Entry updated');
      setIsEditDialogOpen(false);
      setEditingEntry(null);
      resetForm();
    } catch (error) {
      console.error('Error updating code/text entry:', error);
      toast.error('Failed to update entry');
    }
  };

  const handleDelete = async (id: number) => {
    if (!client) return;
    try {
      await rowsQuery.remove.mutateAsync({ table: TABLE_NAME, ids: [id] });
      toast.success('Entry deleted');
    } catch (error) {
      console.error('Error deleting code/text entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  const openEditDialog = (entry: CodeTextEntry) => {
    setEditingEntry(entry);
    setFormData({ code: entry.code, text: entry.text });
    setIsEditDialogOpen(true);
  };

  if (!settings.token || !settings.workspaceId || settings.bots.length === 0)
    return (
      <>
        <PageHeader title="Code Text" />
        <EmptyState
          title="Configuration required"
          description="Configure your workspace and bots in Settings."
        />
      </>
    );
  return (
    <>
      <PageHeader title="Code Text" />
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
                {settings.bots
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
              Manage code/text mappings for the selected bot
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void rowsQuery.refetch()}
              disabled={!client || rowsQuery.isFetching}
              className="h-9"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${rowsQuery.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </div>
        <Input
          disabled={saving}
          aria-label="Search Code Text"
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
                  Manage code/text entries for the selected bot
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
                    <DialogTitle>Add Code/Text Entry</DialogTitle>
                    <DialogDescription>
                      Create a new code/text entry
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="code">Code *</Label>
                      <Input
                        disabled={saving}
                        id="code"
                        placeholder="Enter code"
                        value={formData.code}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            code: e.target.value,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="text">Text *</Label>
                      <Textarea
                        disabled={saving}
                        id="text"
                        placeholder="Enter text"
                        value={formData.text}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            text: e.target.value,
                          }))
                        }
                        className="mt-1"
                      />
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
            label="Code Text"
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
                    <TableHead>Code</TableHead>
                    <TableHead>Text</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell
                        className="max-w-[200px] truncate font-mono"
                        title={entry.code}
                      >
                        {entry.code}
                      </TableCell>
                      <TableCell className="max-w-lg">
                        <div className="truncate" title={entry.text}>
                          {entry.text}
                        </div>
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

      <DetailPanel
        open={isEditDialogOpen}
        onOpenChange={(open) => !saving && setIsEditDialogOpen(open)}
        title="Edit Code/Text Entry"
        description="Update the code and its content"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? 'Saving…' : 'Update Entry'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-code">Code *</Label>
            <Input
              id="edit-code"
              value={formData.code}
              disabled={saving}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, code: event.target.value }))
              }
            />
          </div>
          <EditorSurface title="Text">
            <Textarea
              id="edit-text"
              aria-label="Text"
              value={formData.text}
              disabled={saving}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, text: event.target.value }))
              }
            />
          </EditorSurface>
        </div>
      </DetailPanel>
    </>
  );
}
