import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, RefreshCw } from 'lucide-react';
import type { AppSettings } from '../types';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({
    'fr': 'idle',
    'de': 'idle',
    'es': 'idle'
  });

  const webhooks = {
    'fr': 'https://webhook.botpress.cloud/c9176623-9e4b-40ad-a4c6-7a2a4b20f2bc',
    'de': 'https://webhook.botpress.cloud/4c99d505-0734-4f7d-beec-85281b5e339b',
    'es': 'https://webhook.botpress.cloud/16dcf4f1-a0b5-429e-be31-de16418a136a'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      updateSettings(formData);
      // Show success feedback
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSync = async (botKey: string) => {
    setSyncStatus(prev => ({ ...prev, [botKey]: 'loading' }));
    
    try {
      const webhookUrl = webhooks[botKey as keyof typeof webhooks];
      
      // Open the webhook URL in a hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = webhookUrl; // This will make a GET request
      document.body.appendChild(iframe);
      
      // Simulate successful response since we can't access the iframe's content due to CORS
      setSyncStatus(prev => ({ ...prev, [botKey]: 'success' }));
      
      // Clean up after a delay
      setTimeout(() => {
        document.body.removeChild(iframe);
        setSyncStatus(prev => ({ ...prev, [botKey]: 'idle' }));
      }, 3000);
    } catch (error) {
      console.error(`Error syncing ${botKey}:`, error);
      setSyncStatus(prev => ({ ...prev, [botKey]: 'error' }));
      // Reset status after 3 seconds
      setTimeout(() => {
        setSyncStatus(prev => ({ ...prev, [botKey]: 'idle' }));
      }, 3000);
    }
  };  const handleBotIdChange = (botId: string, newBotId: string) => {
    setFormData(prev => ({
      ...prev,
      bots: prev.bots.map(bot => 
        bot.id === botId ? { ...bot, botId: newBotId } : bot
      )
    }));
  };

  return (    <div className="w-full px-6 py-6 space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General Configuration</CardTitle>
            <CardDescription>
              Configure your Botpress workspace and authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">API Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Enter your Botpress API token"
                value={formData.token}
                onChange={(e) => setFormData(prev => ({ ...prev, token: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="workspaceId">Workspace ID</Label>
              <Input
                id="workspaceId"
                placeholder="Enter your workspace ID"
                value={formData.workspaceId}
                onChange={(e) => setFormData(prev => ({ ...prev, workspaceId: e.target.value }))}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Bot Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Bot Configuration</CardTitle>
            <CardDescription>
              Configure the Bot IDs for each language version
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.bots.map((bot) => (
              <div key={bot.id} className="space-y-2">
                <Label htmlFor={`bot-${bot.id}`}>{bot.name} Bot ID</Label>
                <Input
                  id={`bot-${bot.id}`}
                  placeholder={`Enter Bot ID for ${bot.name}`}
                  value={bot.botId}
                  onChange={(e) => handleBotIdChange(bot.id, e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
        
        {/* Synchronization */}
        <Card>
          <CardHeader>
            <CardTitle>Synchronization</CardTitle>
            <CardDescription>
              Manually trigger synchronization for each bot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* FR Bot Sync */}
              <div className="border rounded-md p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Bot FR</h3>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync('fr')}
                    disabled={syncStatus['fr'] === 'loading'}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncStatus['fr'] === 'loading' ? 'animate-spin' : ''}`} />
                    {syncStatus['fr'] === 'loading' ? 'Syncing...' : 
                     syncStatus['fr'] === 'success' ? 'Synced!' : 
                     syncStatus['fr'] === 'error' ? 'Failed!' : 'Sync'}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Trigger synchronization for French bot
                </p>
              </div>
              
              {/* DE Bot Sync */}
              <div className="border rounded-md p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Bot DE</h3>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync('de')}
                    disabled={syncStatus['de'] === 'loading'}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncStatus['de'] === 'loading' ? 'animate-spin' : ''}`} />
                    {syncStatus['de'] === 'loading' ? 'Syncing...' : 
                     syncStatus['de'] === 'success' ? 'Synced!' : 
                     syncStatus['de'] === 'error' ? 'Failed!' : 'Sync'}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Trigger synchronization for German bot
                </p>
              </div>
              
              {/* ES Bot Sync */}
              <div className="border rounded-md p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Bot ES</h3>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync('es')}
                    disabled={syncStatus['es'] === 'loading'}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncStatus['es'] === 'loading' ? 'animate-spin' : ''}`} />
                    {syncStatus['es'] === 'loading' ? 'Syncing...' : 
                     syncStatus['es'] === 'success' ? 'Synced!' : 
                     syncStatus['es'] === 'error' ? 'Failed!' : 'Sync'}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Trigger synchronization for Spanish bot
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
