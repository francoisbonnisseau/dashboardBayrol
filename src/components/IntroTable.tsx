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

const TABLE_NAME = 'introTable';

interface IntroEntry {
  id: number;
  sentence: string;
  season: string;
  live: string;
  createdAt?: string;
  updatedAt?: string;
}

interface IntroFormData {
  sentence: string;
  season: string;
  live: string;
}

export default function IntroTable() {
  const { settings } = useSettings();
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [entries, setEntries] = useState<IntroEntry[]>([]);
  const [loading, setLoading] = useState(false); // loading list
  const [saving, setSaving] = useState(false);   // add/update in progress
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<IntroEntry | null>(null);
  const [formData, setFormData] = useState<IntroFormData>({ sentence: '', season: '', live: '' });

  const client = useBotpressClient(selectedBotId);

  useEffect(() => {
    if (!selectedBotId && settings.bots.length > 0) {
      const firstBot = settings.bots.find(b => b.botId);
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
      setEntries(response.rows.map((row: any) => {
        // row.live might be boolean or string; normalize to display string
        let liveValue = '';
        if (typeof row.live === 'boolean') liveValue = row.live ? 'yes' : 'no';
        else if (typeof row.live === 'string') liveValue = row.live.toLowerCase();
        return {
          id: row.id,
          sentence: (row.sentence as string) || '',
          season: (row.season as string) || '',
          live: liveValue,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        } as IntroEntry;
      }));
    } catch (error) {
      console.error('Error loading intro entries:', error);
      toast.error('Failed to load intro entries');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => setFormData({ sentence: '', season: '', live: '' });

  const handleAdd = async () => {
    if (!client || !formData.sentence.trim()) {
      toast.error('Sentence is required');
      return;
    }
    try {
      setSaving(true);
      await client.createTableRows({
        table: TABLE_NAME,
        rows: [{
          sentence: formData.sentence.trim(),
          season: formData.season.trim(),
          // convert yes/no to boolean; if empty keep undefined
          ...(formData.live ? { live: formData.live === 'yes' } : {})
        }]
      });
      toast.success('Intro entry added');
      setIsAddDialogOpen(false);
      resetForm();
      loadEntries();
    } catch (error) {
      console.error('Error adding intro entry:', error);
      toast.error('Failed to add entry');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!client || !editingEntry || !formData.sentence.trim()) {
      toast.error('Sentence is required');
      return;
    }
    try {
      setSaving(true);
      await client.updateTableRows({
        table: TABLE_NAME,
        rows: [{
          id: editingEntry.id,
          sentence: formData.sentence.trim(),
          season: formData.season.trim(),
          ...(formData.live ? { live: formData.live === 'yes' } : {})
        }]
      });
      toast.success('Intro entry updated');
      setIsEditDialogOpen(false);
      setEditingEntry(null);
      resetForm();
      loadEntries();
    } catch (error) {
      console.error('Error updating intro entry:', error);
      toast.error('Failed to update entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!client) return;
    try {
      await client.deleteTableRows({ table: TABLE_NAME, ids: [id] });
      toast.success('Intro entry deleted');
      loadEntries();
    } catch (error) {
      console.error('Error deleting intro entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  const openEditDialog = (entry: IntroEntry) => {
    setEditingEntry(entry);
    setFormData({ sentence: entry.sentence, season: entry.season, live: entry.live });
    setIsEditDialogOpen(true);
  };

  if (!settings.token || !settings.workspaceId || settings.bots.length === 0) {
    return (
      <div className="flex justify-center w-full px-6 py-12">
        <div className="w-full max-w-4xl">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Configuration Required</CardTitle>
              <CardDescription>Please configure your Botpress workspace and bots to manage intro entries</CardDescription>
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
                  {settings.bots.filter((bot) => bot.botId).map(bot => (
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
                  <CardDescription>Manage intro sentences for the selected bot</CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { resetForm(); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-xl bg-white">
                    <DialogHeader>
                      <DialogTitle>Add Intro Entry</DialogTitle>
                      <DialogDescription>Create a new intro entry</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="sentence">Sentence *</Label>
                        <Textarea id="sentence" placeholder="Enter the sentence..." value={formData.sentence} onChange={e => setFormData(prev => ({ ...prev, sentence: e.target.value }))} className="mt-1" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="season">Season</Label>
                          <Input id="season" placeholder="e.g. summer" value={formData.season} onChange={e => setFormData(prev => ({ ...prev, season: e.target.value }))} className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="live">Live</Label>
                          <Select
                            value={formData.live}
                            onValueChange={(v) => setFormData(prev => ({ ...prev, live: v }))}
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
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
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
                <div className="text-center py-8 text-muted-foreground">No intro entries found. Add your first entry.</div>
              ) : (
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
                      {entries.map(entry => (
                        <TableRow key={entry.id}>
                          <TableCell className="max-w-xs"><div className="truncate" title={entry.sentence}>{entry.sentence}</div></TableCell>
                          <TableCell>{entry.season || '—'}</TableCell>
                          <TableCell>{entry.live ? (entry.live === 'yes' ? 'Yes' : 'No') : '—'}</TableCell>
                          <TableCell>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(entry)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => { if (confirm('Delete this entry?')) handleDelete(entry.id); }}>
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
              <DialogTitle>Edit Intro Entry</DialogTitle>
              <DialogDescription>Update the intro sentence details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-sentence">Sentence *</Label>
                <Textarea id="edit-sentence" placeholder="Enter the sentence..." value={formData.sentence} onChange={e => setFormData(prev => ({ ...prev, sentence: e.target.value }))} className="mt-1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-season">Season</Label>
                  <Input id="edit-season" placeholder="e.g. winter" value={formData.season} onChange={e => setFormData(prev => ({ ...prev, season: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="edit-live">Live</Label>
                  <Select
                    value={formData.live}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, live: v }))}
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
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
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
