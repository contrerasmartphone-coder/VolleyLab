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

export const STANDARD_GYMS = [
  'Palestra Scuola ICS Cruillas - Plesso Mendelssohn',
  'Palestra Scuola Leonardo Da Vinci',
];

export function calculateDurationMinutes(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  return endMinutes - startMinutes;
}

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
  const canManage = isCoach || isStaff;
  const canTakeAttendance = canManage;
  const isAthlete = currentUser?.role === 'athlete';
  const [filterStatus, setFilterStatus] = useState<'all' | 'programmato' | 'completato'>('all');
  const [selectedTraining, setSelectedTraining] = useState<TrainingSession | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTrainingId, setEditingTrainingId] = useState<string | null>(null);
  const [activeTabModal, setActiveTabModal] = useState<'details' | 'drills' | 'attendance'>('attendance');

  // Form states for creating / editing a training session
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    gymSelection: '',
    customGym: '',
    teamCategory: 'Serie C Maschile',
    title: '',
    objective: '',
    primaryFocus: 'Ricezione/Attacco' as TrainingSession['primaryFocus'],
    coachNotes: '',
    drills: [] as TrainingDrill[],
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

  // Open Create Training Modal
  const handleOpenCreateModal = () => {
    setEditingTrainingId(null);
    setFormData({
      date: '',
      startTime: '',
      endTime: '',
      gymSelection: '',
      customGym: '',
      teamCategory: 'Serie C Maschile',
      title: '',
      objective: '',
      primaryFocus: 'Ricezione/Attacco',
      coachNotes: '',
      drills: [],
    });
    setIsFormModalOpen(true);
  };

  // Open Edit Training Modal
  const handleOpenEditModal = (training: TrainingSession) => {
    setEditingTrainingId(training.id);
    const isStandard = STANDARD_GYMS.includes(training.location);
    setFormData({
      date: training.date,
      startTime: training.startTime,
      endTime: training.endTime,
      gymSelection: isStandard ? training.location : 'altro',
      customGym: isStandard ? '' : training.location,
      teamCategory: training.teamCategory || 'Serie C Maschile',
      title: training.title,
      objective: training.objective,
      primaryFocus: training.primaryFocus,
      coachNotes: training.coachNotes || '',
      drills: training.drills && training.drills.length > 0
        ? training.drills.map((d) => ({ ...d }))
        : [],
    });
    setIsFormModalOpen(true);
  };

  // Drill helpers in form
  const handleAddDrill = () => {
    const currentTotal = formData.drills.reduce((sum, d) => sum + (Number(d.durationMinutes) || 0), 0);
    const totalDuration = calculateDurationMinutes(formData.startTime, formData.endTime);
    const remaining = Math.max(0, totalDuration - currentTotal);
    const newDrill: TrainingDrill = {
      id: `dr-${Date.now()}-${formData.drills.length + 1}`,
      name: '',
      durationMinutes: remaining > 0 ? remaining : 15,
      description: '',
    };
    setFormData((prev) => ({
      ...prev,
      drills: [...prev.drills, newDrill],
    }));
  };

  const handleUpdateDrill = (index: number, field: keyof TrainingDrill, value: any) => {
    setFormData((prev) => {
      const updated = [...prev.drills];
      updated[index] = {
        ...updated[index],
        [field]: field === 'durationMinutes' ? (value === '' ? '' : Math.max(0, Number(value))) : value,
      };
      return { ...prev, drills: updated };
    });
  };

  const handleRemoveDrill = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      drills: prev.drills.filter((_, i) => i !== index),
    }));
  };

  const handleAutoFitRemaining = () => {
    const totalDuration = calculateDurationMinutes(formData.startTime, formData.endTime);
    if (formData.drills.length === 0 || totalDuration <= 0) return;
    const currentOthers = formData.drills.slice(0, -1).reduce((sum, d) => sum + (Number(d.durationMinutes) || 0), 0);
    const fittedDuration = Math.max(1, totalDuration - currentOthers);
    setFormData((prev) => {
      const updated = [...prev.drills];
      const lastIdx = updated.length - 1;
      updated[lastIdx] = {
        ...updated[lastIdx],
        durationMinutes: fittedDuration,
      };
      return { ...prev, drills: updated };
    });
  };

  // Handle Form Submit (Create or Edit) with strict duration saturation validation
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.date) {
      showToast({ message: 'Inserisci il titolo e la data della sessione.', type: 'error' });
      return;
    }

    if (!formData.gymSelection) {
      showToast({ message: 'Seleziona una palestra per la sessione.', type: 'error' });
      return;
    }

    if (formData.gymSelection === 'altro' && !formData.customGym.trim()) {
      showToast({ message: 'Specifica la palestra o sede dell\'allenamento fuori sede.', type: 'error' });
      return;
    }

    const totalDuration = calculateDurationMinutes(formData.startTime, formData.endTime);
    if (totalDuration <= 0) {
      showToast({
        message: 'L\'orario di fine deve essere successivo all\'orario di inizio.',
        type: 'error',
      });
      return;
    }

    if (formData.drills.length === 0) {
      showToast({
        message: 'Inserisci almeno un esercizio nella scheda dell\'allenamento.',
        type: 'error',
      });
      return;
    }

    const hasEmptyName = formData.drills.some((d) => !d.name.trim());
    if (hasEmptyName) {
      showToast({
        message: 'Tutti gli esercizi devono avere un nome valido specificato.',
        type: 'error',
      });
      return;
    }

    const hasZeroDuration = formData.drills.some((d) => Number(d.durationMinutes) <= 0);
    if (hasZeroDuration) {
      showToast({
        message: 'La durata di ciascun esercizio deve essere di almeno 1 minuto.',
        type: 'error',
      });
      return;
    }

    const totalDrillsMinutes = formData.drills.reduce(
      (sum, d) => sum + (Number(d.durationMinutes) || 0),
      0
    );

    if (totalDrillsMinutes !== totalDuration) {
      const diff = totalDuration - totalDrillsMinutes;
      showToast({
        message: diff > 0
          ? `La somma degli esercizi (${totalDrillsMinutes} min) non satura la durata dell'allenamento (${totalDuration} min). Mancano ancora ${diff} minuti.`
          : `La somma degli esercizi (${totalDrillsMinutes} min) supera la durata dell'allenamento (${totalDuration} min) di ${Math.abs(diff)} minuti.`,
        type: 'error',
      });
      return;
    }

    const location = formData.gymSelection === 'altro'
      ? (formData.customGym.trim() || 'Palestra Fuori Sede')
      : formData.gymSelection;

    const normalizedDrills: TrainingDrill[] = formData.drills.map((d, idx) => ({
      id: d.id || `dr-${Date.now()}-${idx + 1}`,
      name: d.name.trim(),
      durationMinutes: Number(d.durationMinutes),
      description: d.description?.trim() || '',
    }));

    if (editingTrainingId) {
      const existing = trainings.find((t) => t.id === editingTrainingId);
      if (!existing) return;
      const updated: TrainingSession = {
        ...existing,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        location,
        teamCategory: formData.teamCategory,
        title: formData.title.trim(),
        objective: formData.objective.trim() || 'Sessione Tecnica',
        primaryFocus: formData.primaryFocus,
        coachNotes: formData.coachNotes.trim(),
        drills: normalizedDrills,
      };

      await onSaveTraining(updated);
      if (selectedTraining?.id === editingTrainingId) {
        setSelectedTraining(updated);
      }
      showToast({
        message: `Sessione "${updated.title}" aggiornata con successo!`,
        type: 'success',
      });
    } else {
      const created: TrainingSession = {
        id: `train-${Date.now()}`,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        location,
        teamCategory: formData.teamCategory,
        title: formData.title.trim(),
        objective: formData.objective.trim() || 'Sessione Tecnica',
        primaryFocus: formData.primaryFocus,
        drills: normalizedDrills,
        coachNotes: formData.coachNotes.trim(),
        registeredAthleteIds: [],
        attendees: [],
        status: 'programmato',
      };

      await onSaveTraining(created);
      setSelectedTraining(created);
      showToast({
        message: `Nuova sessione "${created.title}" programmata!`,
        type: 'success',
      });
    }

    setIsFormModalOpen(false);
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
                Pianificazione Allenamenti
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
                {trainings.length === 1 ? '1 Sessione' : `${trainings.length} Sessioni`}
              </span>
            </div>
          </div>

          {canManage && (
            <button
              id="create-training-button"
              onClick={handleOpenCreateModal}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-102"
            >
              <Plus className="w-4 h-4" />
              Nuovo Allenamento
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
          <h3 className="text-base font-bold text-white">Nessun allenamento trovato</h3>
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

                {/* Title */}
                <h3 className="text-base font-bold text-white mt-2 font-display">
                  {session.title}
                </h3>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-3">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{session.location}</span>
                </div>

                {/* Drills Preview */}
                {session.drills && session.drills.length > 0 && (
                  <div className="mt-3 p-3 bg-[#0b0e14]/80 rounded-2xl border border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center justify-between">
                      <span>ESERCIZI PROGRAMMATI</span>
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
                  Dettagli
                </button>

                {/* Edit & Delete Buttons for Coach & Staff */}
                {canManage && (
                  <>
                    <button
                      id={`edit-training-btn-${session.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(session);
                      }}
                      className="p-2 text-slate-400 hover:text-amber-400 hover:bg-[#161b26] border border-slate-700 rounded-xl transition-colors cursor-pointer"
                      title="Modifica allenamento ed esercizi"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {onDeleteTraining && (
                      <button
                        id={`delete-training-btn-${session.id}`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          const confirmed = await confirm({
                            title: 'Elimina Sessione di Allenamento',
                            message: `Sei sicuro di voler eliminare la sessione "${session.title || 'Allenamento'}" del ${formatDate(session.date)}? L'operazione cancellerà tutti i dettagli e il registro presenze.`,
                            confirmText: 'Sì, Elimina Sessione',
                            cancelText: 'Annulla',
                            type: 'danger',
                          });
                          if (confirmed) {
                            await onDeleteTraining(session.id);
                            showToast({
                              message: `Sessione "${session.title || 'Allenamento'}" eliminata`,
                              type: 'info',
                            });
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-700 rounded-xl transition-colors cursor-pointer"
                        title="Elimina allenamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
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
                {canManage && (
                  <button
                    id="edit-modal-training-btn"
                    onClick={() => handleOpenEditModal(selectedTraining)}
                    className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-950/30 rounded-xl transition-colors cursor-pointer"
                    title="Modifica allenamento ed esercizi"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {canManage && onDeleteTraining && (
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
              {canManage && (
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
                    </div>
                    {canManage && (
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Sequenza Drills & Esercizi
                        </h4>
                        {(() => {
                          const totalSessionDuration = calculateDurationMinutes(selectedTraining.startTime, selectedTraining.endTime);
                          const totalDrillsMinutes = selectedTraining.drills?.reduce((acc, d) => acc + (d.durationMinutes || 0), 0) || 0;
                          return (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {totalDrillsMinutes} / {totalSessionDuration} min totali
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {selectedTraining.drills && selectedTraining.drills.length > 0 ? (
                      selectedTraining.drills.map((drill, index) => (
                        <div
                          key={drill.id || index}
                          className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 flex items-start gap-3"
                        >
                          <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-bold text-white">{drill.name}</h5>
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-[#11141d] text-amber-400 rounded border border-slate-700">
                                {drill.durationMinutes} min
                              </span>
                            </div>
                            {drill.description && (
                              <p className="text-xs text-slate-300 mt-1">{drill.description}</p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
                        Nessun esercizio presente in questa seduta.
                      </div>
                    )}
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

      {/* Create / Edit Training Modal */}
      {isFormModalOpen && (() => {
        const sessionDuration = calculateDurationMinutes(formData.startTime, formData.endTime);
        const drillsTotalMinutes = formData.drills.reduce((sum, d) => sum + (Number(d.durationMinutes) || 0), 0);
        const remainingMinutes = sessionDuration - drillsTotalMinutes;
        const isSaturated = sessionDuration > 0 && drillsTotalMinutes === sessionDuration;

        return (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setIsFormModalOpen(false)}
          >
            <div
              id="training-form-modal"
              className="bg-[#11141d] border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    {editingTrainingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white font-display">
                      {editingTrainingId ? 'Modifica Sessione di Allenamento' : 'Pianifica Sessione di Allenamento'}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1 font-medium">Titolo Sessione *</label>
                    <input
                      type="text"
                      required
                      placeholder="es. Fase Ricezione-Punto & Transizione Attacco"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Data *</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Focus Tecnico *</label>
                    <select
                      value={formData.primaryFocus}
                      onChange={(e) => setFormData({ ...formData, primaryFocus: e.target.value as any })}
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
                    <label className="block text-slate-400 mb-1 font-medium">Orario Inizio *</label>
                    <input
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Orario Fine *</label>
                    <input
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Palestra Dropdown & Free Text */}
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1 font-medium">Palestra *</label>
                    <select
                      value={formData.gymSelection}
                      onChange={(e) => setFormData({ ...formData, gymSelection: e.target.value })}
                      className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="" disabled>-- Seleziona Palestra --</option>
                      {STANDARD_GYMS.map((gym) => (
                        <option key={gym} value={gym}>
                          {gym}
                        </option>
                      ))}
                      <option value="altro">Altro / Fuori sede (Scrivi liberamente la palestra)</option>
                    </select>

                    {formData.gymSelection === 'altro' && (
                      <div className="mt-2.5">
                        <label className="block text-amber-400 text-[11px] font-semibold mb-1">
                          Specifica Palestra Fuori Sede:
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="es. PalaDonBosco - Via San Domenico Savio, Palermo"
                          value={formData.customGym}
                          onChange={(e) => setFormData({ ...formData, customGym: e.target.value })}
                          className="w-full bg-[#0b0e14] border border-amber-500/50 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1 font-medium">Obiettivo Principale</label>
                    <textarea
                      rows={2}
                      placeholder="Descrivi l'obiettivo tecnico/tattico della seduta..."
                      value={formData.objective}
                      onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                      className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1 font-medium">Note</label>
                    <input
                      type="text"
                      placeholder="es. Portare scarpe pulite e protezioni"
                      value={formData.coachNotes}
                      onChange={(e) => setFormData({ ...formData, coachNotes: e.target.value })}
                      className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* ESERCIZI A SATURAZIONE DURATA */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0b0e14] p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-white">
                        SCHEDA ESERCIZI
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          isSaturated
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : remainingMinutes > 0
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {isSaturated
                          ? `✓ Durata Saturata (${drillsTotalMinutes}/${sessionDuration} min)`
                          : remainingMinutes > 0
                          ? `Mancano ${remainingMinutes} min (${drillsTotalMinutes}/${sessionDuration} min)`
                          : `Superata di ${Math.abs(remainingMinutes)} min (${drillsTotalMinutes}/${sessionDuration} min)`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {formData.drills.length > 0 && remainingMinutes !== 0 && sessionDuration > 0 && (
                        <button
                          type="button"
                          onClick={handleAutoFitRemaining}
                          className="px-2.5 py-1.5 text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl transition-colors cursor-pointer"
                          title="Regola automaticamente la durata dell'ultimo esercizio per saturare la sessione"
                        >
                          Adatta ultimo a {sessionDuration}m
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleAddDrill}
                        className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-amber-400" />
                        Nuovo Esercizio
                      </button>
                    </div>
                  </div>

                  {/* Elenco Esercizi (senza doppio scroll) */}
                  <div className="space-y-2.5">
                    {formData.drills.map((drill, index) => (
                      <div
                        key={drill.id || index}
                        className="p-3 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-2 group hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            required
                            placeholder="Nome esercizio (es. Correlazione Muro - Difesa)"
                            value={drill.name}
                            onChange={(e) => handleUpdateDrill(index, 'name', e.target.value)}
                            className="flex-1 bg-[#11141d] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min="1"
                              required
                              placeholder="Min"
                              value={drill.durationMinutes === 0 ? '' : drill.durationMinutes}
                              onChange={(e) => handleUpdateDrill(index, 'durationMinutes', e.target.value)}
                              className="w-18 bg-[#11141d] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-center text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                            />
                            <span className="text-[11px] text-slate-400 font-medium">min</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDrill(index)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                            title="Rimuovi esercizio"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <input
                          type="text"
                          placeholder="Dettagli / indicazioni operative dell'esercizio (es. rotazioni vincolate, target sui 3 metri)"
                          value={drill.description || ''}
                          onChange={(e) => handleUpdateDrill(index, 'description', e.target.value)}
                          className="w-full bg-[#11141d] border border-slate-800/80 rounded-xl px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-700"
                        />
                      </div>
                    ))}

                    {/* Tasto nuovo esercizio sotto l'ultimo esercizio con conteggio minuti */}
                    {formData.drills.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAddDrill}
                        className="w-full py-2.5 px-4 text-xs font-bold bg-[#161b26] hover:bg-slate-800 text-amber-400 hover:text-amber-300 border border-dashed border-slate-800 hover:border-amber-500/40 rounded-2xl flex items-center justify-between transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                          <span>Nuovo Esercizio</span>
                        </div>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                            isSaturated
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : remainingMinutes > 0
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {isSaturated
                            ? `✓ Durata Saturata (${drillsTotalMinutes}/${sessionDuration} min)`
                            : remainingMinutes > 0
                            ? `Mancano ${remainingMinutes} min (${drillsTotalMinutes}/${sessionDuration} min)`
                            : `Superata di ${Math.abs(remainingMinutes)} min (${drillsTotalMinutes}/${sessionDuration} min)`}
                        </span>
                      </button>
                    )}

                    {formData.drills.length === 0 && (
                      <button
                        type="button"
                        onClick={handleAddDrill}
                        className="w-full p-3.5 px-4 border border-dashed border-slate-800 hover:border-amber-500/40 rounded-2xl text-slate-400 hover:text-amber-400 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 transition-colors cursor-pointer bg-[#0b0e14]/50 group"
                      >
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                          <span>Nessun esercizio inserito. Clicca per aggiungere il primo esercizio.</span>
                        </div>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                            isSaturated
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : remainingMinutes > 0
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {isSaturated
                            ? `✓ Durata Saturata (${drillsTotalMinutes}/${sessionDuration} min)`
                            : remainingMinutes > 0
                            ? `Mancano ${remainingMinutes} min (${drillsTotalMinutes}/${sessionDuration} min)`
                            : `Superata di ${Math.abs(remainingMinutes)} min (${drillsTotalMinutes}/${sessionDuration} min)`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Footer / Submit */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 shrink-0">
                  <div className="text-xs">
                    {!isSaturated && sessionDuration > 0 && (
                      <span className="text-rose-400 font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {remainingMinutes > 0
                          ? `Aggiungi ancora ${remainingMinutes} minuti di esercizi per saturare la seduta`
                          : `Riduci ${Math.abs(remainingMinutes)} minuti di esercizi per saturare la seduta`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setIsFormModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      disabled={!isSaturated}
                      className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all ${
                        isSaturated
                          ? 'text-slate-950 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/20 cursor-pointer'
                          : 'text-slate-500 bg-slate-800 cursor-not-allowed opacity-60'
                      }`}
                    >
                      {editingTrainingId ? 'Salva Modifiche' : 'Salva e Pianifica'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
