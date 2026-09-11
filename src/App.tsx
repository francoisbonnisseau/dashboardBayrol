import { useState, useEffect, lazy, Suspense } from 'react';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './components/LoginPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon } from 'lucide-react';
import { Toaster } from 'sonner';
import type { DashboardView } from '@/types/views';
import './App.css';

const ConversationsList = lazy(() => import('./components/ConversationsList'));
const SentimentAnalysis = lazy(() => import('./components/SentimentAnalysis'));
const Feedbacks = lazy(() => import('./components/Feedbacks'));
const Analysis = lazy(() => import('./components/Analysis'));
const Analytics = lazy(() => import('./components/Analytics'));
const Learnings = lazy(() => import('./components/Learnings'));
const IntroTable = lazy(() => import('./components/IntroTable'));
const CodeTextTable = lazy(() => import('./components/CodeTextTable'));
const PromptManagement = lazy(() => import('./components/PromptManagement'));
const ModelTesting = lazy(() => import('./components/ModelTesting'));
const Settings = lazy(() => import('./components/Settings'));

function AppContent() {
  const [activeView, setActiveView] = useState<DashboardView>('sentiment');
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
        <Suspense fallback={<div className="p-6 text-muted-foreground" role="status">Loading…</div>}>
        {activeView === 'settings' && <Settings />}
        {activeView === 'analysis' && isConfigured && userRole === 'admin' && <Analysis />}
        {activeView === 'analytics' && isConfigured && <Analytics />}
        {activeView === 'learnings' && isConfigured && <Learnings />}
        {activeView === 'intro' && isConfigured && <IntroTable />}
        {activeView === 'codeText' && isConfigured && <CodeTextTable />}
        {activeView === 'testPrompts' && isConfigured && <PromptManagement />}
        {activeView === 'testModels' && isConfigured && <ModelTesting />}
        {activeView === 'sentiment' && isConfigured && <SentimentAnalysis />}
        {activeView === 'feedbacks' && isConfigured && <Feedbacks />}
        {(activeView === 'sentiment' ||
          activeView === 'feedbacks' ||
          activeView === 'analysis' ||
          activeView === 'learnings' ||
          activeView === 'intro' ||
          activeView === 'codeText' ||
          activeView === 'analytics' ||
          activeView === 'testPrompts' ||
          activeView === 'testModels') &&
          !isConfigured && (
          <div className="flex justify-center w-full px-6 py-12">
            <div className="w-full max-w-4xl">
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">Configuration Required</CardTitle>
                  <CardDescription>
                    Please configure your Botpress workspace and bot settings before accessing sentiment analysis, feedbacks, learnings, intro entries, code/text entries, prompt management, or analytics
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
        </Suspense>
      </Layout>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContent />
        <Toaster position="top-center" />
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
