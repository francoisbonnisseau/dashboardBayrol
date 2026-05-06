import { MessageCircle, Settings as SettingsIcon, BarChart3, LogOut, Brain, BookOpen, FileText, FileCode2, MessageSquare, LineChart, FlaskConical, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { UserRole } from '@/contexts/AuthContext';
import type { DashboardView } from '@/types/views';

interface NavigationProps {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  userRole: UserRole;
  onLogout: () => void;
}

export default function Navigation({ activeView, onViewChange, userRole, onLogout }: NavigationProps) {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">      
      <div className="w-full px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Bayrol Dashboard</span>
            </div>            <div className="flex items-center space-x-1">
              {/* Conversations tab hidden per request (retain code for future use)
              <Button
                variant={activeView === 'conversations' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('conversations')}
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Conversations
              </Button> */}
              
              <Button
                variant={activeView === 'sentiment' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('sentiment')}
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Sentiment
              </Button>
              
              <Button
                variant={activeView === 'feedbacks' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('feedbacks')}
                className="flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Feedbacks
              </Button>
              
              <Button
                variant={activeView === 'learnings' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('learnings')}
                className="flex items-center gap-2"
              >
                <BookOpen className="h-4 w-4" />
                Learnings
              </Button>
              
              <Button
                variant={activeView === 'intro' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('intro')}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Intro
              </Button>

              <Button
                variant={activeView === 'codeText' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('codeText')}
                className="flex items-center gap-2"
              >
                <FileCode2 className="h-4 w-4" />
                Code Text
              </Button>
              
              <Button
                variant={activeView === 'analytics' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('analytics')}
                className="flex items-center gap-2"
              >
                <LineChart className="h-4 w-4" />
                Analytics
              </Button>
              
              {userRole === 'admin' && (
                <Button
                  variant={activeView === 'analysis' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewChange('analysis')}
                  className="flex items-center gap-2"
                >
                  <Brain className="h-4 w-4" />
                  Analysis
                </Button>
              )}

              <Button
                variant={activeView === 'testPrompts' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('testPrompts')}
                className="flex items-center gap-2"
              >
                <FlaskConical className="h-4 w-4" />
                Prompts
              </Button>

              <Button
                variant={activeView === 'testModels' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('testModels')}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Models
              </Button>
               
              <Button
                variant={activeView === 'settings' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('settings')}
                className="flex items-center gap-2"
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Button>
            </div>
          </div>
          
          {/* User info and logout */}
          <div className="flex items-center space-x-4">
            {userRole === 'admin' && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-medium">
                Admin
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={onLogout} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>  );
}
