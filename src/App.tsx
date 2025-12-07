import { useState, useEffect } from 'react';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ConversationsList from './components/ConversationsList';
import SentimentAnalysis from './components/SentimentAnalysis';
import Feedbacks from './components/Feedbacks';
import Analysis from './components/Analysis';
import Analytics from './components/Analytics';
import Learnings from './components/Learnings';
import IntroTable from './components/IntroTable';
import Settings from './components/Settings';
import LoginPage from './components/LoginPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon } from 'lucide-react';
import { Toaster } from 'sonner';
import './App.css';

function AppContent() {
  const [activeView, setActiveView] = useState<'conversations' | 'sentiment' | 'feedbacks' | 'settings' | 'analysis' | 'learnings' | 'intro' | 'analytics'>('sentiment');
  const { isConfigured } = useSettings();
  const { isAuthenticated, userRole, logout } = useAuth();
  
  // Redirect away if code elsewhere still sets conversations
  useEffect(() => {
    if (activeView === 'conversations') {
      setActiveView('sentiment');
    }
  }, [activeView]);

  const goToSettings = () => {
    setActiveView('settings');
  };

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <>
      <Layout 
        activeView={activeView} 
        onViewChange={setActiveView} 
        userRole={userRole} 
        onLogout={logout} 
      >
        {activeView === 'settings' && <Settings />}
        {activeView === 'analysis' && isConfigured && userRole === 'admin' && <Analysis />}
        {activeView === 'analytics' && isConfigured && <Analytics />}
        {activeView === 'learnings' && isConfigured && <Learnings />}
        {activeView === 'intro' && isConfigured && <IntroTable />}
        {activeView === 'sentiment' && isConfigured && <SentimentAnalysis />}
        {activeView === 'feedbacks' && isConfigured && <Feedbacks />}
        {(activeView === 'sentiment' || activeView === 'feedbacks' || activeView === 'analysis' || activeView === 'learnings' || activeView === 'intro' || activeView === 'analytics') && !isConfigured && (
          <div className="flex justify-center w-full px-6 py-12">
            <div className="w-full max-w-4xl">
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">Configuration Required</CardTitle>
                  <CardDescription>
                    Please configure your Botpress workspace and bot settings before accessing sentiment analysis, feedbacks, learnings, intro entries, or analytics
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
        )}
        {activeView === 'conversations' && !isConfigured && (
          <div className="flex justify-center w-full px-6 py-12">
            <div className="w-full max-w-4xl">
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">Welcome to Bayrol Analytics Dashboard</CardTitle>
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
        )}
        {activeView === 'conversations' && isConfigured && <ConversationsList />}
      </Layout>
      <Toaster position="top-center" />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
