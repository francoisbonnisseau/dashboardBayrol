import { useMemo } from 'react';
import { Client } from '@botpress/client';
import { useSettings } from '../contexts/SettingsContext';

export function useBotpressClient(botId?: string) {
  const { settings } = useSettings();

  const client = useMemo(() => {
    if (!settings.token || !settings.workspaceId || !botId) {
      return null;
    }

    return new Client({
      token: settings.token,
      workspaceId: settings.workspaceId,
      botId: botId,
    });
  }, [settings.token, settings.workspaceId, botId]);

  return client;
}
