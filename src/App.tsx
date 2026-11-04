import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DialogProvider } from './context/DialogContext';
import { Header } from './components/common/Header';
import { AthleteList } from './components/athletes/AthleteList';
import { TrainingManager } from './components/trainings/TrainingManager';
import { ProgressDashboard } from './components/progress/ProgressDashboard';
import { MatchCalendar } from './components/matches/MatchCalendar';
import { UserManager } from './components/users/UserManager';
import { AthletePortal } from './components/dashboard/AthletePortal';
import { AthleteDetailModal } from './components/athletes/AthleteDetailModal';
import { LoginModal } from './components/auth/LoginModal';
import {
  subscribeAthletes,
  subscribeTrainings,
  subscribeMatches,
  subscribeUsers,
  saveAthlete,
  deleteAthlete,
  saveTrainingSession,
  deleteTrainingSession,
  saveMatchEvent,
  deleteMatchEvent,
  saveUser,
  deleteUser,
  seedInitialDataIfEmpty,
} from './lib/db';
import { Athlete, TrainingSession, MatchEvent, User } from './types';
import { Shield, Sparkles, Activity, Trophy, Calendar, Users, HeartPulse, Zap } from 'lucide-react';

function MainAppContent() {
  const { currentUser, isCoach, isStaff, isAthlete, updateUser, canManageAll } = useAuth();
  const canManage = isCoach || isStaff || Boolean(canManageAll);

  // Active Tab state
  const [activeTab, setActiveTab] = useState<'athletes' | 'trainings' | 'matches' | 'users' | 'my_portal'>('athletes');

  // Real-time Database State
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [trainings, setTrainings] = useState<TrainingSession[]>([]);
  const [matches, setMatches] = useState<MatchEvent[]>([]);
  const [dbUsers, setDbUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Login Modal
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Selected athlete for modal view anywhere in app
  const [selectedAthleteModal, setSelectedAthleteModal] = useState<Athlete | null>(null);

  // Set default tab on role switch
  useEffect(() => {
    if (currentUser?.role === 'athlete') {
      setActiveTab('my_portal');
    } else if (currentUser?.role === 'staff' || currentUser?.role === 'coach') {
      if (activeTab === 'my_portal') {
        setActiveTab('athletes');
      }
    }
  }, [currentUser?.role]);

  // Real-time Firestore Subscriptions & Initial Seed
  useEffect(() => {
    let unsubAthletes: () => void;
    let unsubTrainings: () => void;
    let unsubMatches: () => void;
    let unsubUsers: () => void;

    async function initDb() {
      await seedInitialDataIfEmpty();

      unsubAthletes = subscribeAthletes((data) => {
        setAthletes(data);
        setLoading(false);
      });

      unsubTrainings = subscribeTrainings((data) => {
        setTrainings(data);
      });

      unsubMatches = subscribeMatches((data) => {
        setMatches(data);
      });

      unsubUsers = subscribeUsers((data) => {
        setDbUsers(data);
      });
    }

    initDb();

    return () => {
      if (unsubAthletes) unsubAthletes();
      if (unsubTrainings) unsubTrainings();
      if (unsubMatches) unsubMatches();
      if (unsubUsers) unsubUsers();
    };
  }, []);

  // Athlete matching current user if logged in as athlete
  const currentAthleteRecord =
    currentUser?.role === 'athlete' && currentUser.athleteId
      ? athletes.find((a) => a.id === currentUser.athleteId)
      : undefined;

  // Immediate State Handlers + Persistence
  const handleDeleteAthlete = async (athleteId: string) => {
    setSelectedAthleteModal(null);
    setAthletes((prev) => prev.filter((a) => a.id !== athleteId));
    await deleteAthlete(athleteId);
  };

  const handleSaveAthlete = async (athlete: Athlete) => {
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
      setDbUsers((prev) => prev.map((u) => (u.id === updatedLinkedUser.id ? updatedLinkedUser : u)));
      await saveUser(updatedLinkedUser);
      if (currentUser?.id === updatedLinkedUser.id) {
        await updateUser(updatedLinkedUser);
      }
    }

    setAthletes((prev) => {
      const idx = prev.findIndex((a) => a.id === athlete.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = athlete;
        return copy;
      }
      return [athlete, ...prev];
    });
    if (selectedAthleteModal?.id === athlete.id) {
      setSelectedAthleteModal(athlete);
    }
    await saveAthlete(athlete);
  };

  const handleDeleteTraining = async (trainingId: string) => {
    setTrainings((prev) => prev.filter((t) => t.id !== trainingId));
    await deleteTrainingSession(trainingId);
  };

  const handleSaveTraining = async (training: TrainingSession) => {
    setTrainings((prev) => {
      const idx = prev.findIndex((t) => t.id === training.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = training;
        return copy;
      }
      return [training, ...prev];
    });
    await saveTrainingSession(training);
  };

  const handleDeleteMatch = async (matchId: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    await deleteMatchEvent(matchId);
  };

  const handleSaveMatch = async (match: MatchEvent) => {
    setMatches((prev) => {
      const idx = prev.findIndex((m) => m.id === match.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = match;
        return copy;
      }
      return [match, ...prev];
    });
    await saveMatchEvent(match);
  };

  const handleDeleteUser = async (userId: string) => {
    setDbUsers((prev) => prev.filter((u) => u.id !== userId));
    await deleteUser(userId);
  };

  const handleSaveUser = async (user: User) => {
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
        setAthletes((prev) => prev.map((a) => (a.id === updatedAth.id ? updatedAth : a)));
        if (selectedAthleteModal?.id === updatedAth.id) {
          setSelectedAthleteModal(updatedAth);
        }
        await saveAthlete(updatedAth);
      }
    }

    setDbUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = user;
        return copy;
      }
      return [...prev, user];
    });
    await saveUser(user);
    if (currentUser?.id === user.id) {
      await updateUser(user);
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
            {/* VIEW 1: ATHLETE LIST & DOSSIER */}
            {activeTab === 'athletes' && (
              <AthleteList
                athletes={athletes}
                trainings={trainings}
                onSaveAthlete={handleSaveAthlete}
                onDeleteAthlete={canManage ? handleDeleteAthlete : undefined}
                isCoach={canManage}
              />
            )}

            {/* VIEW 2: TRAININGS & ATTENDANCE */}
            {activeTab === 'trainings' && (
              <TrainingManager
                trainings={trainings}
                athletes={athletes}
                currentUser={currentUser}
                onSaveTraining={handleSaveTraining}
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

            {/* VIEW 6: DEDICATED ATHLETE PORTAL */}
            {activeTab === 'my_portal' && (
              <AthletePortal
                athlete={currentAthleteRecord}
                trainings={trainings}
                matches={matches}
                onToggleTrainingReg={async (t) => {
                  if (!currentAthleteRecord) return;
                  const isReg = t.registeredAthleteIds?.includes(currentAthleteRecord.id);
                  let updated = t.registeredAthleteIds || [];
                  if (isReg) {
                    updated = updated.filter((id) => id !== currentAthleteRecord.id);
                  } else {
                    updated = [...updated, currentAthleteRecord.id];
                  }
                  await saveTrainingSession({ ...t, registeredAthleteIds: updated });
                }}
                onConfirmMatchCallUp={async (m, status) => {
                  if (!currentAthleteRecord) return;
                  const currentCallUps = [...(m.convocati || [])];
                  const idx = currentCallUps.findIndex((c) => c.athleteId === currentAthleteRecord.id);
                  if (idx >= 0) {
                    currentCallUps[idx] = {
                      ...currentCallUps[idx],
                      confirmed: status,
                      respondedAt: new Date().toISOString(),
                    };
                  }
                  await saveMatchEvent({ ...m, convocati: currentCallUps });
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
    <AuthProvider>
      <DialogProvider>
        <MainAppContent />
      </DialogProvider>
    </AuthProvider>
  );
}
