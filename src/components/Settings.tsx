import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import type { AppSettings } from '../types';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);

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
  };  const handleBotIdChange = (botId: string, newBotId: string) => {
    setFormData(prev => ({
      ...prev,
      bots: prev.bots.map(bot => 
        bot.id === botId ? { ...bot, botId: newBotId } : bot
      )
    }));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

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
