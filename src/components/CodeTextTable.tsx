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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, Save, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TABLE_NAME = 'codeTextTable';

interface CodeTextEntry {
  id: number;
  code: string;
  text: string;
  createdAt?: string;
}

interface CodeTextFormData {
  code: string;
  text: string;
}

export default function CodeTextTable() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [entries, setEntries] = useState<CodeTextEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CodeTextEntry | null>(null);
  const [formData, setFormData] = useState<CodeTextFormData>({ code: '', text: '' });

  const client = useBotpressClient(selectedBotId);

  useEffect(() => {
    if (!selectedBotId && settings.bots.length > 0) {
      const firstBot = settings.bots.find((bot) => bot.botId);
      if (firstBot) setSelectedBotId(firstBot.botId);
    }
  }, [settings.bots, selectedBotId]);

  useEffect(() => {
    if (client && selectedBotId) {
      loadEntries();
    }
  }, [client, selectedBotId]);

  const loadEntries = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const response = await client.findTableRows({
        table: TABLE_NAME,
        limit: 1000,
        orderBy: 'createdAt',
        orderDirection: 'desc'
      });

      setEntries(
        response.rows.map((row: any) => ({
          id: row.id,
          code: (row.code as string) || '',
          text: (row.text as string) || '',
          createdAt: row.createdAt
        }))
      );
    } catch (error) {
      console.error('Error loading code/text entries:', error);
      toast.error('Failed to load code/text entries');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => setFormData({ code: '', text: '' });

  const handleAdd = async () => {
    if (!client || !formData.code.trim() || !formData.text.trim()) {
      toast.error('Code and text are required');
      return;
    }

    try {
      setSaving(true);
      await client.createTableRows({
        table: TABLE_NAME,
        rows: [
          {
            code: formData.code.trim(),
            text: formData.text.trim()
          }
        ]
      });
      toast.success('Entry added');
      setIsAddDialogOpen(false);
      resetForm();
      loadEntries();
    } catch (error) {
      console.error('Error adding code/text entry:', error);
      toast.error('Failed to add entry');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!client || !editingEntry || !formData.code.trim() || !formData.text.trim()) {
      toast.error('Code and text are required');
      return;
    }

    try {
      setSaving(true);
      await client.updateTableRows({
        table: TABLE_NAME,
        rows: [
          {
            id: editingEntry.id,
            code: formData.code.trim(),
            text: formData.text.trim()
          }
        ]
      });
      toast.success('Entry updated');
      setIsEditDialogOpen(false);
      setEditingEntry(null);
      resetForm();
      loadEntries();
    } catch (error) {
      console.error('Error updating code/text entry:', error);
      toast.error('Failed to update entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!client) return;
    try {
      await client.deleteTableRows({ table: TABLE_NAME, ids: [id] });
      toast.success('Entry deleted');
      loadEntries();
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

  if (!settings.token || !settings.workspaceId || settings.bots.length === 0) {
    return (
      <div className="flex justify-center w-full px-6 py-12">
        <div className="w-full max-w-4xl">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Configuration Required</CardTitle>
              <CardDescription>Please configure your Botpress workspace and bots to manage code/text entries</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-4 space-y-4">
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

            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">Manage code/text mappings for the selected bot</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadEntries()}
                disabled={!client || loading}
                className="h-9"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedBotId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Entries</CardTitle>
                <CardDescription>Manage code/text entries for the selected bot</CardDescription>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl bg-white">
                  <DialogHeader>
                    <DialogTitle>Add Code/Text Entry</DialogTitle>
                    <DialogDescription>Create a new code/text entry</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="code">Code *</Label>
                      <Input
                        id="code"
                        placeholder="Enter code"
                        value={formData.code}
                        onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="text">Text *</Label>
                      <Textarea
                        id="text"
                        placeholder="Enter text"
                        value={formData.text}
                        onChange={(e) => setFormData((prev) => ({ ...prev, text: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAdd} disabled={loading || saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      {saving ? 'Saving...' : 'Add Entry'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading entries...</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No code/text entries found. Add your first entry.</div>
            ) : (
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
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono whitespace-nowrap">{entry.code}</TableCell>
                        <TableCell className="max-w-lg">
                          <div className="truncate" title={entry.text}>
                            {entry.text}
                          </div>
                        </TableCell>
                        <TableCell>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(entry)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm('Delete this entry?')) handleDelete(entry.id);
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>Edit Code/Text Entry</DialogTitle>
            <DialogDescription>Update the code/text entry details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-code">Code *</Label>
              <Input
                id="edit-code"
                placeholder="Enter code"
                value={formData.code}
                onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-text">Text *</Label>
              <Textarea
                id="edit-text"
                placeholder="Enter text"
                value={formData.text}
                onChange={(e) => setFormData((prev) => ({ ...prev, text: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? 'Saving...' : 'Update Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
