import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AppSettings, BotConfig } from '../types';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => void;
  isConfigured: boolean;
}

const defaultBots: BotConfig[] = [
  { id: 'fr', name: 'FR version', botId: '' },
  { id: 'de', name: 'DE version', botId: '' },
  { id: 'es', name: 'ES version', botId: '' },
];

const defaultSettings: AppSettings = {
  token: '',
  workspaceId: '',
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
