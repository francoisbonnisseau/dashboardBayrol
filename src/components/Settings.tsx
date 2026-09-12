import { useEffect, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { PageHeader, Section, StatusBadge } from '@/components/dashboard';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, RefreshCw } from 'lucide-react';
import type { AppSettings } from '../types';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const secureConfigEnabled =
    import.meta.env.VITE_SECURE_CONFIG_ENABLED === 'true';
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    Record<string, 'idle' | 'loading' | 'success' | 'error'>
  >({
    fr: 'idle',
    de: 'idle',
    es: 'idle',
    'leroy-merlin-es': 'idle',
  });

  const webhooks = {
    fr: 'https://webhook.botpress.cloud/c9176623-9e4b-40ad-a4c6-7a2a4b20f2bc',
    de: 'https://webhook.botpress.cloud/4c99d505-0734-4f7d-beec-85281b5e339b',
    es: 'https://webhook.botpress.cloud/16dcf4f1-a0b5-429e-be31-de16418a136a',
    'leroy-merlin-es':
      'https://webhook.botpress.cloud/ea737568-7729-426e-86b4-622f1ab092d7',
  };

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      updateSettings(
        secureConfigEnabled
          ? {
              ...formData,
              token: settings.token,
              workspaceId: settings.workspaceId,
            }
          : formData,
      );
      // Show success feedback
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success('Settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async (botKey: string) => {
    setSyncStatus((prev) => ({ ...prev, [botKey]: 'loading' }));

    try {
      const webhookUrl = webhooks[botKey as keyof typeof webhooks];

      if (!webhookUrl) {
        setSyncStatus((prev) => ({ ...prev, [botKey]: 'error' }));
        setTimeout(() => {
          setSyncStatus((prev) => ({ ...prev, [botKey]: 'idle' }));
        }, 3000);
        return;
      }

      // Open the webhook URL in a hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = webhookUrl; // This will make a GET request
      document.body.appendChild(iframe);

      // Simulate successful response since we can't access the iframe's content due to CORS
      setSyncStatus((prev) => ({ ...prev, [botKey]: 'success' }));

      // Clean up after a delay
      setTimeout(() => {
        document.body.removeChild(iframe);
        setSyncStatus((prev) => ({ ...prev, [botKey]: 'idle' }));
      }, 3000);
    } catch (error) {
      console.error(`Error syncing ${botKey}:`, error);
      setSyncStatus((prev) => ({ ...prev, [botKey]: 'error' }));
      // Reset status after 3 seconds
      setTimeout(() => {
        setSyncStatus((prev) => ({ ...prev, [botKey]: 'idle' }));
      }, 3000);
    }
  };
  const handleBotIdChange = (botId: string, newBotId: string) => {
    setFormData((prev) => ({
      ...prev,
      bots: prev.bots.map((bot) =>
        bot.id === botId ? { ...bot, botId: newBotId } : bot,
      ),
    }));
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace configuration and bot synchronization"
      />
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Settings */}
        <Section
          title="General Configuration"
          description={
            <>
              {secureConfigEnabled
                ? 'Botpress credentials are managed by Supabase Edge Functions'
                : 'Configure your Botpress workspace and authentication'}
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid items-center gap-3 border-b py-3 sm:grid-cols-[220px_minmax(0,1fr)]">
              <Label htmlFor="token">API Token</Label>
              <Input
                id="token"
                type="password"
                placeholder={
                  secureConfigEnabled
                    ? 'Managed by secure backend'
                    : 'Enter your Botpress API token'
                }
                value={
                  secureConfigEnabled
                    ? settings.token
                      ? '****************'
                      : ''
                    : formData.token
                }
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, token: e.target.value }))
                }
                required={!secureConfigEnabled}
                disabled={secureConfigEnabled || isSaving}
              />
            </div>

            <div className="grid items-center gap-3 border-b py-3 sm:grid-cols-[220px_minmax(0,1fr)]">
              <Label htmlFor="workspaceId">Workspace ID</Label>
              <Input
                id="workspaceId"
                placeholder={
                  secureConfigEnabled
                    ? 'Managed by secure backend'
                    : 'Enter your workspace ID'
                }
                value={
                  secureConfigEnabled
                    ? settings.workspaceId
                    : formData.workspaceId
                }
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    workspaceId: e.target.value,
                  }))
                }
                required={!secureConfigEnabled}
                disabled={secureConfigEnabled || isSaving}
              />
            </div>
          </div>
        </Section>

        {/* Bot Configuration */}
        <Section
          title="Bot Configuration"
          description={<>Configure the Bot IDs for each language version</>}
        >
          <div className="space-y-4">
            {formData.bots.map((bot) => (
              <div
                key={bot.id}
                className="grid items-center gap-3 border-b py-3 sm:grid-cols-[220px_minmax(0,1fr)]"
              >
                <Label htmlFor={`bot-${bot.id}`}>{bot.name} Bot ID</Label>
                <Input
                  id={`bot-${bot.id}`}
                  placeholder={
                    secureConfigEnabled
                      ? 'Managed by secure backend'
                      : `Enter Bot ID for ${bot.name}`
                  }
                  value={bot.botId}
                  onChange={(e) => handleBotIdChange(bot.id, e.target.value)}
                  disabled={secureConfigEnabled || isSaving}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Synchronization */}
        <Section
          title="Synchronization"
          description={<>Manually trigger synchronization for each bot</>}
        >
          <div className="space-y-4">
            <div className="divide-y">
              {Object.keys(webhooks).map((key) => (
                <div
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="text-sm font-medium">
                    {formData.bots.find((bot) => bot.id === key)?.name ||
                      key.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      variant={
                        syncStatus[key] === 'error'
                          ? 'danger'
                          : syncStatus[key] === 'success'
                            ? 'success'
                            : 'neutral'
                      }
                    >
                      {syncStatus[key] === 'success'
                        ? 'Sync requested'
                        : syncStatus[key]}
                    </StatusBadge>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSync(key)}
                      disabled={syncStatus[key] === 'loading'}
                      aria-label={'Synchronize ' + key}
                    >
                      <RefreshCw className="size-4" />
                      Sync
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </>
  );
}
