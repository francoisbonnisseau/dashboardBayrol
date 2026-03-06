import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBotpressClient } from '../hooks/useBotpressClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface LearningEntry {
  id: number;
  question: string;
  answer: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface LearningFormData {
  question: string;
  answer: string;
  tags: string[];
}

export default function Learnings() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [learnings, setLearnings] = useState<LearningEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LearningEntry | null>(null);
  const [formData, setFormData] = useState<LearningFormData>({
    question: '',
    answer: '',
    tags: []
  });
  const [newTag, setNewTag] = useState('');

  const client = useBotpressClient(selectedBotId);

  // Load learnings when bot is selected
  useEffect(() => {
    if (client && selectedBotId) {
      loadLearnings();
    }
  }, [client, selectedBotId]);

  const loadLearnings = async () => {
    if (!client) return;

    setLoading(true);
    try {
      const response = await client.findTableRows({
        table: 'learningsTable',
        limit: 1000,
        orderBy: 'createdAt',
        orderDirection: 'desc'
      });

      setLearnings(response.rows.map(row => ({
        id: row.id,
        question: row.question as string,
        answer: row.answer as string,
        tags: (row.tags as string[]) || [],
        createdAt: row.createdAt || '',
        updatedAt: row.updatedAt || ''
      })));
    } catch (error) {
      console.error('Error loading learnings:', error);
      toast.error('Failed to load learnings');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!client || !formData.question.trim() || !formData.answer.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await client.createTableRows({
        table: 'learningsTable',
        rows: [
          {
            question: formData.question.trim(),
            answer: formData.answer.trim(),
            tags: formData.tags
          }
        ]
      });

      toast.success('Learning entry added successfully');
      setIsAddDialogOpen(false);
      resetForm();
      loadLearnings();
    } catch (error) {
      console.error('Error adding entry:', error);
      toast.error('Failed to add learning entry');
    }
  };

  const handleEditEntry = async () => {
    if (!client || !editingEntry || !formData.question.trim() || !formData.answer.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await client.updateTableRows({
        table: 'learningsTable',
        rows: [
          {
            id: editingEntry.id,
            question: formData.question.trim(),
            answer: formData.answer.trim(),
            tags: formData.tags
          }
        ]
      });

      toast.success('Learning entry updated successfully');
      setIsEditDialogOpen(false);
      setEditingEntry(null);
      resetForm();
      loadLearnings();
    } catch (error) {
      console.error('Error updating entry:', error);
      toast.error('Failed to update learning entry');
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!client) return;

    try {
      await client.deleteTableRows({
        table: 'learningsTable',
        ids: [id]
      });

      toast.success('Learning entry deleted successfully');
      loadLearnings();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete learning entry');
    }
  };

  const resetForm = () => {
    setFormData({
      question: '',
      answer: '',
      tags: []
    });
    setNewTag('');
  };

  const openEditDialog = (entry: LearningEntry) => {
    setEditingEntry(entry);
    setFormData({
      question: entry.question,
      answer: entry.answer,
      tags: entry.tags || []
    });
    setIsEditDialogOpen(true);
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  if (!settings.token || !settings.workspaceId || settings.bots.length === 0) {
    return (
      <div className="flex justify-center w-full px-6 py-12">
        <div className="w-full max-w-4xl">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Configuration Required</CardTitle>
              <CardDescription>
                Please configure your Botpress workspace and bots to manage learnings
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-4 space-y-4">
      {/* Header Card */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Bot:</span>
              <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Select a bot" />
                </SelectTrigger>
                <SelectContent>
                  {settings.bots.filter((bot) => bot.botId).map((bot) => (
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
        </CardContent>
      </Card>

      {selectedBotId && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Learning Entries</CardTitle>
                  <CardDescription>
                    Manage questions, answers, and tags for the selected bot
                  </CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => resetForm()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl bg-white">
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
                          id="question"
                          placeholder="Enter the question..."
                          value={formData.question}
                          onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="answer">Answer *</Label>
                        <Textarea
                          id="answer"
                          placeholder="Enter the answer..."
                          value={formData.answer}
                          onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tags">Tags</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
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
                              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                {tag}
                                <X
                                  className="h-3 w-3 cursor-pointer"
                                  onClick={() => removeTag(tag)}
                                />
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddEntry}>
                        <Save className="h-4 w-4 mr-2" />
                        Add Entry
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading learnings...</div>
              ) : learnings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No learning entries found. Add your first entry to get started.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Question</TableHead>
                        <TableHead>Answer</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {learnings.map((entry) => (
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
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(entry)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this entry?')) {
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
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl bg-white">
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
                  id="edit-question"
                  placeholder="Enter the question..."
                  value={formData.question}
                  onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-answer">Answer *</Label>
                <Textarea
                  id="edit-answer"
                  placeholder="Enter the answer..."
                  value={formData.answer}
                  onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-tags">Tags</Label>
                <div className="flex gap-2 mt-1">
                  <Input
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
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => removeTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditEntry}>
                <Save className="h-4 w-4 mr-2" />
                Update Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
