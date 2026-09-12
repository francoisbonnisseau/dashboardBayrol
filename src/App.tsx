import { useState, useEffect, lazy, Suspense } from 'react';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './components/LoginPage';
import { EmptyState } from './components/dashboard/EmptyState';
import { LoadingState } from './components/dashboard/LoadingState';
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
        <Suspense fallback={<LoadingState variant="page" />}>
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
          <EmptyState title="Configuration Required" description="Configure your Botpress workspace and bot settings to get started." icon={<SettingsIcon />} action={<Button onClick={goToSettings}>Configure Settings</Button>} />
        )}
        {activeView === 'conversations' && !isConfigured && (
          <EmptyState title="Configuration Required" description="Configure your Botpress workspace and bot settings to get started." icon={<SettingsIcon />} action={<Button onClick={goToSettings}>Configure Settings</Button>} />
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
