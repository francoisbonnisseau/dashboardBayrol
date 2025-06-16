import { useState } from 'react';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import Navigation from './components/Navigation';
import ConversationsList from './components/ConversationsList';
import Settings from './components/Settings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon } from 'lucide-react';
import './App.css';

function AppContent() {
  const [activeView, setActiveView] = useState<'conversations' | 'settings'>('conversations');
  const { isConfigured } = useSettings();
  
  console.log('Current view:', activeView, 'isConfigured:', isConfigured);

  // Function to directly navigate to settings without restrictions
  const goToSettings = () => {
    setActiveView('settings');
  };

  return (
    <div className="min-h-screen bg-background w-full">
      {/* Navigation always visible */}
      <Navigation activeView={activeView} onViewChange={setActiveView} />
      
      {/* Main content */}
      <main className="w-full">
        {/* Always show selected view regardless of configuration */}
        {activeView === 'settings' ? (
          <Settings />
        ) : (
          !isConfigured ? (
            /* Welcome screen for unconfigured app */
            <div className="flex justify-center w-full px-6 py-12">
              <div className="w-full max-w-4xl">
                <Card>
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Welcome to Botpress Dashboard</CardTitle>
                    <CardDescription>
                      Get started by configuring your Botpress workspace and bot settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <Button 
                      onClick={goToSettings}
                      variant="default"
                      size="lg"
                      className="px-5 py-3 text-lg shadow-lg"
                    >
                      <SettingsIcon className="h-5 w-5 mr-2" />
                      Configure Settings
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <ConversationsList />
          )
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

export default App;
