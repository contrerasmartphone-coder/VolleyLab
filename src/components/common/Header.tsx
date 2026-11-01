import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Calendar,
  Activity,
  Trophy,
  UserCheck,
  LogOut,
  LogIn,
  ChevronDown,
  Shield,
  Award,
  Sparkles,
  KeyRound,
  CheckCircle,
  Briefcase,
} from 'lucide-react';
import { useDialog } from '../../context/DialogContext';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  onOpenLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, onOpenLogin }) => {
  const { currentUser, allUsers, isCoach, isStaff, isAthlete, switchUser, logout } = useAuth();
  const { confirm, showToast } = useDialog();
  const [showSwitchDropdown, setShowSwitchDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#user-profile-menu-button') && !target.closest('#user-dropdown-menu')) {
        setShowSwitchDropdown(false);
      }
    };
    if (showSwitchDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSwitchDropdown]);

  // Tabs configured strictly by role privileges
  const coachTabs = [
    { id: 'athletes', label: 'Atleti', icon: Users },
    { id: 'trainings', label: 'Allenamenti', icon: UserCheck },
    { id: 'matches', label: 'Calendario', icon: Calendar },
    { id: 'users', label: 'Gestione Utenti', icon: KeyRound },
  ];

  const staffTabs = [
    { id: 'athletes', label: 'Atleti', icon: Users },
    { id: 'trainings', label: 'Allenamenti', icon: UserCheck },
    { id: 'matches', label: 'Calendario', icon: Calendar },
  ];

  const athleteTabs = [
    { id: 'my_portal', label: 'Il Mio Portale Atleta', icon: Trophy },
    { id: 'trainings', label: 'Allenamenti', icon: UserCheck },
    { id: 'matches', label: 'Calendario', icon: Calendar },
    { id: 'athletes', label: 'Atleti', icon: Users },
  ];

  const currentTabs = isCoach ? coachTabs : isStaff ? staffTabs : athleteTabs;

  return (
    <header className="bg-[#0b0e14]/95 border-b border-slate-800 sticky top-0 z-40 shadow-2xl backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-xl tracking-wider ring-1 ring-amber-400/40">
              VL
            </div>
            <span className="font-black text-xl text-white font-display tracking-tight">
              VolleyLab
            </span>
          </div>

          {/* Active Profile */}
          <div className="flex items-center gap-2">
            {currentUser ? (
              <div className="relative">
                <button
                  id="user-profile-menu-button"
                  onClick={() => setShowSwitchDropdown(!showSwitchDropdown)}
                  className="flex items-center gap-2.5 p-1.5 pr-3 bg-[#11141d] hover:bg-[#161b26] border border-slate-800 hover:border-slate-700 rounded-2xl transition-all shadow-md"
                >
                  <img
                    src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-700"
                  />
                  <div className="text-left hidden sm:block">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-200">{currentUser.name}</span>
                      {currentUser.role === 'coach' && (
                        <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                          Coach
                        </span>
                      )}
                      {currentUser.role === 'staff' && (
                        <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded">
                          Staff
                        </span>
                      )}
                      {currentUser.role === 'athlete' && (
                        <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded">
                          Atleta
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate max-w-[130px]">
                      @{currentUser.username}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {showSwitchDropdown && (
                  <div
                    id="user-dropdown-menu"
                    className="absolute right-0 mt-2 w-64 bg-[#11141d] border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3.5 py-2.5 border-b border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Account Connesso
                      </p>
                      <p className="text-sm font-bold text-white mt-0.5 flex items-center justify-between">
                        <span>{currentUser.name}</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                          {currentUser.role}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">@{currentUser.username}</p>
                    </div>

                    <div className="pt-2 px-2">
                      <button
                        id="logout-button"
                        onClick={async () => {
                          const confirmed = await confirm({
                            title: 'Disconnessione Utente',
                            message: `Sei sicuro di voler effettuare il logout dall'account di ${currentUser.name}? Sarà necessario reinserire username e password.`,
                            confirmText: 'Sì, Esci',
                            cancelText: 'Rimani connesso',
                            type: 'warning',
                          });
                          if (confirmed) {
                            logout();
                            setShowSwitchDropdown(false);
                            showToast({
                              message: 'Sessione utente chiusa',
                              type: 'info',
                            });
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                        title="Logout"
                      >
                        <LogOut className="w-4 h-4" />
                        Disconnetti Account
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                id="login-header-button"
                onClick={onOpenLogin}
                className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                Accedi con Password
              </button>
            )}
          </div>
        </div>

        {/* Simplified Navigation Tabs */}
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar py-2.5 border-t border-slate-800/80">
          {currentTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#11141d] hover:border hover:border-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
