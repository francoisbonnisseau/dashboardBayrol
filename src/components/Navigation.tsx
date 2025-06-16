import { MessageCircle, Settings as SettingsIcon, BarChart3, LogOut, UserIcon, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { UserRole } from '@/contexts/AuthContext';

interface NavigationProps {
  activeView: 'conversations' | 'sentiment' | 'settings' | 'analysis';
  onViewChange: (view: 'conversations' | 'sentiment' | 'settings' | 'analysis') => void;
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
              <Button
                variant={activeView === 'conversations' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('conversations')}
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Conversations
              </Button>
              
              <Button
                variant={activeView === 'sentiment' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('sentiment')}
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Sentiment
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
