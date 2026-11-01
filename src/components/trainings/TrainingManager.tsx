import React, { useState } from 'react';
import { TrainingSession, Athlete, User, TrainingAttendee, TrainingDrill } from '../../types';
import { formatDate } from '../../lib/db';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Check,
  X,
  Sparkles,
  ClipboardList,
  Edit2,
  Trash2,
  ChevronRight,
  Shield,
  Star,
  Activity,
  Flame,
} from 'lucide-react';
import { useDialog } from '../../context/DialogContext';

interface TrainingManagerProps {
  trainings: TrainingSession[];
  athletes: Athlete[];
  currentUser: User | null;
  onSaveTraining: (training: TrainingSession) => Promise<void>;
  onDeleteTraining?: (trainingId: string) => Promise<void>;
  isCoach: boolean;
}

export const TrainingManager: React.FC<TrainingManagerProps> = ({
  trainings,
  athletes,
  currentUser,
  onSaveTraining,
  onDeleteTraining,
  isCoach,
}) => {
  const { confirm, showToast } = useDialog();
  const isStaff = currentUser?.role === 'staff';
  const canTakeAttendance = isCoach || isStaff;
  const isAthlete = currentUser?.role === 'athlete';
  const [filterStatus, setFilterStatus] = useState<'all' | 'programmato' | 'completato'>('all');
  const [selectedTraining, setSelectedTraining] = useState<TrainingSession | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTabModal, setActiveTabModal] = useState<'details' | 'drills' | 'attendance'>('attendance');

  // Form states for creating a new training
  const [newTraining, setNewTraining] = useState<Partial<TrainingSession>>({
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    startTime: '19:30',
    endTime: '21:30',
    location: 'Palazzetto dello Sport "PalaVolley" - Campo Principale',
    teamCategory: 'Serie C Maschile',
    title: '',
    objective: '',
    primaryFocus: 'Ricezione/Attacco',
    drills: [
      { id: 'dr-1', name: 'Riscaldamento & Prevenzione', durationMinutes: 15, description: 'Mobilità articolare ed elastici' },
      { id: 'dr-2', name: 'Esercizio Fondamentale', durationMinutes: 30, description: 'Lavoro tecnico a tema' },
      { id: 'dr-3', name: 'Sei contro Sei / Situazionale', durationMinutes: 45, description: 'Partita con regole vincolate' },
    ],
    coachNotes: '',
    registeredAthleteIds: [],
    attendees: [],
    status: 'programmato',
  });

  // Helper for current athlete's ID
  const currentAthleteId = currentUser?.role === 'athlete' ? currentUser.athleteId : null;

  // Filter trainings
  const filteredTrainings = trainings.filter((t) => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  // Handle Athlete Toggle Registration
  const handleToggleRegistration = async (training: TrainingSession) => {
    if (!currentAthleteId) return;

    const isRegistered = training.registeredAthleteIds?.includes(currentAthleteId);
    let updatedRegistered = training.registeredAthleteIds || [];

    if (isRegistered) {
      updatedRegistered = updatedRegistered.filter((id) => id !== currentAthleteId);
    } else {
      updatedRegistered = [...updatedRegistered, currentAthleteId];
    }

    const updatedTraining: TrainingSession = {
      ...training,
      registeredAthleteIds: updatedRegistered,
    };

    await onSaveTraining(updatedTraining);
    if (selectedTraining?.id === training.id) {
      setSelectedTraining(updatedTraining);
    }

    showToast({
      message: isRegistered ? 'Iscrizione sessione annullata' : 'Presenza segnata per l\'allenamento!',
      type: isRegistered ? 'info' : 'success',
    });
  };

  // Handle Coach marking attendance
  const handleUpdateAttendeeStatus = async (
    training: TrainingSession,
    athleteId: string,
    status: 'presente' | 'assente' | 'giustificato' | 'infortunato' | 'in_ritardo',
    performanceRating?: number,
    notes?: string
  ) => {
    const currentAttendees = [...(training.attendees || [])];
    const existingIndex = currentAttendees.findIndex((a) => a.athleteId === athleteId);

    const attendeeRecord: TrainingAttendee = {
      athleteId,
      status,
      performanceRating: performanceRating ?? (existingIndex >= 0 ? currentAttendees[existingIndex].performanceRating : undefined),
      coachNotes: notes ?? (existingIndex >= 0 ? currentAttendees[existingIndex].coachNotes : undefined),
      checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (existingIndex >= 0) {
      currentAttendees[existingIndex] = attendeeRecord;
    } else {
      currentAttendees.push(attendeeRecord);
    }

    const updatedTraining: TrainingSession = {
      ...training,
      attendees: currentAttendees,
    };

    await onSaveTraining(updatedTraining);
    if (selectedTraining?.id === training.id) {
      setSelectedTraining(updatedTraining);
    }

    showToast({
      message: `Presenza aggiornata (${status.toUpperCase()})`,
      type: 'info',
    });
  };

  // Handle Create Training Submit
  const handleCreateTrainingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTraining.title || !newTraining.date) return;

    const created: TrainingSession = {
      id: `train-${Date.now()}`,
      date: newTraining.date || new Date().toISOString().split('T')[0],
      startTime: newTraining.startTime || '19:30',
      endTime: newTraining.endTime || '21:30',
      location: newTraining.location || 'Palazzetto dello Sport',
      teamCategory: newTraining.teamCategory || 'Serie C Maschile',
      title: newTraining.title || 'Sessione Tecnica',
      objective: newTraining.objective || 'Perfezionamento schemi di gioco',
      primaryFocus: newTraining.primaryFocus || 'Ricezione/Attacco',
      drills: newTraining.drills || [],
      coachNotes: newTraining.coachNotes || '',
      registeredAthleteIds: [],
      attendees: [],
      status: 'programmato',
    };

    await onSaveTraining(created);
    showToast({
      message: `Nuova sessione di allenamento "${created.title}" programmata!`,
      type: 'success',
    });
    setShowAddModal(false);
    setSelectedTraining(created);
  };

  const getFocusBadgeColor = (focus: string) => {
    switch (focus) {
      case 'Ricezione/Attacco':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'Fase Break & Muro':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'Palleggio & Schemi':
        return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'Potenziamento Fisico':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'Partitella & Tattica':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-white font-display tracking-tight">
                Pianificazione Allenamenti & Registro Presenze
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
                {trainings.length} Sessioni
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isCoach
                ? 'Pianifica le sessioni settimanali, definisci gli obiettivi tecnici e compila il registro presenze'
                : 'Iscriviti alle prossime sessioni di allenamento e consulta gli obiettivi e gli esercizi previsti'}
            </p>
          </div>

          {isCoach && (
            <button
              id="create-training-button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-102"
            >
              <Plus className="w-4 h-4" />
              Pianifica Nuovo Allenamento
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterStatus === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#0b0e14] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Tutte le Sessioni ({trainings.length})
          </button>
          <button
            onClick={() => setFilterStatus('programmato')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterStatus === 'programmato'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#0b0e14] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            In Programma ({trainings.filter((t) => t.status === 'programmato').length})
          </button>
          <button
            onClick={() => setFilterStatus('completato')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterStatus === 'completato'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#0b0e14] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Completati ({trainings.filter((t) => t.status === 'completato').length})
          </button>
        </div>
      </div>

      {/* Trainings Grid */}
      {filteredTrainings.length === 0 ? (
        <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-12 text-center shadow-xl">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Nessuna sessione di allenamento</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Non ci sono allenamenti corrispondenti al filtro o il registro delle sessioni è vuoto.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredTrainings.map((session) => {
          const isRegistered = currentAthleteId ? session.registeredAthleteIds?.includes(currentAthleteId) : false;
          const attendeeRecord = currentAthleteId ? session.attendees?.find((a) => a.athleteId === currentAthleteId) : null;
          const registeredAthletes = athletes.filter((a) => session.registeredAthleteIds?.includes(a.id));
          const presentCount = session.attendees?.filter((a) => a.status === 'presente').length || 0;

          return (
            <div
              key={session.id}
              id={`training-card-${session.id}`}
              className="bg-[#11141d] border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition-all"
            >
              <div>
                {/* Header Date & Status */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-[#0b0e14] border border-slate-800 text-amber-400 font-mono text-xs font-bold">
                      {formatDate(session.date)}
                    </span>
                    <div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${getFocusBadgeColor(session.primaryFocus)}`}>
                        {session.primaryFocus}
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {session.startTime} - {session.endTime}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                      session.status === 'completato'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {session.status === 'completato' ? 'Completato' : 'In Programma'}
                  </span>
                </div>

                {/* Title & Objective */}
                <h3 className="text-base font-bold text-white mt-2 font-display">
                  {session.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                  {session.objective}
                </p>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-3">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{session.location}</span>
                </div>

                {/* Drills Preview */}
                {session.drills && session.drills.length > 0 && (
                  <div className="mt-3 p-3 bg-[#0b0e14]/80 rounded-2xl border border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center justify-between">
                      <span>Esercizi & Drills Programmati</span>
                      <span>{session.drills.reduce((acc, d) => acc + d.durationMinutes, 0)} min totali</span>
                    </span>
                    <div className="space-y-1">
                      {session.drills.map((d) => (
                        <div key={d.id} className="flex items-center justify-between text-xs text-slate-300">
                          <span className="truncate">• {d.name}</span>
                          <span className="text-[10px] text-slate-500 shrink-0 ml-2">{d.durationMinutes} min</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Registered Athletes List */}
                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">
                      Iscritti: <strong className="text-white">{registeredAthletes.length} atleti</strong>
                    </span>
                  </div>

                  {session.status === 'completato' && (
                    <span className="text-emerald-400 font-semibold text-[11px]">
                      ✓ {presentCount} Presenti Effettivi
                    </span>
                  )}
                </div>

                {/* Avatar stack */}
                {registeredAthletes.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 overflow-x-auto no-scrollbar py-1">
                    {registeredAthletes.slice(0, 8).map((ath) => (
                      <img
                        key={ath.id}
                        src={ath.photoUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80'}
                        alt={ath.lastName}
                        title={`#${ath.jerseyNumber} ${ath.firstName} ${ath.lastName}`}
                        className="w-6 h-6 rounded-md object-cover ring-1 ring-slate-700 shrink-0"
                      />
                    ))}
                    {registeredAthletes.length > 8 && (
                      <span className="text-[10px] font-bold text-slate-400 bg-[#0b0e14] px-1.5 py-0.5 rounded border border-slate-800">
                        +{registeredAthletes.length - 8}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                {/* Athlete 1-click registration toggle */}
                {isAthlete && (
                  <button
                    id={`toggle-reg-${session.id}`}
                    onClick={() => handleToggleRegistration(session)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      isRegistered
                        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                    }`}
                  >
                    {isRegistered ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        Iscritto (Clicca per annullare)
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Iscriviti all'Allenamento
                      </>
                    )}
                  </button>
                )}

                {/* Open Attendance & Management Modal */}
                <button
                  id={`open-training-modal-${session.id}`}
                  onClick={() => {
                    setSelectedTraining(session);
                    setActiveTabModal(canTakeAttendance ? 'attendance' : 'drills');
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border border-slate-700 bg-[#0b0e14] hover:bg-[#161b26] text-slate-200 transition-colors ${
                    canTakeAttendance ? 'flex-1' : ''
                  }`}
                >
                  <ClipboardList className="w-4 h-4 text-amber-400" />
                  {canTakeAttendance ? 'Gestisci Presenze & Dettagli' : 'Dettagli & Drills'}
                </button>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Selected Training Modal (Drills & Coach Attendance Register) */}
      {selectedTraining && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setSelectedTraining(null)}
        >
          <div
            id="training-attendance-modal"
            className="bg-[#11141d] border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-[#0b0e14] flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${getFocusBadgeColor(selectedTraining.primaryFocus)}`}>
                    {selectedTraining.primaryFocus}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {formatDate(selectedTraining.date)} • {selectedTraining.startTime} - {selectedTraining.endTime}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white font-display mt-1">
                  {selectedTraining.title}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{selectedTraining.location}</p>
              </div>

              <div className="flex items-center gap-2">
                {isCoach && onDeleteTraining && (
                  <button
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: 'Elimina Sessione di Allenamento',
                        message: `Sei sicuro di voler eliminare la sessione "${selectedTraining.title}" del ${formatDate(selectedTraining.date)}? L'operazione cancellerà tutti i dettagli e il registro presenze.`,
                        confirmText: 'Sì, Elimina Sessione',
                        cancelText: 'Annulla',
                        type: 'danger',
                      });
                      if (confirmed) {
                        await onDeleteTraining(selectedTraining.id);
                        showToast({
                          message: `Sessione "${selectedTraining.title}" eliminata`,
                          type: 'info',
                        });
                        setSelectedTraining(null);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                    title="Elimina allenamento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedTraining(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-[#161b26] rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs in Modal */}
            <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-800 bg-[#0b0e14]/60">
              {isCoach && (
                <button
                  onClick={() => setActiveTabModal('attendance')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTabModal === 'attendance'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Registro Presenze Effettive ({selectedTraining.attendees?.length || 0})
                </button>
              )}
              <button
                onClick={() => setActiveTabModal('drills')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTabModal === 'drills'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Esercizi & Scheda Tecnica ({selectedTraining.drills?.length || 0})
              </button>
              <button
                onClick={() => setActiveTabModal('details')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTabModal === 'details'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Atleti Iscritti ({selectedTraining.registeredAthleteIds?.length || 0})
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* TAB: ATTENDANCE REGISTER */}
              {activeTabModal === 'attendance' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Registro Presenze di Squadra</h3>
                      <p className="text-xs text-slate-400">
                        Clicca sullo stato per registrare la presenza o assenza di ogni atleta
                      </p>
                    </div>
                    {isCoach && (
                      <button
                        onClick={async () => {
                          const confirmed = await confirm({
                            title: 'Completa Sessione di Allenamento',
                            message: `Vuoi contrassegnare come completata la sessione "${selectedTraining.title}" registrando automaticamente i presenti?`,
                            confirmText: 'Sì, Completa Sessione',
                            cancelText: 'Annulla',
                            type: 'info',
                          });
                          if (!confirmed) return;

                          // Mark all registered as Present with one click
                          const updated = {
                            ...selectedTraining,
                            status: 'completato' as const,
                            attendees: athletes.map((a) => {
                              const isReg = selectedTraining.registeredAthleteIds?.includes(a.id);
                              return {
                                athleteId: a.id,
                                status: (a.status === 'infortunato' ? 'infortunato' : isReg ? 'presente' : 'assente') as any,
                                performanceRating: 4,
                              };
                            }),
                          };
                          await onSaveTraining(updated);
                          setSelectedTraining(updated);
                          showToast({
                            message: 'Sessione completata e presenze registrate!',
                            type: 'success',
                          });
                        }}
                        className="px-3 py-1.5 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold hover:bg-emerald-600/30 transition-colors cursor-pointer"
                      >
                        ✓ Segna Presenti & Completa Sessione
                      </button>
                    )}
                  </div>

                  <div className="bg-[#0b0e14] rounded-2xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#11141d] text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-3">Giocatore</th>
                          <th className="p-3">Iscritto</th>
                          <th className="p-3">Stato Presenza</th>
                          <th className="p-3">Valutazione Sessione</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {athletes.map((athlete) => {
                          const isRegistered = selectedTraining.registeredAthleteIds?.includes(athlete.id);
                          const attendee = selectedTraining.attendees?.find((a) => a.athleteId === athlete.id);
                          const currentStatus = attendee?.status || (isRegistered ? 'iscritto' : 'non_iscritto');

                          return (
                            <tr key={athlete.id} className="hover:bg-[#161b26] transition-colors">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded bg-[#11141d] text-amber-400 font-bold text-xs flex items-center justify-center border border-slate-800">
                                    #{athlete.jerseyNumber}
                                  </span>
                                  <img
                                    src={athlete.photoUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80'}
                                    alt={athlete.lastName}
                                    className="w-7 h-7 rounded-md object-cover"
                                  />
                                  <div>
                                    <span className="font-bold text-white block">
                                      {athlete.firstName} {athlete.lastName}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{athlete.role}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="p-3">
                                {isRegistered ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30">
                                    Iscritto
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[10px]">No</span>
                                )}
                              </td>

                              <td className="p-3">
                                {canTakeAttendance ? (
                                  <div className="flex items-center gap-1">
                                    {(['presente', 'assente', 'giustificato', 'infortunato'] as const).map((st) => (
                                      <button
                                        key={st}
                                        onClick={() => handleUpdateAttendeeStatus(selectedTraining, athlete.id, st)}
                                        className={`px-2 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${
                                          attendee?.status === st
                                            ? st === 'presente'
                                              ? 'bg-emerald-500 text-white font-black'
                                              : st === 'assente'
                                              ? 'bg-rose-500 text-white font-black'
                                              : st === 'giustificato'
                                              ? 'bg-amber-500 text-slate-950 font-black'
                                              : 'bg-purple-500 text-white font-black'
                                            : 'bg-[#11141d] text-slate-400 hover:text-white border border-slate-800'
                                        }`}
                                      >
                                        {st}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${
                                      attendee?.status === 'presente'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : attendee?.status === 'assente'
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {attendee?.status || 'In attesa'}
                                  </span>
                                )}
                              </td>

                              <td className="p-3">
                                {canTakeAttendance && attendee?.status === 'presente' ? (
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        key={star}
                                        onClick={() =>
                                          handleUpdateAttendeeStatus(
                                            selectedTraining,
                                            athlete.id,
                                            'presente',
                                            star
                                          )
                                        }
                                        className="text-slate-600 hover:text-amber-400 transition-colors"
                                      >
                                        <Star
                                          className={`w-3.5 h-3.5 ${
                                            (attendee?.performanceRating || 0) >= star
                                              ? 'text-amber-400 fill-amber-400'
                                              : ''
                                          }`}
                                        />
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-500 text-xs">
                                    {attendee?.performanceRating ? `${attendee.performanceRating}/5 ★` : '-'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: DRILLS & EXERCISES */}
              {activeTabModal === 'drills' && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">
                      Obiettivo Tecnico della Seduta
                    </span>
                    <p className="text-sm text-white font-medium">{selectedTraining.objective}</p>
                    {selectedTraining.coachNotes && (
                      <p className="text-xs text-slate-400 mt-2 italic bg-[#11141d] p-2.5 rounded-xl border border-slate-800">
                        <strong>Note Tecniche:</strong> {selectedTraining.coachNotes}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Sequenza Drills & Esercizi
                    </h4>
                    {selectedTraining.drills?.map((drill, index) => (
                      <div
                        key={drill.id}
                        className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 flex items-start gap-3"
                      >
                        <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-bold text-white">{drill.name}</h5>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-[#11141d] text-slate-300 rounded border border-slate-700">
                              {drill.durationMinutes} minuti
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{drill.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: REGISTERED ATHLETES */}
              {activeTabModal === 'details' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Atleti Iscritti tramite Dashboard ({selectedTraining.registeredAthleteIds?.length || 0})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {athletes
                      .filter((a) => selectedTraining.registeredAthleteIds?.includes(a.id))
                      .map((ath) => (
                        <div
                          key={ath.id}
                          className="p-3 bg-[#0b0e14] rounded-xl border border-slate-800 flex items-center gap-3"
                        >
                          <span className="w-7 h-7 rounded bg-[#11141d] text-amber-400 font-bold text-xs flex items-center justify-center border border-slate-800">
                            #{ath.jerseyNumber}
                          </span>
                          <img
                            src={ath.photoUrl}
                            alt={ath.lastName}
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                          <div>
                            <span className="font-bold text-white text-xs block truncate">
                              {ath.firstName} {ath.lastName}
                            </span>
                            <span className="text-[10px] text-slate-400">{ath.role}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add New Training Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowAddModal(false)}
        >
          <div
            id="add-training-modal"
            className="bg-[#11141d] border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                Pianifica Sessione di Allenamento
              </h2>
            </div>

            <form onSubmit={handleCreateTrainingSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-medium">Titolo Sessione *</label>
                  <input
                    type="text"
                    required
                    placeholder="es. Fase Ricezione-Punto & Transizione Attacco"
                    value={newTraining.title}
                    onChange={(e) => setNewTraining({ ...newTraining, title: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Data *</label>
                  <input
                    type="date"
                    required
                    value={newTraining.date}
                    onChange={(e) => setNewTraining({ ...newTraining, date: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Focus Tecnico *</label>
                  <select
                    value={newTraining.primaryFocus}
                    onChange={(e) => setNewTraining({ ...newTraining, primaryFocus: e.target.value as any })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Ricezione/Attacco">Ricezione / Attacco</option>
                    <option value="Fase Break & Muro">Fase Break & Muro</option>
                    <option value="Palleggio & Schemi">Palleggio & Schemi</option>
                    <option value="Potenziamento Fisico">Potenziamento Fisico</option>
                    <option value="Partitella & Tattica">Partitella & Tattica</option>
                    <option value="Battuta & Ricezione">Battuta & Ricezione</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Orario Inizio</label>
                  <input
                    type="time"
                    value={newTraining.startTime}
                    onChange={(e) => setNewTraining({ ...newTraining, startTime: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Orario Fine</label>
                  <input
                    type="time"
                    value={newTraining.endTime}
                    onChange={(e) => setNewTraining({ ...newTraining, endTime: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-medium">Luogo / Palestra</label>
                  <input
                    type="text"
                    value={newTraining.location}
                    onChange={(e) => setNewTraining({ ...newTraining, location: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-medium">Obiettivo Principale</label>
                  <textarea
                    rows={2}
                    placeholder="Descrivi l'obiettivo tecnico/tattico della seduta..."
                    value={newTraining.objective}
                    onChange={(e) => setNewTraining({ ...newTraining, objective: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Salva e Pianifica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
