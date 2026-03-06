import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppSettings, BotConfig } from '../types';
import { useAuth } from './AuthContext';
import { getBotpressConfig } from '@/lib/edgeFunctions';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => void;
  isConfigured: boolean;
}

const STORAGE_KEY = 'botpress-dashboard-settings';
const secureConfigEnabled = import.meta.env.VITE_SECURE_CONFIG_ENABLED === 'true';

const defaultBots: BotConfig[] = [
  { id: 'fr', name: 'FR version', botId: import.meta.env.VITE_BOTPRESS_BOT_ID_FR || '' },
  { id: 'de', name: 'DE version', botId: import.meta.env.VITE_BOTPRESS_BOT_ID_DE || '' },
  { id: 'es', name: 'ES version', botId: import.meta.env.VITE_BOTPRESS_BOT_ID_ES || '' },
  { id: 'leroy-merlin-es', name: 'Leroy Merlin - ES', botId: import.meta.env.VITE_BOTPRESS_BOT_ID_LEROY_MERLIN_ES || '' },
];

const defaultSettings: AppSettings = {
  token: secureConfigEnabled ? '' : (import.meta.env.VITE_BOTPRESS_TOKEN || ''),
  workspaceId: secureConfigEnabled ? '' : (import.meta.env.VITE_BOTPRESS_WORKSPACE_ID || ''),
  bots: defaultBots,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function normalizeBots(savedBots: BotConfig[] | undefined): BotConfig[] {
  return defaultBots.map((defaultBot) => {
    const savedBot = savedBots?.find((bot) => bot.id === defaultBot.id);
    const merged = savedBot ? { ...defaultBot, ...savedBot } : defaultBot;
    return { ...merged, botId: String(merged.botId ?? '').trim() };
  });
}

function persistNonSensitiveSettings(nextSettings: AppSettings) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      workspaceId: secureConfigEnabled ? '' : nextSettings.workspaceId,
      bots: nextSettings.bots,
    })
  );
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, sessionToken } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (!savedSettings) return;

    try {
      const parsed = JSON.parse(savedSettings);
      const mergedSettings: AppSettings = {
        ...defaultSettings,
        token: defaultSettings.token,
        workspaceId: secureConfigEnabled
          ? ''
          : String(parsed.workspaceId ?? defaultSettings.workspaceId ?? '').trim(),
        bots: secureConfigEnabled ? normalizeBots(undefined) : normalizeBots(parsed.bots),
      };
      setSettings(mergedSettings);
      persistNonSensitiveSettings(mergedSettings);
    } catch (error) {
      console.error('Failed to parse saved settings:', error);
    }
  }, []);

  useEffect(() => {
    if (!secureConfigEnabled) return;

    if (!isAuthenticated || !sessionToken) {
      setSettings((prev) => ({ ...prev, token: '', workspaceId: '' }));
      return;
    }

    let cancelled = false;

    const loadSecureConfig = async () => {
      try {
        const config = await getBotpressConfig(sessionToken);
        if (cancelled) return;

        setSettings((prev) => {
          const secureBots = config.bots || {};
          const mergedBots = defaultBots.map((bot) => ({
            ...bot,
            botId: String(secureBots[bot.id] ?? '').trim(),
          }));

          const nextSettings: AppSettings = {
            ...prev,
            token: String(config.token ?? '').trim(),
            workspaceId: String(config.workspaceId ?? '').trim(),
            bots: mergedBots,
          };

          persistNonSensitiveSettings(nextSettings);
          return nextSettings;
        });
      } catch (error) {
        console.error('Failed to load secure Botpress config:', error);
        if (!cancelled) {
          setSettings((prev) => ({ ...prev, token: '', workspaceId: '' }));
        }
      }
    };

    loadSecureConfig();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, sessionToken]);

  const updateSettings = (newSettings: AppSettings) => {
    const sanitizedSettings: AppSettings = {
      ...newSettings,
      token: secureConfigEnabled ? settings.token : String(newSettings.token ?? '').trim(),
      workspaceId: secureConfigEnabled ? settings.workspaceId : String(newSettings.workspaceId ?? '').trim(),
      bots: secureConfigEnabled
        ? settings.bots
        : newSettings.bots.map((bot) => ({
            ...bot,
            botId: String(bot.botId ?? '').trim(),
          })),
    };

    setSettings(sanitizedSettings);
    persistNonSensitiveSettings(sanitizedSettings);
  };

  const isConfigured = useMemo(
    () => Boolean(settings.token && settings.workspaceId && settings.bots.some((bot) => bot.botId)),
    [settings]
  );

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isConfigured }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
