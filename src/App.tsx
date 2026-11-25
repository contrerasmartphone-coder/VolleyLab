import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DialogProvider } from './context/DialogContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/common/Header';
import { AthleteList } from './components/athletes/AthleteList';
import { TrainingManager } from './components/trainings/TrainingManager';
import { ProgressDashboard } from './components/progress/ProgressDashboard';
import { MatchCalendar } from './components/matches/MatchCalendar';
import { UserManager } from './components/users/UserManager';
import { SettingsManager } from './components/settings/SettingsManager';
import { AthletePortal } from './components/dashboard/AthletePortal';
import { AthleteDetailModal } from './components/athletes/AthleteDetailModal';
import { LoginModal } from './components/auth/LoginModal';
import {
  subscribeAthletes,
  subscribeTrainings,
  subscribeMatches,
  subscribeToQuotaStatus,
  saveAthlete,
  deleteAthlete,
  saveTrainingSession,
  deleteTrainingSession,
  saveMatchEvent,
  deleteMatchEvent,
  saveUser,
  deleteUser,
  toggleTrainingRegistrationAtomic,
  setTrainingAbsenceAtomic,
  confirmMatchCallUpAtomic,
} from './lib/db';
import { Athlete, TrainingSession, MatchEvent, User } from './types';
import { Shield, AlertTriangle, X } from 'lucide-react';

function MainAppContent() {
  const { currentUser, allUsers: dbUsers, syncUsersList, isCoach, isStaff, isAthlete, updateUser, canManageAll } = useAuth();
  const canManage = isCoach || isStaff || Boolean(canManageAll);

  // Active Tab state
  const [activeTab, setActiveTab] = useState<'athletes' | 'trainings' | 'matches' | 'users' | 'settings' | 'my_portal'>('athletes');

  // Real-time Database State
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [trainings, setTrainings] = useState<TrainingSession[]>([]);
  const [matches, setMatches] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [dismissQuotaBanner, setDismissQuotaBanner] = useState(false);

  // Login Modal
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Selected athlete for modal view anywhere in app
  const [selectedAthleteModal, setSelectedAthleteModal] = useState<Athlete | null>(null);

  // Set default tab on role switch & guard restricted tabs
  useEffect(() => {
    if (currentUser?.role === 'athlete') {
      if (activeTab === 'athletes' || activeTab === 'users' || activeTab === 'settings') {
        setActiveTab('my_portal');
      }
    } else if (currentUser?.role === 'staff' || currentUser?.role === 'coach') {
      if (activeTab === 'my_portal') {
        setActiveTab('athletes');
      }
    }
  }, [currentUser?.role, activeTab]);

  // Monitor Firestore quota status for non-blocking offline/cache fallback banner
  useEffect(() => {
    return subscribeToQuotaStatus((exceeded) => {
      setQuotaExceeded(exceeded);
    });
  }, []);

  // Real-time Firestore Subscriptions (only active when user is authenticated)
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubAthletes = subscribeAthletes((data) => {
      setAthletes(data);
      setLoading(false);
    });

    const unsubTrainings = subscribeTrainings((data) => {
      setTrainings(data);
    });

    const unsubMatches = subscribeMatches((data) => {
      setMatches(data);
    });

    return () => {
      unsubAthletes();
      unsubTrainings();
      unsubMatches();
    };
  }, [currentUser?.id]);

  // Athlete matching current user if logged in as athlete
  const currentAthleteRecord =
    currentUser?.role === 'athlete' && currentUser.athleteId
      ? athletes.find((a) => a.id === currentUser.athleteId)
      : undefined;

  // Confirmed State Handlers + Persistence (commit UI state after Firestore confirms)
  const handleDeleteAthlete = async (athleteId: string) => {
    await deleteAthlete(athleteId);
    setSelectedAthleteModal((prev) => (prev?.id === athleteId ? null : prev));
    setAthletes((prev) => prev.filter((a) => a.id !== athleteId));
  };

  const handleSaveAthlete = async (athlete: Athlete) => {
    await saveAthlete(athlete);

    setAthletes((prev) => {
      const idx = prev.findIndex((a) => a.id === athlete.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = athlete;
        return copy;
      }
      return [athlete, ...prev];
    });
    setSelectedAthleteModal((prev) => (prev?.id === athlete.id ? athlete : prev));

    // Sync with linked user if any
    const linkedUser = dbUsers.find((u) => u.athleteId === athlete.id);
    if (linkedUser) {
      const updatedLinkedUser: User = {
        ...linkedUser,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        name: `${athlete.firstName} ${athlete.lastName}`,
        phone: athlete.phone || linkedUser.phone,
        email: athlete.email || linkedUser.email,
      };
      await saveUser(updatedLinkedUser);
      syncUsersList((prev) => prev.map((u) => (u.id === updatedLinkedUser.id ? updatedLinkedUser : u)));
      if (currentUser?.id === updatedLinkedUser.id) {
        await updateUser(updatedLinkedUser);
      }
    }
  };

  const applyTrainingInState = (training: TrainingSession) => {
    setTrainings((prev) => {
      const idx = prev.findIndex((t) => t.id === training.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = training;
        return copy;
      }
      return [training, ...prev];
    });
  };

  const handleDeleteTraining = async (trainingId: string) => {
    await deleteTrainingSession(trainingId);
    setTrainings((prev) => prev.filter((t) => t.id !== trainingId));
  };

  const handleSaveTraining = async (training: TrainingSession) => {
    await saveTrainingSession(training);
    applyTrainingInState(training);
  };

  const applyMatchInState = (match: MatchEvent) => {
    setMatches((prev) => {
      const idx = prev.findIndex((m) => m.id === match.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = match;
        return copy;
      }
      return [match, ...prev];
    });
  };

  const handleDeleteMatch = async (matchId: string) => {
    await deleteMatchEvent(matchId);
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
  };

  const handleSaveMatch = async (match: MatchEvent) => {
    await saveMatchEvent(match);
    applyMatchInState(match);
  };

  const handleDeleteUser = async (userId: string) => {
    await deleteUser(userId);
    syncUsersList((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleSaveUser = async (user: User) => {
    await saveUser(user);
    syncUsersList((prev) => {
      const idx = prev.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = user;
        return copy;
      }
      return [...prev, user];
    });
    if (currentUser?.id === user.id) {
      await updateUser(user);
    }

    // Sync with linked athlete if any
    if (user.athleteId) {
      const linkedAth = athletes.find((a) => a.id === user.athleteId);
      if (linkedAth) {
        const updatedAth: Athlete = {
          ...linkedAth,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone || linkedAth.phone,
          email: user.email || linkedAth.email,
        };
        await saveAthlete(updatedAth);
        setAthletes((prev) => prev.map((a) => (a.id === updatedAth.id ? updatedAth : a)));
        setSelectedAthleteModal((prev) => (prev?.id === updatedAth.id ? updatedAth : prev));
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-200 flex flex-col font-sans selection:bg-amber-500 selection:text-white">
      {/* App Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenLogin={() => setShowLoginModal(true)}
      />

      {/* Main Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {quotaExceeded && !dismissQuotaBanner && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start justify-between gap-3 text-xs text-amber-200 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-300">
                  Quota giornaliera di letture Firestore esaurita — Modalità cache locale attiva
                </p>
                <p className="text-amber-100/80 leading-relaxed">
                  Il database gratuito Firestore ha raggiunto il limite giornaliero di letture (&quot;Free daily read units&quot;). L&apos;app sta mostrando i dati salvati nella cache locale del dispositivo. La quota si azzera automaticamente domani.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissQuotaBanner(true)}
              className="p-1.5 text-amber-300/70 hover:text-amber-200 hover:bg-amber-500/20 rounded-lg transition-colors cursor-pointer shrink-0"
              aria-label="Chiudi avviso quota"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-400">
              Caricamento database societario su Firestore...
            </p>
          </div>
        ) : !currentUser ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 p-8 bg-[#11141d] border border-slate-800 rounded-3xl max-w-md mx-auto my-12 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/40">
              VL
            </div>
            <div>
              <h2 className="text-xl font-black text-white font-display">Autenticazione VolleyLab Richiesta</h2>
              <p className="text-xs text-slate-400 mt-1">
                L'accesso all'applicazione è riservato. Inserisci le credenziali societarie per visualizzare atleti, allenamenti e schede.
              </p>
            </div>
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              Inserisci Utente e Password
            </button>
          </div>
        ) : (
          <>
            {/* VIEW 1: ATHLETE LIST & DOSSIER (COACH & STAFF) */}
            {activeTab === 'athletes' && canManage && (
              <AthleteList
                athletes={athletes}
                trainings={trainings}
                onSaveAthlete={handleSaveAthlete}
                onDeleteAthlete={canManage ? handleDeleteAthlete : undefined}
                isCoach={canManage}
              />
            )}

            {activeTab === 'athletes' && !canManage && (
              <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-10 text-center max-w-md mx-auto space-y-3 shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white font-display">Accesso Riservato ad Allenatore e Staff Tecnico</h3>
                <p className="text-xs text-slate-400">
                  La sezione Atleti è momentaneamente riservata allo staff tecnico.
                </p>
                <button
                  onClick={() => setActiveTab('my_portal')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Torna al Portale Atleta
                </button>
              </div>
            )}

            {/* VIEW 2: TRAININGS & ATTENDANCE */}
            {activeTab === 'trainings' && (
              <TrainingManager
                trainings={trainings}
                athletes={athletes}
                currentUser={currentUser}
                onSaveTraining={handleSaveTraining}
                onSyncTrainingState={applyTrainingInState}
                onDeleteTraining={canManage ? handleDeleteTraining : undefined}
                isCoach={canManage}
              />
            )}


            {/* VIEW 4: MATCHES & CONVOCATIONS CALENDAR */}
            {activeTab === 'matches' && (
              <MatchCalendar
                matches={matches}
                athletes={athletes}
                currentUser={currentUser}
                onSaveMatch={handleSaveMatch}
                onSyncMatchState={applyMatchInState}
                onDeleteMatch={canManage ? handleDeleteMatch : undefined}
                isCoach={canManage}
              />
            )}

            {/* VIEW 5: USER CREDENTIALS TABLE (COACH & STAFF) */}
            {activeTab === 'users' && canManage && (
              <UserManager
                users={dbUsers}
                athletes={athletes}
                currentUser={currentUser}
                onSaveUser={handleSaveUser}
                onDeleteUser={handleDeleteUser}
                onSaveAthlete={handleSaveAthlete}
              />
            )}

            {activeTab === 'users' && !canManage && (
              <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-10 text-center max-w-md mx-auto space-y-3 shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white font-display">Accesso Riservato ad Allenatore e Staff Tecnico</h3>
                <p className="text-xs text-slate-400">
                  La gestione credenziali e configurazione account è riservata all'allenatore e allo staff tecnico.
                </p>
                <button
                  onClick={() => setActiveTab(isAthlete ? 'my_portal' : 'athletes')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Torna alla Dashboard
                </button>
              </div>
            )}

            {/* VIEW 6: SETTINGS & BACKUP/RESTORE (COACH & STAFF) */}
            {activeTab === 'settings' && canManage && (
              <SettingsManager
                athletes={athletes}
                trainings={trainings}
                matches={matches}
                users={dbUsers}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'settings' && !canManage && (
              <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-10 text-center max-w-md mx-auto space-y-3 shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white font-display">Accesso Riservato ad Allenatore e Staff Tecnico</h3>
                <p className="text-xs text-slate-400">
                  La gestione backup e sicurezza del database è riservata all'allenatore e allo staff tecnico.
                </p>
                <button
                  onClick={() => setActiveTab(isAthlete ? 'my_portal' : 'athletes')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Torna alla Dashboard
                </button>
              </div>
            )}

            {/* VIEW 7: DEDICATED ATHLETE PORTAL */}
            {activeTab === 'my_portal' && (
              <AthletePortal
                athlete={currentAthleteRecord}
                athletes={athletes}
                trainings={trainings}
                matches={matches}
                onToggleTrainingReg={async (t) => {
                  if (!currentAthleteRecord) return;
                  const updated = await toggleTrainingRegistrationAtomic(
                    t.id,
                    currentAthleteRecord.id
                  );
                  applyTrainingInState(updated);
                }}
                onToggleTrainingAbsence={async (t, reason) => {
                  if (!currentAthleteRecord) return;
                  const isAbsent = (t.absentAthletes || []).some(
                    (a) => a.athleteId === currentAthleteRecord.id
                  );
                  const updated = await setTrainingAbsenceAtomic(
                    t.id,
                    currentAthleteRecord.id,
                    !isAbsent,
                    reason
                  );
                  applyTrainingInState(updated);
                }}
                onConfirmMatchCallUp={async (m, status) => {
                  if (!currentAthleteRecord) return;
                  const updated = await confirmMatchCallUpAtomic(
                    m.id,
                    currentAthleteRecord.id,
                    status
                  );
                  applyMatchInState(updated);
                }}
                onOpenMyDetailModal={() => {
                  if (currentAthleteRecord) {
                    setSelectedAthleteModal(currentAthleteRecord);
                  }
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Global Athlete Detail Modal (when clicked from progress dashboard or portal) */}
      {selectedAthleteModal && (
        <AthleteDetailModal
          athlete={selectedAthleteModal}
          trainings={trainings}
          isOpen={Boolean(selectedAthleteModal)}
          onClose={() => setSelectedAthleteModal(null)}
          onSave={handleSaveAthlete}
          onDelete={canManage ? handleDeleteAthlete : undefined}
          isCoach={canManage}
        />
      )}

      {/* Login Modal */}
      {(!currentUser || showLoginModal) && (
        <LoginModal
          isOpen={!currentUser || showLoginModal}
          onClose={() => setShowLoginModal(false)}
          canDismiss={Boolean(currentUser)}
        />
      )}


    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DialogProvider>
          <MainAppContent />
        </DialogProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
