import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useLearnings } from '../queries/useKnowledgeRows';
import type { LearningEntry } from '../api/botpress/knowledge';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface LearningFormData {
  question: string;
  answer: string;
  tags: string[];
}

export default function Learnings() {
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LearningEntry | null>(null);
  const [formData, setFormData] = useState<LearningFormData>({
    question: '',
    answer: '',
    tags: [],
  });
  const [newTag, setNewTag] = useState('');

  const rowsQuery = useLearnings(selectedBotId);
  const { client } = rowsQuery;
  const saving = rowsQuery.saving || rowsQuery.remove.isPending;
  const learnings = rowsQuery.data ?? [];
  const visibleEntries = learnings.filter((entry) =>
    JSON.stringify(entry).toLowerCase().includes(search.toLowerCase()),
  );
  const loading = rowsQuery.isLoading;
  useEffect(() => {
    if (rowsQuery.error) toast.error('Failed to load learnings');
  }, [rowsQuery.error]);

  const handleAddEntry = async () => {
    if (!client || !formData.question.trim() || !formData.answer.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await rowsQuery.create.mutateAsync({
        table: 'learningsTable',
        rows: [
          {
            question: formData.question.trim(),
            answer: formData.answer.trim(),
            tags: formData.tags,
          },
        ],
      });

      toast.success('Learning entry added successfully');
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error adding entry:', error);
      toast.error('Failed to add learning entry');
    }
  };

  const handleEditEntry = async () => {
    if (
      !client ||
      !editingEntry ||
      !formData.question.trim() ||
      !formData.answer.trim()
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await rowsQuery.update.mutateAsync({
        table: 'learningsTable',
        rows: [
          {
            id: editingEntry.id,
            question: formData.question.trim(),
            answer: formData.answer.trim(),
            tags: formData.tags,
          },
        ],
      });

      toast.success('Learning entry updated successfully');
      setIsEditDialogOpen(false);
      setEditingEntry(null);
      resetForm();
    } catch (error) {
      console.error('Error updating entry:', error);
      toast.error('Failed to update learning entry');
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!client) return;

    try {
      await rowsQuery.remove.mutateAsync({
        table: 'learningsTable',
        ids: [id],
      });

      toast.success('Learning entry deleted successfully');
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete learning entry');
    }
  };

  const resetForm = () => {
    setFormData({
      question: '',
      answer: '',
      tags: [],
    });
    setNewTag('');
  };

  const openEditDialog = (entry: LearningEntry) => {
    setEditingEntry(entry);
    setFormData({
      question: entry.question,
      answer: entry.answer,
      tags: entry.tags || [],
    });
    setIsEditDialogOpen(true);
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  if (!settings.token || !settings.workspaceId || settings.bots.length === 0)
    return (
      <>
        <PageHeader title="Learnings" />
        <EmptyState
          title="Configuration required"
          description="Configure your workspace and bots in Settings."
        />
      </>
    );
  return (
    <>
      <PageHeader title="Learnings" />
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
          <p className="text-sm text-muted-foreground">
            Manage questions, answers, and tags
          </p>
        </div>
        <Input
          disabled={saving}
          aria-label="Search Learnings"
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
                <h2 className="text-base font-semibold">Learning Entries</h2>
                <p className="text-sm text-muted-foreground">
                  Manage questions, answers, and tags for the selected bot
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
                <DialogContent className="max-w-2xl bg-surface max-h-[90dvh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Learning Entry</DialogTitle>
                    <DialogDescription>
                      Create a new question-answer pair with optional tags
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="question">Question *</Label>
                      <Textarea
                        disabled={saving}
                        id="question"
                        placeholder="Enter the question..."
                        value={formData.question}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            question: e.target.value,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="answer">Answer *</Label>
                      <Textarea
                        disabled={saving}
                        id="answer"
                        placeholder="Enter the answer..."
                        value={formData.answer}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            answer: e.target.value,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tags">Tags</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          disabled={saving}
                          id="tags"
                          placeholder="Add a tag..."
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={handleKeyPress}
                          className="flex-1"
                        />
                        <Button type="button" onClick={addTag} size="sm">
                          Add
                        </Button>
                      </div>
                      {formData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.tags.map((tag, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              {tag}
                              <button
                                type="button"
                                aria-label={'Remove tag ' + tag}
                                onClick={() => removeTag(tag)}
                              >
                                <X className="size-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
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
                    <Button onClick={handleAddEntry} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      Add Entry
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <DataTableShell
            label="Learnings"
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
                    <TableHead>Question</TableHead>
                    <TableHead>Answer</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={entry.question}>
                          {entry.question}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={entry.answer}>
                          {entry.answer}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {entry.tags?.map((tag, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(
                          entry.updatedAt || entry.createdAt,
                        ).toLocaleDateString()}
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
                              if (
                                confirm(
                                  'Are you sure you want to delete this entry?',
                                )
                              ) {
                                handleDeleteEntry(entry.id);
                              }
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

      {/* Edit Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => !saving && setIsEditDialogOpen(open)}
      >
        <DialogContent className="max-w-2xl bg-surface max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Learning Entry</DialogTitle>
            <DialogDescription>
              Update the question-answer pair and tags
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-question">Question *</Label>
              <Textarea
                disabled={saving}
                id="edit-question"
                placeholder="Enter the question..."
                value={formData.question}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, question: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-answer">Answer *</Label>
              <Textarea
                disabled={saving}
                id="edit-answer"
                placeholder="Enter the answer..."
                value={formData.answer}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, answer: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-tags">Tags</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  disabled={saving}
                  id="edit-tags"
                  placeholder="Add a tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button type="button" onClick={addTag} size="sm">
                  Add
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={'Remove tag ' + tag}
                        onClick={() => removeTag(tag)}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
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
            <Button onClick={handleEditEntry} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              Update Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
