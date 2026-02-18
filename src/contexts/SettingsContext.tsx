import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AppSettings, BotConfig } from '../types';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => void;
  isConfigured: boolean;
}

const defaultBots: BotConfig[] = [
  { id: 'fr', name: 'FR version', botId: import.meta.env.VITE_BOTPRESS_BOT_ID_FR || '' },
  { id: 'de', name: 'DE version', botId: import.meta.env.VITE_BOTPRESS_BOT_ID_DE || '' },
  { id: 'es', name: 'ES version', botId: import.meta.env.VITE_BOTPRESS_BOT_ID_ES || '' },
  { id: 'leroy-merlin-es', name: 'Leroy Merlin - ES', botId: import.meta.env.VITE_BOTPRESS_BOT_ID_LEROY_MERLIN_ES },
];

const defaultSettings: AppSettings = {
  token: import.meta.env.VITE_BOTPRESS_TOKEN || '',
  workspaceId: import.meta.env.VITE_BOTPRESS_WORKSPACE_ID || '',
  bots: defaultBots,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('botpress-dashboard-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        // Ensure we always have the default bot structure
        const mergedSettings = {
          ...defaultSettings,
          ...parsed,
          bots: defaultBots.map(defaultBot => {
            const savedBot = parsed.bots?.find((bot: BotConfig) => bot.id === defaultBot.id);
            return savedBot ? { ...defaultBot, ...savedBot } : defaultBot;
          })
        };
        setSettings(mergedSettings);
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('botpress-dashboard-settings', JSON.stringify(newSettings));
  };

  const isConfigured = Boolean(
    settings.token && 
    settings.workspaceId && 
    settings.bots.some(bot => bot.botId)
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
