import React, { useState, useEffect, useRef } from 'react';
import {
  Athlete,
  AthleteRole,
  AthleteStatus,
  InjuryRecord,
  PhysicalProgressEntry,
  TechnicalEvaluationEntry,
  TrainingSession,
} from '../../types';
import {
  X,
  User,
  Activity,
  Award,
  AlertTriangle,
  Calendar,
  Zap,
  TrendingUp,
  Plus,
  Edit2,
  Save,
  CheckCircle,
  Clock,
  HeartPulse,
  FileText,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import { useDialog } from '../../context/DialogContext';
import {
  checkAthleteDuplicates,
  getWhatsAppLink,
  normalizePhoneDisplay,
  isValidFiscalCode,
  isValidEmail,
} from '../../lib/athleteValidation';
import { WhatsAppIcon } from '../common/WhatsAppIcon';

const formatDateDDMMYYYY = (dateStr?: string): string => {
  if (!dateStr) return '';
  if (dateStr.includes('.')) return dateStr;
  const rawDate = dateStr.split('T')[0];
  if (rawDate.includes('-')) {
    const parts = rawDate.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
    }
  }
  return dateStr;
};

interface AthleteDetailModalProps {
  athlete: Athlete;
  trainings: TrainingSession[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedAthlete: Athlete) => Promise<void>;
  onDelete?: (athleteId: string) => Promise<void>;
  isCoach: boolean;
  allAthletes?: Athlete[];
}

export const AthleteDetailModal: React.FC<AthleteDetailModalProps> = ({
  athlete,
  trainings,
  isOpen,
  onClose,
  onSave,
  onDelete,
  isCoach,
  allAthletes = [],
}) => {
  const { confirm, showToast } = useDialog();
  const detailFileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'injuries' | 'physical' | 'technical' | 'attendance' | 'convocazioni'>('profile');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for profile edit
  const [formData, setFormData] = useState<Athlete>({ ...athlete });

  useEffect(() => {
    setFormData({ ...athlete });
  }, [athlete]);

  // Dynamic medical certificate validity check
  useEffect(() => {
    if (formData.medicalCertExpiry) {
      const isExpired = new Date(formData.medicalCertExpiry) < new Date();
      setFormData((prev) => ({ ...prev, medicalCertValid: !isExpired }));
    }
  }, [formData.medicalCertExpiry]);

  // Realtime duplicate check on edited form data
  const editDupCheck = checkAthleteDuplicates(formData, allAthletes);

  const handleDetailFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast({ message: 'Seleziona un file immagine valido (JPG, PNG)', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setFormData((prev) => ({ ...prev, photoUrl: dataUrl }));
          showToast({ message: 'Foto avatar aggiornata con successo!', type: 'success' });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Form states for new injury
  const [showAddInjury, setShowAddInjury] = useState(false);
  const [newInjury, setNewInjury] = useState<Partial<InjuryRecord>>({
    title: '',
    injuryType: 'Distorsione',
    bodyPart: 'Caviglia',
    severity: 'moderata',
    dateReported: new Date().toISOString().split('T')[0],
    expectedReturnDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'in_cura',
    doctorDiagnosis: '',
    physioNotes: '',
  });

  // State for editing existing injury
  const [editingInjuryId, setEditingInjuryId] = useState<string | null>(null);
  const [editingInjury, setEditingInjury] = useState<Partial<InjuryRecord>>({});

  // Form states for new physical progress entry
  const [showAddPhysical, setShowAddPhysical] = useState(false);
  const [newPhysical, setNewPhysical] = useState<Partial<PhysicalProgressEntry>>({
    date: new Date().toISOString().split('T')[0],
    weightKg: athlete.weightKg,
    spikeReachCm: athlete.spikeReachCm,
    blockReachCm: athlete.blockReachCm,
    verticalJumpCm: athlete.spikeReachCm - athlete.heightCm,
    notes: '',
  });

  // Form states for new technical evaluation
  const [showAddEval, setShowAddEval] = useState(false);
  const [newEval, setNewEval] = useState<Partial<TechnicalEvaluationEntry>>({
    date: new Date().toISOString().split('T')[0],
    evaluatorName: 'Mario Bernardi (Coach)',
    serveRating: 7,
    receptionRating: 7,
    setRating: 7,
    attackRating: 7,
    blockRating: 7,
    defenseRating: 7,
    tacticalIQRating: 7,
    notes: '',
    strengths: ['Intensità', 'Precisione'],
    areasToImprove: ['Continuità'],
  });
  const [tempStrength, setTempStrength] = useState('');
  const [tempImprovement, setTempImprovement] = useState('');

  if (!isOpen) return null;

  // Handle Save Profile changes
  const handleSaveProfile = async () => {
    const rawPhone = formData.phone?.trim() || '';
    const phoneDigits = rawPhone.replace(/\D/g, '');
    if (!rawPhone || phoneDigits.length < 8) {
      showToast({
        message: 'Il numero di telefono cellulare è obbligatorio e deve contenere almeno 8 cifre.',
        type: 'error',
      });
      return;
    }

    const cf = formData.fiscalCode?.trim().toUpperCase() || '';
    if (cf && !isValidFiscalCode(cf)) {
      showToast({
        message: 'Il Codice Fiscale inserito non è valido (deve essere di 16 caratteri alfanumerici, es. RSSMRA85M01H501Z).',
        type: 'error',
      });
      return;
    }

    const email = formData.email?.trim() || '';
    if (email && !isValidEmail(email)) {
      showToast({
        message: 'L\'indirizzo email inserito non è valido (es. atleta@societa.it).',
        type: 'error',
      });
      return;
    }

    if (editDupCheck.hasDuplicate) {
      showToast({
        message: `Impossibile salvare: ${editDupCheck.summaryMessages.join(' | ')}`,
        type: 'error',
      });
      return;
    }

    const normalizedData: Athlete = {
      ...formData,
      phone: normalizePhoneDisplay(rawPhone),
    };

    setIsSaving(true);
    try {
      await onSave(normalizedData);
      setFormData(normalizedData);
      setIsEditingProfile(false);
      showToast({
        message: `Profilo di ${normalizedData.firstName} ${normalizedData.lastName} salvato con successo!`,
        type: 'success',
      });
    } catch (err) {
      console.error(err);
      showToast({
        message: 'Errore durante il salvataggio del profilo',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Add Injury
  const handleAddInjury = async () => {
    if (!newInjury.title) return;
    const injuryRecord: InjuryRecord = {
      id: `inj-${Date.now()}`,
      athleteId: athlete.id,
      title: newInjury.title || 'Infortunio',
      injuryType: newInjury.injuryType || 'Distorsione',
      bodyPart: newInjury.bodyPart || 'Caviglia',
      severity: newInjury.severity || 'moderata',
      dateReported: newInjury.dateReported || new Date().toISOString().split('T')[0],
      expectedReturnDate: newInjury.expectedReturnDate || '',
      status: newInjury.status || 'in_cura',
      doctorDiagnosis: newInjury.doctorDiagnosis || '',
      physioNotes: newInjury.physioNotes || '',
    };

    const updatedInjuries = [injuryRecord, ...(athlete.injuries || [])];
    const updatedAthlete: Athlete = {
      ...athlete,
      status: injuryRecord.status === 'in_cura' ? 'infortunato' : athlete.status,
      injuries: updatedInjuries,
    };

    await onSave(updatedAthlete);
    setFormData(updatedAthlete);
    setShowAddInjury(false);
    showToast({
      message: `Infortunio "${injuryRecord.title}" registrato per ${athlete.firstName}`,
      type: 'warning',
    });
    setNewInjury({
      title: '',
      injuryType: 'Distorsione',
      bodyPart: 'Caviglia',
      severity: 'moderata',
      dateReported: new Date().toISOString().split('T')[0],
      expectedReturnDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'in_cura',
      doctorDiagnosis: '',
      physioNotes: '',
    });
  };

  // Handle Resolve Injury
  const handleResolveInjury = async (injuryId: string) => {
    const updatedInjuries = athlete.injuries.map((i) =>
      i.id === injuryId
        ? {
            ...i,
            status: 'recuperato' as const,
            actualReturnDate: new Date().toISOString().split('T')[0],
          }
        : i
    );

    const hasActiveInjuries = updatedInjuries.some((i) => i.status !== 'recuperato');
    const updatedAthlete: Athlete = {
      ...athlete,
      status: hasActiveInjuries ? 'in_recupero' : 'attivo',
      injuries: updatedInjuries,
    };

    await onSave(updatedAthlete);
    setFormData(updatedAthlete);
    showToast({
      message: `Infortunio segnato come recuperato con successo!`,
      type: 'success',
    });
  };

  // Handle Add Physical Progress
  const handleAddPhysical = async () => {
    const entry: PhysicalProgressEntry = {
      id: `prog-${Date.now()}`,
      date: newPhysical.date || new Date().toISOString().split('T')[0],
      weightKg: Number(newPhysical.weightKg) || athlete.weightKg,
      spikeReachCm: Number(newPhysical.spikeReachCm) || athlete.spikeReachCm,
      blockReachCm: Number(newPhysical.blockReachCm) || athlete.blockReachCm,
      verticalJumpCm: Number(newPhysical.verticalJumpCm) || (Number(newPhysical.spikeReachCm) || athlete.spikeReachCm) - athlete.heightCm,
      notes: newPhysical.notes || '',
    };

    const updatedProgress = [...(athlete.physicalProgress || []), entry].sort(
      (a, b) => (a.date > b.date ? 1 : -1)
    );

    const updatedAthlete: Athlete = {
      ...athlete,
      weightKg: entry.weightKg,
      spikeReachCm: entry.spikeReachCm,
      blockReachCm: entry.blockReachCm,
      physicalProgress: updatedProgress,
    };

    await onSave(updatedAthlete);
    setFormData(updatedAthlete);
    setShowAddPhysical(false);
    showToast({
      message: `Rilevazione fisica salvata per ${athlete.firstName} ${athlete.lastName}`,
      type: 'success',
    });
  };

  // Handle Add Technical Evaluation
  const handleAddEval = async () => {
    const evalEntry: TechnicalEvaluationEntry = {
      id: `eval-${Date.now()}`,
      date: newEval.date || new Date().toISOString().split('T')[0],
      evaluatorName: newEval.evaluatorName || 'Roberto (Coach)',
      serveRating: Number(newEval.serveRating) || 7,
      receptionRating: Number(newEval.receptionRating) || 7,
      setRating: Number(newEval.setRating) || 7,
      attackRating: Number(newEval.attackRating) || 7,
      blockRating: Number(newEval.blockRating) || 7,
      defenseRating: Number(newEval.defenseRating) || 7,
      tacticalIQRating: Number(newEval.tacticalIQRating) || 7,
      notes: newEval.notes || '',
      strengths: newEval.strengths || [],
      areasToImprove: newEval.areasToImprove || [],
    };

    const updatedEvals = [evalEntry, ...(athlete.technicalEvaluations || [])];
    const updatedAthlete: Athlete = {
      ...athlete,
      technicalEvaluations: updatedEvals,
    };

    await onSave(updatedAthlete);
    setFormData(updatedAthlete);
    setShowAddEval(false);
    showToast({
      message: `Valutazione tecnica aggiornata per ${athlete.firstName} ${athlete.lastName}`,
      type: 'success',
    });
  };

  // Handle Delete Injury
  const handleDeleteInjury = async (injuryId: string) => {
    const target = athlete.injuries?.find((i) => i.id === injuryId);
    const confirmed = await confirm({
      title: 'Elimina Record Infortunio',
      message: `Vuoi eliminare definitivamente la voce di infortunio "${target?.title || 'Selezionato'}"?`,
      confirmText: 'Sì, Elimina',
      cancelText: 'Annulla',
      type: 'danger',
    });
    if (!confirmed) return;

    const updatedInjuries = (athlete.injuries || []).filter((i) => i.id !== injuryId);
    const hasActiveInjuries = updatedInjuries.some((i) => i.status !== 'recuperato');
    const updatedAthlete: Athlete = {
      ...athlete,
      status: hasActiveInjuries ? 'in_recupero' : 'attivo',
      injuries: updatedInjuries,
    };
    setFormData(updatedAthlete);
    await onSave(updatedAthlete);
    showToast({
      message: 'Record infortunio eliminato con successo',
      type: 'info',
    });
  };

  // Handle Save Injury Edit
  const handleSaveInjuryEdit = async () => {
    if (!editingInjuryId || !editingInjury.title) {
      showToast({ message: 'Inserisci almeno la descrizione dell\'infortunio.', type: 'error' });
      return;
    }

    const updatedInjuries = (athlete.injuries || []).map((inj) => {
      if (inj.id === editingInjuryId) {
        return {
          ...inj,
          title: editingInjury.title || inj.title,
          injuryType: editingInjury.injuryType || inj.injuryType,
          bodyPart: editingInjury.bodyPart || inj.bodyPart,
          severity: editingInjury.severity || inj.severity,
          status: editingInjury.status || inj.status,
          dateReported: editingInjury.dateReported || inj.dateReported,
          expectedReturnDate: editingInjury.expectedReturnDate ?? '',
          actualReturnDate: editingInjury.actualReturnDate ?? '',
          doctorDiagnosis: editingInjury.doctorDiagnosis ?? '',
          physioNotes: editingInjury.physioNotes ?? '',
        } as InjuryRecord;
      }
      return inj;
    });

    const hasInCura = updatedInjuries.some((i) => i.status === 'in_cura');
    const hasInRecupero = updatedInjuries.some((i) => i.status === 'in_recupero');
    const newAthleteStatus: AthleteStatus = hasInCura
      ? 'infortunato'
      : hasInRecupero
      ? 'in_recupero'
      : 'attivo';

    const updatedAthlete: Athlete = {
      ...athlete,
      status: newAthleteStatus,
      injuries: updatedInjuries,
    };

    setFormData(updatedAthlete);
    await onSave(updatedAthlete);
    setEditingInjuryId(null);
    setEditingInjury({});
    showToast({
      message: 'Infortunio modificato con successo',
      type: 'success',
    });
  };

  // Handle Delete Physical Progress
  const handleDeletePhysical = async (progId: string) => {
    const confirmed = await confirm({
      title: 'Elimina Rilevazione Fisica',
      message: 'Sei sicuro di voler eliminare questa rilevazione dal registro storico?',
      confirmText: 'Sì, Elimina',
      cancelText: 'Annulla',
      type: 'danger',
    });
    if (!confirmed) return;

    const updatedProgress = (athlete.physicalProgress || []).filter((p) => p.id !== progId);
    const latest = updatedProgress[updatedProgress.length - 1];
    const updatedAthlete: Athlete = {
      ...athlete,
      physicalProgress: updatedProgress,
      weightKg: latest ? latest.weightKg : athlete.weightKg,
      spikeReachCm: latest ? latest.spikeReachCm : athlete.spikeReachCm,
      blockReachCm: latest ? latest.blockReachCm : athlete.blockReachCm,
    };
    setFormData(updatedAthlete);
    await onSave(updatedAthlete);
    showToast({
      message: 'Rilevazione fisica eliminata con successo',
      type: 'info',
    });
  };

  // Handle Delete Technical Evaluation
  const handleDeleteEval = async (evalId: string) => {
    const confirmed = await confirm({
      title: 'Elimina Valutazione Tecnica',
      message: 'Vuoi eliminare questa scheda di valutazione coach?',
      confirmText: 'Sì, Elimina',
      cancelText: 'Annulla',
      type: 'danger',
    });
    if (!confirmed) return;

    const updatedEvals = (athlete.technicalEvaluations || []).filter((e) => e.id !== evalId);
    const updatedAthlete: Athlete = {
      ...athlete,
      technicalEvaluations: updatedEvals,
    };
    setFormData(updatedAthlete);
    await onSave(updatedAthlete);
    showToast({
      message: 'Scheda di valutazione rimossa con successo',
      type: 'info',
    });
  };

  // Calculate Attendance Stats for this athlete
  const athleteAttendances = trainings.map((t) => {
    const isRegistered = t.registeredAthleteIds?.includes(athlete.id);
    const attendanceRecord = t.attendees?.find((a) => a.athleteId === athlete.id);
    return {
      training: t,
      isRegistered,
      status: attendanceRecord ? attendanceRecord.status : isRegistered ? 'iscritto' : 'non_iscritto',
      notes: attendanceRecord?.coachNotes,
      rating: attendanceRecord?.performanceRating,
    };
  });

  const totalCompletedTrainings = trainings.filter((t) => t.status === 'completato').length;
  const presentCount = athleteAttendances.filter(
    (a) => a.training.status === 'completato' && a.status === 'presente'
  ).length;
  const attendanceRate = totalCompletedTrainings > 0 ? Math.round((presentCount / totalCompletedTrainings) * 100) : 100;

  // Prepare Radar Data for Technical Evaluation
  const latestEval = athlete.technicalEvaluations?.[0];
  const radarData = latestEval
    ? [
        { subject: 'Battuta', score: latestEval.serveRating, fullMark: 10 },
        { subject: 'Ricezione', score: latestEval.receptionRating, fullMark: 10 },
        { subject: 'Alzata', score: latestEval.setRating, fullMark: 10 },
        { subject: 'Attacco', score: latestEval.attackRating, fullMark: 10 },
        { subject: 'Muro', score: latestEval.blockRating, fullMark: 10 },
        { subject: 'Difesa', score: latestEval.defenseRating, fullMark: 10 },
        { subject: 'Tattica', score: latestEval.tacticalIQRating, fullMark: 10 },
      ]
    : [
        { subject: 'Battuta', score: 7, fullMark: 10 },
        { subject: 'Ricezione', score: 7, fullMark: 10 },
        { subject: 'Alzata', score: 6, fullMark: 10 },
        { subject: 'Attacco', score: 8, fullMark: 10 },
        { subject: 'Muro', score: 7.5, fullMark: 10 },
        { subject: 'Difesa', score: 7, fullMark: 10 },
        { subject: 'Tattica', score: 8, fullMark: 10 },
      ];

  const handleTabChange = (tabId: typeof activeTab) => {
    if (isEditingProfile) {
      setIsEditingProfile(false);
      setFormData({ ...athlete });
    }
    setActiveTab(tabId);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#0b0e14]/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="athlete-detail-modal"
        className="bg-[#11141d] border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header with Athlete Banner */}
        <div className="relative bg-gradient-to-r from-[#0b0e14] via-[#11141d] to-[#0b0e14] p-6 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={athlete.photoUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80'}
                alt={`${athlete.firstName} ${athlete.lastName}`}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-amber-500/40 shadow-lg"
              />
              <span className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-amber-500 text-slate-950 border-2 border-[#11141d] flex items-center justify-center font-black text-sm shadow-md">
                #{athlete.jerseyNumber}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white font-display">
                  {athlete.firstName} {athlete.lastName}
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  {athlete.role}
                </span>
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-full border ${
                    athlete.status === 'attivo'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {athlete.status === 'attivo' ? 'IDONEO' : 'INFORTUNATO'}
                </span>
              </div>

            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCoach && onDelete && (
              <button
                id="delete-athlete-button"
                onClick={async () => {
                  const confirmed = await confirm({
                    title: 'Elimina Atleta dalla Rosa',
                    message: `Sei sicuro di voler eliminare definitivamente l'atleta ${athlete.firstName} ${athlete.lastName} (#${athlete.jerseyNumber})? Tutti i dati storici andranno persi.`,
                    confirmText: 'Sì, Elimina Atleta',
                    cancelText: 'Annulla',
                    type: 'danger',
                  });
                  if (confirmed) {
                    await onDelete(athlete.id);
                    showToast({
                      message: `Atleta ${athlete.firstName} ${athlete.lastName} eliminato con successo`,
                      type: 'info',
                    });
                    onClose();
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                title="Elimina atleta"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              id="close-athlete-detail-button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs inside modal */}
        <div className="h-14 shrink-0 flex items-center gap-2 px-6 border-b border-slate-800 bg-[#0b0e14]/60 overflow-x-auto no-scrollbar">
          {[
            { id: 'profile', label: 'Scheda', icon: User },
            { id: 'injuries', label: `Infortuni (${athlete.injuries?.length || 0})`, icon: HeartPulse },
            { id: 'physical', label: 'Progressi Fisici', icon: TrendingUp },
            { id: 'technical', label: 'Valutazione Tecnica', icon: Zap },
            { id: 'attendance', label: `Presenze (${attendanceRate}%)`, icon: Calendar },
            { id: 'convocazioni', label: 'Convocazioni', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`modal-tab-${tab.id}`}
                onClick={() => handleTabChange(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: PROFILE & BIO */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {isEditingProfile ? (
                <div className="flex flex-col flex-1 overflow-hidden h-full">
                  <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                      <Edit2 className="w-4 h-4 text-amber-400" />
                      Modifica Scheda Atleta
                    </h3>
                    
                    {editDupCheck.hasDuplicate && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-[11px] space-y-1">
                        <strong className="block font-bold">⚠️ Rilevati dati duplicati:</strong>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {editDupCheck.summaryMessages.map((msg, idx) => (
                            <li key={idx}>{msg}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* CATEGORIA 1: Anagrafica e Ruolo */}
                    <div className="bg-[#0b0e14] p-4 rounded-2xl border border-slate-800/80 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 pb-2 border-b border-slate-800/60">
                        <User className="w-4 h-4 text-amber-400" />
                        1. Dati Anagrafici & Ruolo
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Nome</label>
                          <input
                            type="text"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            className={`w-full bg-[#11141d] border rounded-xl px-3 py-2 text-white focus:outline-none ${
                              editDupCheck.duplicateFields.fullName ? 'border-rose-500/80' : 'border-slate-700 focus:border-amber-500'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Cognome</label>
                          <input
                            type="text"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            className={`w-full bg-[#11141d] border rounded-xl px-3 py-2 text-white focus:outline-none ${
                              editDupCheck.duplicateFields.fullName ? 'border-rose-500/80' : 'border-slate-700 focus:border-amber-500'
                            }`}
                          />
                          {editDupCheck.duplicateFields.fullName && (
                            <p className="text-[10px] text-rose-400 mt-1">{editDupCheck.duplicateFields.fullName}</p>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-slate-400 font-medium">Codice Fiscale</label>
                            {formData.fiscalCode && isValidFiscalCode(formData.fiscalCode) && (
                              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                                <CheckCircle className="w-3 h-3" /> Valido
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="es. BNCMRC02A01H501U"
                            value={formData.fiscalCode || ''}
                            onChange={(e) => setFormData({ ...formData, fiscalCode: e.target.value.toUpperCase() })}
                            className={`w-full bg-[#11141d] border rounded-xl px-3 py-2 text-white uppercase focus:outline-none ${
                              editDupCheck.duplicateFields.fiscalCode || (formData.fiscalCode && !isValidFiscalCode(formData.fiscalCode))
                                ? 'border-rose-500/80 focus:border-rose-500'
                                : 'border-slate-700 focus:border-amber-500'
                            }`}
                          />
                          {editDupCheck.duplicateFields.fiscalCode && (
                            <p className="text-[10px] text-rose-400 mt-1">{editDupCheck.duplicateFields.fiscalCode}</p>
                          )}
                          {formData.fiscalCode && !isValidFiscalCode(formData.fiscalCode) && !editDupCheck.duplicateFields.fiscalCode && (
                            <p className="text-[10px] text-rose-400 mt-1">Formato non valido (16 caratteri alfanumerici, es. RSSMRA85M01H501Z)</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Data di Nascita</label>
                          <input
                            type="date"
                            value={formData.birthDate || ''}
                            onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                            className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Numero Maglia</label>
                          <input
                            type="number"
                            value={formData.jerseyNumber === 0 || (formData.jerseyNumber as any) === '' ? '' : formData.jerseyNumber}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setFormData({ ...formData, jerseyNumber: e.target.value === '' ? '' as any : Number(e.target.value) })}
                            className={`w-full bg-[#11141d] border rounded-xl px-3 py-2 text-white focus:outline-none ${
                              editDupCheck.duplicateFields.jerseyNumber ? 'border-rose-500/80' : 'border-slate-700 focus:border-amber-500'
                            }`}
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-slate-400 mb-1 font-medium">Ruolo Principale</label>
                          <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as AthleteRole })}
                            className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                          >
                            <option value="Schiacciatore">Schiacciatore</option>
                            <option value="Opposto">Opposto</option>
                            <option value="Centrale">Centrale</option>
                            <option value="Palleggiatore">Palleggiatore</option>
                            <option value="Libero">Libero</option>
                          </select>
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-slate-400 mb-1 font-medium">Ruolo Secondario</label>
                          <select
                            value={formData.secondaryRole || ''}
                            onChange={(e) => setFormData({ ...formData, secondaryRole: e.target.value as AthleteRole })}
                            className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                          >
                            <option value="">Nessuno</option>
                            <option value="Schiacciatore">Schiacciatore</option>
                            <option value="Opposto">Opposto</option>
                            <option value="Centrale">Centrale</option>
                            <option value="Palleggiatore">Palleggiatore</option>
                            <option value="Libero">Libero</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* CATEGORIA 2: Idoneità, Certificati e Contatti */}
                    <div className="bg-[#0b0e14] p-4 rounded-2xl border border-slate-800/80 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2 pb-2 border-b border-slate-800/60">
                        <Shield className="w-4 h-4 text-rose-400" />
                        2. Idoneità, Visita Medica & Contatti
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Stato Idoneità</label>
                          <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as AthleteStatus })}
                            className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                          >
                            <option value="attivo">Idoneo</option>
                            <option value="infortunato">Infortunato</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Scadenza Visita Medica</label>
                          <input
                            type="date"
                            value={formData.medicalCertExpiry}
                            onChange={(e) => setFormData({ ...formData, medicalCertExpiry: e.target.value })}
                            className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Telefono Cellulare *</label>
                          <input
                            type="tel"
                            required
                            placeholder="Es. 320 948 5403 o +39 320 9485403"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className={`w-full bg-[#11141d] border rounded-xl px-3 py-2 text-white focus:outline-none ${
                              editDupCheck.duplicateFields.phone ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-700 focus:border-amber-500'
                            }`}
                          />
                          {formData.phone && (
                            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                              <span>Normalizzato: <strong className="text-slate-200 font-mono">{normalizePhoneDisplay(formData.phone)}</strong></span>
                              {getWhatsAppLink(formData.phone) && (
                                <a
                                  href={getWhatsAppLink(formData.phone)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium hover:underline"
                                >
                                  <WhatsAppIcon className="w-3 h-3 text-emerald-400 shrink-0" />
                                  Test WhatsApp
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-slate-400 font-medium">Email</label>
                            {formData.email && isValidEmail(formData.email) && (
                              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                                <CheckCircle className="w-3 h-3" /> Email valida
                              </span>
                            )}
                          </div>
                          <input
                            type="email"
                            placeholder="es. atleta@email.it"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className={`w-full bg-[#11141d] border rounded-xl px-3 py-2 text-white focus:outline-none ${
                              formData.email && !isValidEmail(formData.email)
                                ? 'border-rose-500/80 focus:border-rose-500'
                                : 'border-slate-700 focus:border-amber-500'
                            }`}
                          />
                          {formData.email && !isValidEmail(formData.email) && (
                            <p className="text-[10px] text-rose-400 mt-1">Formato email non valido (es. atleta@societa.it)</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CATEGORIA 3: Parametri Fisici */}
                    <div className="bg-[#0b0e14] p-4 rounded-2xl border border-slate-800/80 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2 pb-2 border-b border-slate-800/60">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        3. Parametri Fisici
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Altezza (cm)</label>
                          <input
                            type="number"
                            value={formData.heightCm === 0 || (formData.heightCm as any) === '' ? '' : formData.heightCm}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setFormData({ ...formData, heightCm: e.target.value === '' ? '' as any : Number(e.target.value) })}
                            className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Peso (kg)</label>
                          <input
                            type="number"
                            value={formData.weightKg === 0 || (formData.weightKg as any) === '' ? '' : formData.weightKg}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setFormData({ ...formData, weightKg: e.target.value === '' ? '' as any : Number(e.target.value) })}
                            className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Salto Attacco</label>
                          <input
                            type="number"
                            value={formData.spikeReachCm === 0 || (formData.spikeReachCm as any) === '' ? '' : formData.spikeReachCm}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setFormData({ ...formData, spikeReachCm: e.target.value === '' ? '' as any : Number(e.target.value) })}
                            className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Salto Muro</label>
                          <input
                            type="number"
                            value={formData.blockReachCm === 0 || (formData.blockReachCm as any) === '' ? '' : formData.blockReachCm}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setFormData({ ...formData, blockReachCm: e.target.value === '' ? '' as any : Number(e.target.value) })}
                            className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* CATEGORIA 4: Foto Profilo e Note Staff */}
                    <div className="bg-[#0b0e14] p-4 rounded-2xl border border-slate-800/80 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 pb-2 border-b border-slate-800/60">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        4. Foto Profilo & Note Tecniche
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-slate-400 font-medium mb-1.5">Foto Profilo Atleta</label>
                          <input
                            type="file"
                            ref={detailFileInputRef}
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            className="hidden"
                            onChange={handleDetailFileUpload}
                          />
                          <div className="flex items-center gap-3">
                            <img
                              src={formData.photoUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'}
                              alt="Preview Avatar"
                              className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-700 shrink-0"
                            />
                            <button
                              type="button"
                              onClick={() => detailFileInputRef.current?.click()}
                              className="flex items-center gap-2 px-3.5 py-2 bg-[#161b26] hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Upload className="w-4 h-4" />
                              Carica Foto JPG / PNG
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Note Tecniche & Comportamentali</label>
                          <textarea
                            rows={2}
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 p-4 bg-[#0b0e14] border-t border-slate-800 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...athlete });
                        setIsEditingProfile(false);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-[#11141d] rounded-xl border border-slate-800 transition-colors"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-102"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSaving ? 'Salvataggio...' : 'Salva Modifiche'}
                    </button>
                  </div>
                </div>
              ) : (
                  <div className="space-y-4">
                    {isCoach && (
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Informazioni Atleta
                        </span>
                        <button
                          id="edit-athlete-profile-button"
                          onClick={() => setIsEditingProfile(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Modifica Scheda
                        </button>
                      </div>
                    )}

                    {/* CARD 1: Anagrafica & Ruolo */}
                    <div className="bg-[#0b0e14] p-5 rounded-2xl border border-slate-800 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                        <User className="w-4 h-4 text-amber-400" />
                        1. Dati Anagrafici & Ruolo
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                           <span className="text-slate-400 block mb-0.5">Numero Maglia</span>
                           <span className="font-bold text-amber-400 font-mono text-sm">#{athlete.jerseyNumber}</span>
                        </div>
                        <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                           <span className="text-slate-400 block mb-0.5">Ruolo Principale</span>
                           <span className="font-bold text-white">{athlete.role}</span>
                        </div>
                        <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                           <span className="text-slate-400 block mb-0.5">Ruolo Secondario</span>
                           <span className="font-bold text-white">{athlete.secondaryRole || 'Nessuno'}</span>
                        </div>
                        <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                           <span className="text-slate-400 block mb-0.5">Data di Nascita</span>
                           <span className="font-bold text-white">{athlete.birthDate ? athlete.birthDate.split('-').reverse().join('-') : 'Non specificata'}</span>
                        </div>
                        <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800 sm:col-span-2">
                           <span className="text-slate-400 block mb-0.5">Codice Fiscale</span>
                           <span className="font-bold text-white font-mono uppercase">{athlete.fiscalCode || 'Non specificato'}</span>
                        </div>
                      </div>
                    </div>

                    {/* CARD 2: Idoneità & Medico */}
                    <div className="bg-[#0b0e14] p-5 rounded-2xl border border-slate-800 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-rose-400" />
                        2. Idoneità & Certificato Medico
                      </h3>
                      <div className="p-4 bg-[#11141d] rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300">Stato</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${athlete.status === 'attivo' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'}`}>
                            {athlete.status === 'attivo' ? 'IDONEO' : 'INFORTUNATO'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300">Certificato FIPAV</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${new Date(athlete.medicalCertExpiry) >= new Date() ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'}`}>
                            {new Date(athlete.medicalCertExpiry) >= new Date() ? 'CERT.VALIDO' : 'CERT.NON VALIDO'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Scadenza: <strong className="text-white">{athlete.medicalCertExpiry.split('-').reverse().join('-')}</strong>
                        </p>
                      </div>
                    </div>

                    {/* CARD 3: Parametri Fisici */}
                    <div className="bg-[#0b0e14] p-5 rounded-2xl border border-slate-800 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        3. Parametri Fisici
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                          <span className="text-slate-400 block">Altezza</span>
                          <span className="font-bold text-white text-base">{athlete.heightCm} <span className="text-[10px] font-normal">cm</span></span>
                        </div>
                        <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                          <span className="text-slate-400 block">Peso</span>
                          <span className="font-bold text-white text-base">{athlete.weightKg} <span className="text-[10px] font-normal">kg</span></span>
                        </div>
                        <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                          <span className="text-slate-400 block">Salto Attacco</span>
                          <span className="font-bold text-amber-400 text-base">{athlete.spikeReachCm} <span className="text-[10px] font-normal">cm</span></span>
                        </div>
                        <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                          <span className="text-slate-400 block">Salto Muro</span>
                          <span className="font-bold text-cyan-400 text-base">{athlete.blockReachCm} <span className="text-[10px] font-normal">cm</span></span>
                        </div>
                      </div>
                    </div>

                    {/* CARD 4: Contatti & Note */}
                    <div className="bg-[#0b0e14] p-5 rounded-2xl border border-slate-800 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        4. Contatti & Note Tecniche
                      </h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#11141d]">
                          <span className="text-slate-400">Telefono Cellulare:</span>
                          {getWhatsAppLink(athlete.phone) ? (
                            <a
                              href={getWhatsAppLink(athlete.phone)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Apri chat WhatsApp con ${athlete.firstName} (${athlete.phone})`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-medium transition-all group hover:border-emerald-500/60 shadow-sm cursor-pointer hover:scale-105"
                            >
                              <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                              <span>{athlete.phone}</span>
                            </a>
                          ) : (
                            <span className="text-white font-medium font-mono">{athlete.phone || 'Non specificato'}</span>
                          )}
                        </div>
                        <div className="flex justify-between p-2.5 rounded-lg bg-[#11141d]">
                          <span className="text-slate-400">Email:</span>
                          <span className="text-white font-medium">{athlete.email || 'Non specificata'}</span>
                        </div>
                        <div className="p-3 mt-2 rounded-lg bg-[#11141d] border border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Note Tecniche & Comportamentali</span>
                          <p className="text-slate-300 italic">{athlete.notes && athlete.notes.trim() ? athlete.notes : 'Nessuna nota presente.'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
              )}
            </div>
          )}

          {/* TAB 2: GAME STATS */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 text-center">
                  <span className="text-xs text-slate-400 font-medium block">Punti Totali</span>
                  <span className="text-2xl sm:text-3xl font-black text-amber-400">{athlete.stats?.totalPoints || 0}</span>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    {athlete.stats?.setsPlayed ? `${(athlete.stats.totalPoints / athlete.stats.setsPlayed).toFixed(1)} pt/set` : '-'}
                  </span>
                </div>
                <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 text-center">
                  <span className="text-xs text-slate-400 font-medium block">Ace in Battuta</span>
                  <span className="text-2xl sm:text-3xl font-black text-amber-400">{athlete.stats?.aces || 0}</span>
                  <span className="text-[11px] text-slate-500 block mt-1">Errori: {athlete.stats?.serveErrors || 0}</span>
                </div>
                <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 text-center">
                  <span className="text-xs text-slate-400 font-medium block">Muri Vincenti</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400">{athlete.stats?.blockPoints || 0}</span>
                  <span className="text-[11px] text-slate-500 block mt-1">Tocchi: {athlete.stats?.blockTouches || 0}</span>
                </div>
                <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 text-center">
                  <span className="text-xs text-slate-400 font-medium block">Ricezioni Perfette</span>
                  <span className="text-2xl sm:text-3xl font-black text-cyan-400">
                    {athlete.stats?.receptionTotal > 0
                      ? `${Math.round((athlete.stats.receptionPerfect / athlete.stats.receptionTotal) * 100)}%`
                      : '-'}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    {athlete.stats?.receptionPerfect || 0} su {athlete.stats?.receptionTotal || 0}
                  </span>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="bg-[#0b0e14] p-5 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  Riepilogo Fondamentali di Gioco (Stagione in Corso)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-1">Attacco</span>
                    <p className="text-slate-300">Punti attacco: <strong className="text-white">{athlete.stats?.attackKills || 0}</strong></p>
                    <p className="text-slate-300">Errori commessi: <strong className="text-rose-400">{athlete.stats?.attackErrors || 0}</strong></p>
                    <p className="text-slate-300">Tentativi totali: <strong className="text-white">{athlete.stats?.attackAttempts || 0}</strong></p>
                    <p className="text-slate-300 mt-1">
                      Efficienza: <strong className="text-emerald-400">
                        {athlete.stats?.attackAttempts > 0
                          ? `${Math.round(((athlete.stats.attackKills - athlete.stats.attackErrors) / athlete.stats.attackAttempts) * 100)}%`
                          : '-'}
                      </strong>
                    </p>
                  </div>

                  <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-1">Battuta</span>
                    <p className="text-slate-300">Ace realizzati: <strong className="text-white">{athlete.stats?.aces || 0}</strong></p>
                    <p className="text-slate-300">Errori in battuta: <strong className="text-rose-400">{athlete.stats?.serveErrors || 0}</strong></p>
                    <p className="text-slate-300 mt-1">
                      Rapporto Ace/Errori: <strong className="text-cyan-400">
                        {athlete.stats?.serveErrors ? (athlete.stats.aces / athlete.stats.serveErrors).toFixed(2) : '-'}
                      </strong>
                    </p>
                  </div>

                  <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-1">Seconda Linea & Difesa</span>
                    <p className="text-slate-300">Difese punto: <strong className="text-white">{athlete.stats?.digsTotal || 0}</strong></p>
                    <p className="text-slate-300">Errori ricezione: <strong className="text-rose-400">{athlete.stats?.receptionErrors || 0}</strong></p>
                    <p className="text-slate-300">Partite / Set giocati: <strong className="text-white">{athlete.stats?.matchesPlayed || 0} / {athlete.stats?.setsPlayed || 0}</strong></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INJURY HISTORY */}
          {activeTab === 'injuries' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-rose-400" />
                    Storico infortuni
                  </h3>
                </div>
                {isCoach && (
                  <button
                    id="add-injury-button"
                    onClick={() => setShowAddInjury(!showAddInjury)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-600/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Registra Infortunio
                  </button>
                )}
              </div>

              {/* Add Injury Form */}
              {showAddInjury && (
                <div className="p-4 bg-[#0b0e14] border border-rose-800/60 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-rose-300 uppercase tracking-wider block">
                    Nuovo Infortunio
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">Descrizione</label>
                      <input
                        type="text"
                        placeholder="es. Distorsione tibio-tarsica"
                        value={newInjury.title}
                        onChange={(e) => setNewInjury({ ...newInjury, title: e.target.value })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Tipologia</label>
                      <select
                        value={newInjury.injuryType}
                        onChange={(e) => setNewInjury({ ...newInjury, injuryType: e.target.value as any })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                      >
                        <option value="Distorsione">Distorsione</option>
                        <option value="Contrattura">Contrattura</option>
                        <option value="Stiramento/Strappo">Stiramento/Strappo</option>
                        <option value="Tendinopatia">Tendinopatia</option>
                        <option value="Frattura">Frattura</option>
                        <option value="Lussazione">Lussazione</option>
                        <option value="Altro">Altro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Distretto Corporeo</label>
                      <select
                        value={newInjury.bodyPart}
                        onChange={(e) => setNewInjury({ ...newInjury, bodyPart: e.target.value as any })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                      >
                        <option value="Caviglia">Caviglia</option>
                        <option value="Ginocchio">Ginocchio</option>
                        <option value="Spalla">Spalla</option>
                        <option value="Polso/Dita">Polso/Dita</option>
                        <option value="Schiena">Schiena</option>
                        <option value="Coscia/Polpaccio">Coscia/Polpaccio</option>
                        <option value="Altro">Altro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Gravità</label>
                      <select
                        value={newInjury.severity}
                        onChange={(e) => setNewInjury({ ...newInjury, severity: e.target.value as any })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      >
                        <option value="lieve">Lieve (1-7 giorni)</option>
                        <option value="moderata">Moderata (1-4 settimane)</option>
                        <option value="grave">Grave (1+ mesi)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Data Infortunio</label>
                      <input
                        type="date"
                        value={newInjury.dateReported}
                        onChange={(e) => setNewInjury({ ...newInjury, dateReported: e.target.value })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Rientro Previsto</label>
                      <input
                        type="date"
                        value={newInjury.expectedReturnDate}
                        onChange={(e) => setNewInjury({ ...newInjury, expectedReturnDate: e.target.value })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 cursor-pointer"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-slate-400 mb-1">Diagnosi & Fisioterapia</label>
                      <textarea
                        rows={2}
                        placeholder="Protocollo riabilitativo, terapie e prescrizioni mediche..."
                        value={newInjury.doctorDiagnosis}
                        onChange={(e) => setNewInjury({ ...newInjury, doctorDiagnosis: e.target.value })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddInjury(false)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleAddInjury}
                      className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl"
                    >
                      Salva Infortunio
                    </button>
                  </div>
                </div>
              )}

              {/* Injuries List */}
              {athlete.injuries && athlete.injuries.length > 0 ? (
                <div className="space-y-3">
                  {athlete.injuries.map((inj) =>
                    editingInjuryId === inj.id ? (
                      <div key={inj.id} className="p-4 bg-[#0b0e14] border border-amber-500/50 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                            Modifica Infortunio
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingInjuryId(null);
                              setEditingInjury({});
                            }}
                            className="text-slate-400 hover:text-white text-xs cursor-pointer"
                          >
                            Annulla
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <label className="block text-slate-400 mb-1">Descrizione</label>
                            <input
                              type="text"
                              value={editingInjury.title || ''}
                              onChange={(e) => setEditingInjury({ ...editingInjury, title: e.target.value })}
                              className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">Tipologia</label>
                            <select
                              value={editingInjury.injuryType || 'Distorsione'}
                              onChange={(e) => setEditingInjury({ ...editingInjury, injuryType: e.target.value as any })}
                              className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                            >
                              <option value="Distorsione">Distorsione</option>
                              <option value="Contrattura">Contrattura</option>
                              <option value="Stiramento/Strappo">Stiramento/Strappo</option>
                              <option value="Tendinopatia">Tendinopatia</option>
                              <option value="Frattura">Frattura</option>
                              <option value="Lussazione">Lussazione</option>
                              <option value="Altro">Altro</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">Distretto Corporeo</label>
                            <select
                              value={editingInjury.bodyPart || 'Caviglia'}
                              onChange={(e) => setEditingInjury({ ...editingInjury, bodyPart: e.target.value as any })}
                              className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                            >
                              <option value="Caviglia">Caviglia</option>
                              <option value="Ginocchio">Ginocchio</option>
                              <option value="Spalla">Spalla</option>
                              <option value="Polso/Dita">Polso/Dita</option>
                              <option value="Schiena">Schiena</option>
                              <option value="Coscia/Polpaccio">Coscia/Polpaccio</option>
                              <option value="Altro">Altro</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">Gravità</label>
                            <select
                              value={editingInjury.severity || 'moderata'}
                              onChange={(e) => setEditingInjury({ ...editingInjury, severity: e.target.value as any })}
                              className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                            >
                              <option value="lieve">Lieve (1-7 giorni)</option>
                              <option value="moderata">Moderata (1-4 settimane)</option>
                              <option value="grave">Grave (1+ mesi)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">Stato</label>
                            <select
                              value={editingInjury.status || 'in_cura'}
                              onChange={(e) => setEditingInjury({ ...editingInjury, status: e.target.value as any })}
                              className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                            >
                              <option value="in_cura">In Trattamento / In Cura</option>
                              <option value="in_recupero">In Riatletizzazione / Recupero</option>
                              <option value="recuperato">Guarito / Idoneo</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">Data Infortunio</label>
                            <input
                              type="date"
                              value={editingInjury.dateReported || ''}
                              onChange={(e) => setEditingInjury({ ...editingInjury, dateReported: e.target.value })}
                              className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">Rientro Previsto</label>
                            <input
                              type="date"
                              value={editingInjury.expectedReturnDate || ''}
                              onChange={(e) => setEditingInjury({ ...editingInjury, expectedReturnDate: e.target.value })}
                              className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">Rientro Effettivo</label>
                            <input
                              type="date"
                              value={editingInjury.actualReturnDate || ''}
                              onChange={(e) => setEditingInjury({ ...editingInjury, actualReturnDate: e.target.value })}
                              className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-slate-400 mb-1">Diagnosi & Fisioterapia</label>
                            <textarea
                              rows={2}
                              value={editingInjury.doctorDiagnosis || ''}
                              onChange={(e) => setEditingInjury({ ...editingInjury, doctorDiagnosis: e.target.value })}
                              className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingInjuryId(null);
                              setEditingInjury({});
                            }}
                            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                          >
                            Annulla
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveInjuryEdit}
                            className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-600/20 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Salva Modifiche
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={inj.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          inj.status === 'recuperato'
                            ? 'bg-[#0b0e14] border-slate-800 opacity-75'
                            : 'bg-rose-950/20 border-rose-800/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">{inj.title}</span>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  inj.status === 'recuperato'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {inj.status === 'recuperato'
                                  ? 'Guarito / Idoneo'
                                  : inj.status === 'in_recupero'
                                  ? 'In Riatletizzazione'
                                  : 'In Trattamento'}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 bg-[#11141d] text-slate-300 rounded border border-slate-800">
                                {inj.bodyPart} • {inj.injuryType}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              Data infortunio: <strong>{inj.dateReported}</strong>
                              {inj.expectedReturnDate && ` • Rientro stimato: ${inj.expectedReturnDate}`}
                              {inj.actualReturnDate && ` • Rientro effettivo: ${inj.actualReturnDate}`}
                            </p>
                            {inj.doctorDiagnosis && (
                              <p className="text-xs text-slate-300 mt-2 bg-[#11141d] p-2 rounded-lg border border-slate-800">
                                <strong>Diagnosi & Fisioterapia:</strong> {inj.doctorDiagnosis}
                              </p>
                            )}
                            {inj.physioNotes && (
                              <p className="text-xs text-slate-300 mt-1 bg-[#11141d] p-2 rounded-lg border border-slate-800">
                                <strong>Note Fisio:</strong> {inj.physioNotes}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isCoach && inj.status !== 'recuperato' && (
                              <button
                                id={`resolve-injury-${inj.id}`}
                                onClick={() => handleResolveInjury(inj.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Segna Guarito
                              </button>
                            )}
                            {isCoach && (
                              <button
                                onClick={() => {
                                  setEditingInjuryId(inj.id);
                                  setEditingInjury({ ...inj });
                                }}
                                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-950/30 rounded-xl transition-colors cursor-pointer"
                                title="Modifica infortunio"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isCoach && (
                              <button
                                onClick={() => handleDeleteInjury(inj.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                                title="Elimina record infortunio"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-[#0b0e14] rounded-2xl border border-slate-800">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-slate-300">Nessun infortunio registrato</p>
                  <p className="text-xs text-slate-500 mt-0.5">L'atleta è in perfette condizioni fisiche.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PHYSICAL PROGRESS OVER TIME */}
          {activeTab === 'physical' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    Evoluzione Atletica
                  </h3>
                </div>
                {isCoach && (
                  <button
                    id="add-physical-progress-button"
                    onClick={() => setShowAddPhysical(!showAddPhysical)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-md shadow-amber-500/20 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi Test Fisico
                  </button>
                )}
              </div>

              {/* Add Physical Test Form */}
              {showAddPhysical && (
                <div className="p-4 bg-[#0b0e14] border border-amber-500/30 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    Nuova Misurazione Atletica
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">Data Test</label>
                      <input
                        type="date"
                        value={newPhysical.date}
                        onChange={(e) => setNewPhysical({ ...newPhysical, date: e.target.value })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Salto in Attacco (cm)</label>
                      <input
                        type="number"
                        value={newPhysical.spikeReachCm === 0 || (newPhysical.spikeReachCm as any) === '' ? '' : newPhysical.spikeReachCm}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewPhysical({ ...newPhysical, spikeReachCm: e.target.value === '' ? '' as any : Number(e.target.value) })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Salto a Muro (cm)</label>
                      <input
                        type="number"
                        value={newPhysical.blockReachCm === 0 || (newPhysical.blockReachCm as any) === '' ? '' : newPhysical.blockReachCm}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewPhysical({ ...newPhysical, blockReachCm: e.target.value === '' ? '' as any : Number(e.target.value) })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Peso (kg)</label>
                      <input
                        type="number"
                        value={newPhysical.weightKg === 0 || (newPhysical.weightKg as any) === '' ? '' : newPhysical.weightKg}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewPhysical({ ...newPhysical, weightKg: e.target.value === '' ? '' as any : Number(e.target.value) })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-slate-400 mb-1">Note / Obiettivi</label>
                      <input
                        type="text"
                        placeholder="es. Ottimo incremento spinta esplosiva su pedana..."
                        value={newPhysical.notes}
                        onChange={(e) => setNewPhysical({ ...newPhysical, notes: e.target.value })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddPhysical(false)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPhysical}
                      className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl"
                    >
                      Salva Rilevazione
                    </button>
                  </div>
                </div>
              )}

              {/* Chart Component */}
              <div className="bg-[#0b0e14] p-5 rounded-2xl border border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Curva di Elevazione (cm)
                </h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(athlete.physicalProgress || []).map((p) => ({ ...p, date: formatDateDDMMYYYY(p.date) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                      <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={11} unit=" cm" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0b0e14',
                          borderColor: '#1e293b',
                          borderRadius: '12px',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Line
                        type="monotone"
                        dataKey="spikeReachCm"
                        name="Salto Attacco"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#f59e0b' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="blockReachCm"
                        name="Salto Muro"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#06b6d4' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Historical Records Table */}
              <div className="bg-[#0b0e14] rounded-2xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#11141d] text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Salto Attacco</th>
                      <th className="p-3">Salto Muro</th>
                      <th className="p-3">Peso</th>
                      <th className="p-3">Elevazione Netta</th>
                      <th className="p-3">Note</th>
                      {isCoach && <th className="p-3 text-right">Azione</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(!athlete.physicalProgress || athlete.physicalProgress.length === 0) ? (
                      <tr>
                        <td colSpan={isCoach ? 7 : 6} className="p-6 text-center text-slate-500 italic">
                          Nessuna rilevazione fisica registrata nello storico.
                        </td>
                      </tr>
                    ) : (
                      athlete.physicalProgress.map((p) => (
                        <tr key={p.id} className="hover:bg-[#11141d]/60">
                          <td className="p-3 font-semibold text-white">{formatDateDDMMYYYY(p.date)}</td>
                          <td className="p-3 font-bold text-amber-400">{p.spikeReachCm} cm</td>
                          <td className="p-3 font-bold text-cyan-400">{p.blockReachCm} cm</td>
                          <td className="p-3 text-slate-300">{p.weightKg} kg</td>
                          <td className="p-3 text-emerald-400 font-bold">+{p.spikeReachCm - athlete.heightCm} cm</td>
                          <td className="p-3 text-slate-400 italic">{p.notes || '-'}</td>
                          {isCoach && (
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleDeletePhysical(p.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                title="Elimina rilevazione"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: TECHNICAL EVALUATION (RADAR) */}
          {activeTab === 'technical' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Valutazione tecnica
                  </h3>
                </div>
                {isCoach && (
                  <button
                    id="add-eval-button"
                    onClick={() => setShowAddEval(!showAddEval)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-md shadow-amber-500/20 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nuova Valutazione
                  </button>
                )}
              </div>

              {/* Add Evaluation Form */}
              {showAddEval && (
                <div className="p-4 bg-[#0b0e14] border border-amber-500/30 rounded-2xl space-y-4 text-xs">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    Inserisci Nuova Valutazione Tecnica
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Battuta (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        value={newEval.serveRating}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewEval({ ...newEval, serveRating: Number(e.target.value) })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Ricezione (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        value={newEval.receptionRating}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewEval({ ...newEval, receptionRating: Number(e.target.value) })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Palleggio/Alzata (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        value={newEval.setRating}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewEval({ ...newEval, setRating: Number(e.target.value) })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Attacco (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        value={newEval.attackRating}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewEval({ ...newEval, attackRating: Number(e.target.value) })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Muro (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        value={newEval.blockRating}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewEval({ ...newEval, blockRating: Number(e.target.value) })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Difesa (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        value={newEval.defenseRating}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewEval({ ...newEval, defenseRating: Number(e.target.value) })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Tattica / Visione (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        value={newEval.tacticalIQRating}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewEval({ ...newEval, tacticalIQRating: Number(e.target.value) })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Valutatore</label>
                      <input
                        type="text"
                        value={newEval.evaluatorName}
                        onChange={(e) => setNewEval({ ...newEval, evaluatorName: e.target.value })}
                        className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Note di Sintesi del Coach</label>
                    <textarea
                      rows={2}
                      value={newEval.notes}
                      onChange={(e) => setNewEval({ ...newEval, notes: e.target.value })}
                      placeholder="Commenti sul rendimento tecnico..."
                      className="w-full bg-[#11141d] border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddEval(false)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleAddEval}
                      className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl"
                    >
                      Salva Valutazione
                    </button>
                  </div>
                </div>
              )}

              {/* Radar Chart and Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#0b0e14] p-5 rounded-2xl border border-slate-800 flex flex-col items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Radar dei Fondamentali
                  </h4>
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#1e293b" />
                        <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} stroke="#475569" tick={{ fontSize: 9 }} />
                        <Radar
                          name="Valutazione"
                          dataKey="score"
                          stroke="#f59e0b"
                          fill="#f59e0b"
                          fillOpacity={0.35}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#0b0e14] p-5 rounded-2xl border border-slate-800 space-y-4 text-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Ultima Valutazione Tecnica
                    </h4>

                    {latestEval ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-slate-400 text-[11px] pb-2 border-b border-slate-800">
                          <span>Data: <strong className="text-white">{formatDateDDMMYYYY(latestEval.date)}</strong></span>
                          <span>Valutatore: <strong className="text-amber-400">{latestEval.evaluatorName}</strong></span>
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center text-[11px]">
                          <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800/80">
                            <span className="block text-slate-500 text-[10px]">Battuta</span>
                            <span className="font-bold text-amber-400">{latestEval.serveRating}/10</span>
                          </div>
                          <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800/80">
                            <span className="block text-slate-500 text-[10px]">Ricezione</span>
                            <span className="font-bold text-amber-400">{latestEval.receptionRating}/10</span>
                          </div>
                          <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800/80">
                            <span className="block text-slate-500 text-[10px]">Palleggio</span>
                            <span className="font-bold text-amber-400">{latestEval.setRating}/10</span>
                          </div>
                          <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800/80">
                            <span className="block text-slate-500 text-[10px]">Attacco</span>
                            <span className="font-bold text-amber-400">{latestEval.attackRating}/10</span>
                          </div>
                          <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800/80">
                            <span className="block text-slate-500 text-[10px]">Muro</span>
                            <span className="font-bold text-amber-400">{latestEval.blockRating}/10</span>
                          </div>
                          <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800/80">
                            <span className="block text-slate-500 text-[10px]">Difesa</span>
                            <span className="font-bold text-amber-400">{latestEval.defenseRating}/10</span>
                          </div>
                          <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800/80 col-span-2 sm:col-span-2">
                            <span className="block text-slate-500 text-[10px]">Tattica / Visione</span>
                            <span className="font-bold text-amber-400">{latestEval.tacticalIQRating}/10</span>
                          </div>
                        </div>

                        {latestEval.notes ? (
                          <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                              Note del Coach
                            </span>
                            <p className="text-slate-300 italic">{latestEval.notes}</p>
                          </div>
                        ) : null}

                        {isCoach && (
                          <div className="pt-2 flex justify-end">
                            <button
                              onClick={() => handleDeleteEval(latestEval.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg text-xs transition-colors cursor-pointer"
                              title="Elimina scheda di valutazione"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Elimina questa valutazione
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">Nessuna valutazione tecnica registrata.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Storico Valutazioni Tecniche nel Tempo */}
              <div className="bg-[#0b0e14] p-5 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Storico Valutazioni Tecniche
                </h4>

                {(!athlete.technicalEvaluations || athlete.technicalEvaluations.length === 0) ? (
                  <div className="p-6 text-center text-slate-500 italic">
                    Nessuna valutazione registrata nello storico.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {athlete.technicalEvaluations.map((evalItem) => {
                      const avgScore = (
                        (evalItem.serveRating +
                          evalItem.receptionRating +
                          evalItem.setRating +
                          evalItem.attackRating +
                          evalItem.blockRating +
                          evalItem.defenseRating +
                          evalItem.tacticalIQRating) / 7
                      ).toFixed(1);

                      return (
                        <div
                          key={evalItem.id}
                          className="p-4 bg-[#11141d] rounded-xl border border-slate-800/80 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg">
                                {formatDateDDMMYYYY(evalItem.date)}
                              </span>
                              <span className="text-xs text-slate-400">
                                Valutatore: <strong className="text-slate-200">{evalItem.evaluatorName}</strong>
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                                Media: {avgScore}/10
                              </span>
                              {isCoach && (
                                <button
                                  onClick={() => handleDeleteEval(evalItem.id)}
                                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                  title="Elimina valutazione"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Fundamentals ratings */}
                          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-center text-[11px] pt-1">
                            <div className="bg-[#0b0e14] p-1.5 rounded-lg border border-slate-800/60">
                              <span className="block text-slate-500 text-[10px]">Bat</span>
                              <span className="font-semibold text-slate-200">{evalItem.serveRating}</span>
                            </div>
                            <div className="bg-[#0b0e14] p-1.5 rounded-lg border border-slate-800/60">
                              <span className="block text-slate-500 text-[10px]">Ric</span>
                              <span className="font-semibold text-slate-200">{evalItem.receptionRating}</span>
                            </div>
                            <div className="bg-[#0b0e14] p-1.5 rounded-lg border border-slate-800/60">
                              <span className="block text-slate-500 text-[10px]">Alz</span>
                              <span className="font-semibold text-slate-200">{evalItem.setRating}</span>
                            </div>
                            <div className="bg-[#0b0e14] p-1.5 rounded-lg border border-slate-800/60">
                              <span className="block text-slate-500 text-[10px]">Att</span>
                              <span className="font-semibold text-slate-200">{evalItem.attackRating}</span>
                            </div>
                            <div className="bg-[#0b0e14] p-1.5 rounded-lg border border-slate-800/60">
                              <span className="block text-slate-500 text-[10px]">Mur</span>
                              <span className="font-semibold text-slate-200">{evalItem.blockRating}</span>
                            </div>
                            <div className="bg-[#0b0e14] p-1.5 rounded-lg border border-slate-800/60">
                              <span className="block text-slate-500 text-[10px]">Dif</span>
                              <span className="font-semibold text-slate-200">{evalItem.defenseRating}</span>
                            </div>
                            <div className="bg-[#0b0e14] p-1.5 rounded-lg border border-slate-800/60">
                              <span className="block text-slate-500 text-[10px]">Tat</span>
                              <span className="font-semibold text-slate-200">{evalItem.tacticalIQRating}</span>
                            </div>
                          </div>

                          {/* Coach Notes */}
                          {evalItem.notes ? (
                            <div className="text-xs text-slate-300 italic pt-1 border-t border-slate-800/50">
                              <span className="text-[10px] text-slate-400 font-bold uppercase not-italic block mb-0.5">
                                Note del Coach:
                              </span>
                              {evalItem.notes}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 italic pt-1 border-t border-slate-800/50">
                              Nessuna nota aggiuntiva.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: ATTENDANCE HISTORY */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    Registro Presenze agli Allenamenti
                  </h3>
                  <p className="text-xs text-slate-400">
                    Frequenza complessiva: <strong className="text-emerald-400">{attendanceRate}%</strong> ({presentCount} presenze su {totalCompletedTrainings} sessioni completate)
                  </p>
                </div>
              </div>

              <div className="bg-[#0b0e14] rounded-2xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#11141d] text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Data & Orario</th>
                      <th className="p-3">Sessione / Obiettivo</th>
                      <th className="p-3">Iscrizione</th>
                      <th className="p-3">Stato Presenza</th>
                      <th className="p-3">Note Coach</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {athleteAttendances.map((item) => (
                      <tr key={item.training.id} className="hover:bg-[#11141d]/60">
                        <td className="p-3 font-semibold text-white">
                          <div>{item.training.date}</div>
                          <span className="text-[10px] text-slate-400">{item.training.startTime} - {item.training.endTime}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-200 block">{item.training.title}</span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-xs">{item.training.objective}</span>
                        </td>
                        <td className="p-3">
                          {item.isRegistered ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30">
                              Iscritto
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">Non iscritto</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${
                              item.status === 'presente'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : item.status === 'assente'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : item.status === 'giustificato'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : item.status === 'infortunato'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 italic">
                          {item.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: CONVOCAZIONI */}
          {activeTab === 'convocazioni' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                Storia Convocazioni
              </h3>
              <div className="bg-[#0b0e14] rounded-2xl border border-slate-800 p-6 text-center text-slate-500 italic">
                La funzionalità di storico convocazioni sarà implementata a breve.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
