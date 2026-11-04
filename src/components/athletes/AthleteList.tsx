import React, { useState, useRef } from 'react';
import { Athlete, AthleteRole, AthleteStatus, TrainingSession } from '../../types';
import { AthleteCard, getRoleColor } from './AthleteCard';
import { AthleteDetailModal } from './AthleteDetailModal';
import {
  Users,
  Search,
  Filter,
  Plus,
  LayoutGrid,
  List,
  Sparkles,
  Award,
  Zap,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  Activity,
  HeartPulse,
  Upload,
  Camera,
  User,
  Shield,
  FileText,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useDialog } from '../../context/DialogContext';
import { useAuth } from '../../context/AuthContext';

import {
  checkAthleteDuplicates,
  getWhatsAppLink,
  normalizePhoneDisplay,
  isValidFiscalCode,
  isValidEmail,
} from '../../lib/athleteValidation';

interface AthleteListProps {
  athletes: Athlete[];
  trainings: TrainingSession[];
  onSaveAthlete: (athlete: Athlete) => Promise<void>;
  onDeleteAthlete?: (athleteId: string) => Promise<void>;
  isCoach: boolean;
}

export const AthleteList: React.FC<AthleteListProps> = ({
  athletes,
  trainings,
  onSaveAthlete,
  onDeleteAthlete,
  isCoach: isCoachProp,
}) => {
  const { showToast, confirm } = useDialog();
  const { isStaff } = useAuth();
  const isCoach = isCoachProp || isStaff;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'jersey' | 'name' | 'spike' | 'points'>('jersey');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Selected athlete for modal
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);

  const getEmptyAthleteForm = (): Partial<Athlete> => ({
    firstName: '',
    lastName: '',
    fiscalCode: '',
    jerseyNumber: '' as any,
    role: '' as any,
    secondaryRole: undefined,
    birthDate: '',
    heightCm: '' as any,
    weightKg: '' as any,
    spikeReachCm: '' as any,
    blockReachCm: '' as any,
    medicalCertExpiry: '',
    medicalCertValid: true,
    phone: '',
    email: '',
    photoUrl: '',
    status: '' as any,
    category: '',
    notes: '',
  });

  // New Athlete Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAthleteData, setNewAthleteData] = useState<Partial<Athlete>>(getEmptyAthleteForm());

  const handleOpenAddModal = () => {
    setNewAthleteData(getEmptyAthleteForm());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setNewAthleteData(getEmptyAthleteForm());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calculate realtime duplicate checks for form warnings
  const addModalDupCheck = checkAthleteDuplicates(newAthleteData, athletes);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setNewAthleteData((prev) => ({ ...prev, photoUrl: dataUrl }));
          showToast({ message: 'Foto avatar caricata con successo!', type: 'success' });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Filter and Sort Logic
  const filteredAthletes = athletes
    .filter((a) => {
      const matchesSearch =
        a.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.fiscalCode && a.fiscalCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        a.jerseyNumber.toString().includes(searchQuery);

      const matchesRole = selectedRole === 'all' || a.role === selectedRole;
      const matchesStatus = selectedStatus === 'all' || a.status === selectedStatus;

      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'jersey') return a.jerseyNumber - b.jerseyNumber;
      if (sortBy === 'name') return a.lastName.localeCompare(b.lastName);
      if (sortBy === 'spike') return b.spikeReachCm - a.spikeReachCm;
      if (sortBy === 'points') return (b.stats?.totalPoints || 0) - (a.stats?.totalPoints || 0);
      return 0;
    });

  // Quick stats summary
  const totalCount = athletes.length;
  const activeCount = athletes.filter((a) => a.status === 'attivo').length;
  const injuredCount = athletes.filter((a) => a.status === 'infortunato' || a.status === 'in_recupero').length;
  const avgHeight = Math.round(athletes.reduce((acc, a) => acc + a.heightCm, 0) / (athletes.length || 1));
  const maxBlock = Math.max(...athletes.map((a) => a.blockReachCm), 0);

  const handleCreateAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAthleteData.firstName || !newAthleteData.lastName) return;

    const rawPhone = newAthleteData.phone?.trim() || '';
    const phoneDigits = rawPhone.replace(/\D/g, '');
    if (!rawPhone || phoneDigits.length < 8) {
      showToast({
        message: 'Il numero di telefono cellulare è obbligatorio (minimo 8 cifre).',
        type: 'warning',
      });
      return;
    }

    const cf = newAthleteData.fiscalCode?.trim().toUpperCase() || '';
    if (cf && !isValidFiscalCode(cf)) {
      showToast({
        message: 'Il Codice Fiscale inserito non è valido (deve essere di 16 caratteri alfanumerici, es. RSSMRA85M01H501Z).',
        type: 'warning',
      });
      return;
    }

    const email = newAthleteData.email?.trim() || '';
    if (email && !isValidEmail(email)) {
      showToast({
        message: 'L\'indirizzo email inserito non è valido (es. atleta@dominio.it).',
        type: 'warning',
      });
      return;
    }

    if (addModalDupCheck.hasDuplicate) {
      showToast({
        message: `Impossibile salvare: ${addModalDupCheck.summaryMessages.join(' | ')}`,
        type: 'error',
      });
      return;
    }

    const normalizedPhone = normalizePhoneDisplay(rawPhone);

    const newAthlete: Athlete = {
      id: `ath-${Date.now()}`,
      firstName: newAthleteData.firstName?.trim() || '',
      lastName: newAthleteData.lastName?.trim() || '',
      fiscalCode: newAthleteData.fiscalCode?.trim().toUpperCase() || '',
      jerseyNumber: Number(newAthleteData.jerseyNumber) || 1,
      role: (newAthleteData.role as AthleteRole) || 'Schiacciatore',
      birthDate: newAthleteData.birthDate || '2002-01-01',
      heightCm: Number(newAthleteData.heightCm) || 190,
      weightKg: Number(newAthleteData.weightKg) || 80,
      spikeReachCm: Number(newAthleteData.spikeReachCm) || 330,
      blockReachCm: Number(newAthleteData.blockReachCm) || 310,
      medicalCertExpiry: newAthleteData.medicalCertExpiry || '2027-01-01',
      medicalCertValid: true,
      phone: normalizedPhone,
      email: newAthleteData.email || '',
      photoUrl:
        newAthleteData.photoUrl ||
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
      status: (newAthleteData.status as AthleteStatus) || 'attivo',
      category: newAthleteData.category || 'Serie C Maschile',
      notes: newAthleteData.notes || '',
      stats: {
        matchesPlayed: 0,
        setsPlayed: 0,
        totalPoints: 0,
        aces: 0,
        serveErrors: 0,
        attackKills: 0,
        attackErrors: 0,
        attackAttempts: 0,
        blockPoints: 0,
        blockTouches: 0,
        receptionTotal: 0,
        receptionPerfect: 0,
        receptionErrors: 0,
        digsTotal: 0,
      },
      physicalProgress: [
        {
          id: `prog-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          weightKg: Number(newAthleteData.weightKg) || 80,
          spikeReachCm: Number(newAthleteData.spikeReachCm) || 330,
          blockReachCm: Number(newAthleteData.blockReachCm) || 310,
          verticalJumpCm: (Number(newAthleteData.spikeReachCm) || 330) - (Number(newAthleteData.heightCm) || 190),
          notes: 'Test iniziale ingresso in rosa',
        },
      ],
      technicalEvaluations: [],
      injuries: [],
    };

    await onSaveAthlete(newAthlete);
    showToast({
      message: `Atleta #${newAthlete.jerseyNumber} ${newAthlete.firstName} ${newAthlete.lastName} registrato con successo!`,
      type: 'success',
    });
    handleCloseAddModal();
    setSelectedAthlete(newAthlete);
  };

  const handleDeleteAthleteConfirm = async (e: React.MouseEvent, ath: Athlete) => {
    e.stopPropagation();
    if (!onDeleteAthlete) return;
    const confirmed = await confirm({
      title: 'Elimina Atleta',
      message: `Sei sicuro di voler eliminare definitivamente ${ath.firstName} ${ath.lastName} (#${ath.jerseyNumber}) dalla rosa?`,
      confirmText: 'Sì, Elimina',
      cancelText: 'Annulla',
      type: 'danger' as const,
    });
    if (confirmed) {
      await onDeleteAthlete(ath.id);
      showToast({
        message: `Atleta ${ath.firstName} ${ath.lastName} eliminato con successo`,
        type: 'info',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Summary */}
      <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white font-display tracking-tight">
                Elenco Atleti
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
                {athletes.length === 1 ? '1 Giocatore in Rosa' : `${athletes.length} Giocatori in Rosa`}
              </span>
            </div>
          </div>

          {isCoach && (
            <button
              id="open-add-athlete-modal-button"
              onClick={handleOpenAddModal}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-102"
            >
              <Plus className="w-4 h-4" />
              Nuovo Atleta
            </button>
          )}
        </div>

        {/* Quick KPI Cards Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-3 p-3 bg-[#0b0e14]/80 rounded-2xl border border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Idonei</span>
              <span className="text-base font-bold text-white">{activeCount} / {totalCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-[#0b0e14]/80 rounded-2xl border border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <HeartPulse className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Infortunati</span>
              <span className="text-base font-bold text-rose-400">{injuredCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-[#0b0e14]/80 rounded-2xl border border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Altezza Media Squadra</span>
              <span className="text-base font-bold text-white">{avgHeight} cm</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-[#0b0e14]/80 rounded-2xl border border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Picco Salto Muro</span>
              <span className="text-base font-bold text-cyan-400">{maxBlock} cm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#11141d] border border-slate-800 p-3 rounded-2xl">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="search-athletes-input"
            type="text"
            placeholder="Cerca per nome, cognome o numero di maglia..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* Role Filter */}
          <select
            id="filter-role-select"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Tutti i Ruoli</option>
            <option value="Schiacciatore">Schiacciatori</option>
            <option value="Opposto">Opposti</option>
            <option value="Centrale">Centrali</option>
            <option value="Palleggiatore">Palleggiatori</option>
            <option value="Libero">Liberi</option>
          </select>

          {/* Status Filter */}
          <select
            id="filter-status-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Tutti gli Stati</option>
            <option value="attivo">Idoneo</option>
            <option value="infortunato">Infortunato</option>
          </select>

          {/* Sort By */}
          <select
            id="sort-athletes-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="jersey">Ordina: N° Maglia</option>
            <option value="name">Ordina: Cognome</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-[#0b0e14] border border-slate-800 rounded-xl p-1 shrink-0">
            <button
              id="view-mode-grid"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Vista Griglia Schede"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              id="view-mode-table"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Vista Tabella Dettagliata"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Athletes List (Grid or Table) */}
      {filteredAthletes.length === 0 ? (
        <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-12 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Nessun atleta trovato</h3>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAthletes.map((athlete) => (
            <AthleteCard
              key={athlete.id}
              athlete={athlete}
              onSelect={(ath) => setSelectedAthlete(ath)}
              isCoach={isCoach}
              onDelete={onDeleteAthlete ? handleDeleteAthleteConfirm : undefined}
            />
          ))}
        </div>
      ) : (
        /* Detailed Table View */
        <div className="bg-[#11141d] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b0e14] text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">N° / Atleta</th>
                  <th className="p-3.5">Ruolo</th>
                  <th className="p-3.5">Fisico (Altezza/Peso)</th>
                  <th className="p-3.5">CERTIFICATO MEDICO</th>
                  <th className="p-3.5">STATO</th>
                  <th className="p-3.5 text-right">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAthletes.map((ath) => (
                  <tr
                    key={ath.id}
                    onClick={() => setSelectedAthlete(ath)}
                    className="hover:bg-[#161b26] cursor-pointer transition-colors"
                  >
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-[#0b0e14] text-amber-400 font-black text-xs flex items-center justify-center border border-slate-800">
                          #{ath.jerseyNumber}
                        </span>
                        <img
                          src={ath.photoUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80'}
                          alt={ath.lastName}
                          className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-700"
                        />
                        <div>
                          <span className="font-bold text-white block">
                            {ath.firstName} {ath.lastName}
                          </span>
                          {ath.phone ? (
                            <a
                              href={getWhatsAppLink(ath.phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium transition-all group hover:border-emerald-500/60 shadow-sm mt-1 cursor-pointer"
                              title={`Invia messaggio WhatsApp a ${ath.firstName} (${ath.phone})`}
                            >
                              <svg
                                className="w-3 h-3 fill-current shrink-0 text-emerald-400 group-hover:scale-110 transition-transform"
                                viewBox="0 0 24 24"
                              >
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.893 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                              </svg>
                              <span className="font-mono">{ath.phone}</span>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ${getRoleColor(ath.role)}`}>
                        {ath.role}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-300">
                      {ath.heightCm} cm • {ath.weightKg} kg
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                          new Date(ath.medicalCertExpiry) >= new Date()
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {new Date(ath.medicalCertExpiry) >= new Date() ? 'CERT.VALIDO' : 'CERT.NON VALIDO'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                          ath.status === 'attivo'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {ath.status === 'attivo' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            IDONEO
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            INFORTUNATO
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAthlete(ath);
                          }}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Modifica"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteAthlete && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAthleteConfirm(e, ath)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Elimina atleta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Athlete Detail Modal */}
      {selectedAthlete && (
        <AthleteDetailModal
          athlete={selectedAthlete}
          trainings={trainings}
          isOpen={Boolean(selectedAthlete)}
          onClose={() => setSelectedAthlete(null)}
          onSave={async (updated) => {
            await onSaveAthlete(updated);
            setSelectedAthlete(updated);
          }}
          onDelete={async (athleteId) => {
            setSelectedAthlete(null);
            if (onDeleteAthlete) {
              await onDeleteAthlete(athleteId);
            }
          }}
          isCoach={isCoach}
        />
      )}

      {/* Add New Athlete Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={handleCloseAddModal}
        >
          <div
            id="add-athlete-modal"
            className="bg-[#11141d] border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shrink-0 p-5 bg-[#0b0e14]/80 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-amber-400" />
                  Aggiungi Nuovo Giocatore in Rosa
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseAddModal}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                title="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content - Scrollable */}
            <form onSubmit={handleCreateAthlete} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
                
                {/* CATEGORIA 1: Anagrafica e Ruolo */}
                <div className="bg-[#0b0e14] p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 pb-2 border-b border-slate-800/60">
                    <User className="w-4 h-4 text-amber-400" />
                    1. Dati Anagrafici & Ruolo
                  </h3>
                  {addModalDupCheck.hasDuplicate && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-[11px] space-y-1">
                      <strong className="block font-bold">⚠️ Rilevati dati duplicati:</strong>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {addModalDupCheck.summaryMessages.map((msg, idx) => (
                          <li key={idx}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Nome *</label>
                      <input
                        type="text"
                        required
                        placeholder="es. Marco"
                        value={newAthleteData.firstName || ''}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, firstName: e.target.value })}
                        className={`w-full h-10 bg-[#11141d] border rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none ${
                          addModalDupCheck.duplicateFields.fullName ? 'border-rose-500/80' : 'border-slate-700/80 focus:border-amber-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Cognome *</label>
                      <input
                        type="text"
                        required
                        placeholder="es. Bianchi"
                        value={newAthleteData.lastName || ''}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, lastName: e.target.value })}
                        className={`w-full h-10 bg-[#11141d] border rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none ${
                          addModalDupCheck.duplicateFields.fullName ? 'border-rose-500/80' : 'border-slate-700/80 focus:border-amber-500'
                        }`}
                      />
                      {addModalDupCheck.duplicateFields.fullName && (
                        <p className="text-[10px] text-rose-400 mt-1">{addModalDupCheck.duplicateFields.fullName}</p>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-400 font-medium">Codice Fiscale</label>
                        {newAthleteData.fiscalCode && isValidFiscalCode(newAthleteData.fiscalCode) && (
                          <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                            <CheckCircle className="w-3 h-3" /> Valido
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="es. BNCMRC02A01H501U"
                        value={newAthleteData.fiscalCode || ''}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, fiscalCode: e.target.value.toUpperCase() })}
                        className={`w-full h-10 bg-[#11141d] border rounded-xl px-3 py-2 text-white placeholder-slate-600 uppercase focus:outline-none ${
                          addModalDupCheck.duplicateFields.fiscalCode || (newAthleteData.fiscalCode && !isValidFiscalCode(newAthleteData.fiscalCode))
                            ? 'border-rose-500/80 focus:border-rose-500'
                            : 'border-slate-700/80 focus:border-amber-500'
                        }`}
                      />
                      {addModalDupCheck.duplicateFields.fiscalCode && (
                        <p className="text-[10px] text-rose-400 mt-1">{addModalDupCheck.duplicateFields.fiscalCode}</p>
                      )}
                      {newAthleteData.fiscalCode && !isValidFiscalCode(newAthleteData.fiscalCode) && !addModalDupCheck.duplicateFields.fiscalCode && (
                        <p className="text-[10px] text-rose-400 mt-1">Formato non valido (16 caratteri alfanumerici, es. RSSMRA85M01H501Z)</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Data di Nascita</label>
                      <input
                        type="date"
                        value={newAthleteData.birthDate || ''}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, birthDate: e.target.value })}
                        className="w-full h-10 bg-[#11141d] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Numero Maglia *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="99"
                        value={newAthleteData.jerseyNumber === 0 || (newAthleteData.jerseyNumber as any) === '' ? '' : newAthleteData.jerseyNumber}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, jerseyNumber: e.target.value === '' ? '' as any : Number(e.target.value) })}
                        className={`w-full h-10 bg-[#11141d] border rounded-xl px-3 py-2 text-white focus:outline-none ${
                          addModalDupCheck.duplicateFields.jerseyNumber ? 'border-rose-500/80' : 'border-slate-700/80 focus:border-amber-500'
                        }`}
                      />
                      {addModalDupCheck.duplicateFields.jerseyNumber && (
                        <p className="text-[10px] text-rose-400 mt-1">{addModalDupCheck.duplicateFields.jerseyNumber}</p>
                      )}
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-slate-400 mb-1 font-medium">Ruolo Principale *</label>
                      <select
                        value={newAthleteData.role || ''}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, role: e.target.value as AthleteRole })}
                        className="w-full h-10 bg-[#11141d] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Seleziona ruolo...</option>
                        <option value="Schiacciatore">Schiacciatore / Banda</option>
                        <option value="Opposto">Opposto</option>
                        <option value="Centrale">Centrale</option>
                        <option value="Palleggiatore">Palleggiatore</option>
                        <option value="Libero">Libero</option>
                      </select>
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-slate-400 mb-1 font-medium">Ruolo Secondario</label>
                      <select
                        value={newAthleteData.secondaryRole || ''}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, secondaryRole: e.target.value as AthleteRole })}
                        className="w-full h-10 bg-[#11141d] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Nessuno</option>
                        <option value="Schiacciatore">Schiacciatore / Banda</option>
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
                      <label className="block text-slate-400 mb-1 font-medium">Stato Idoneità *</label>
                      <select
                        value={newAthleteData.status || ''}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, status: e.target.value as AthleteStatus })}
                        className="w-full h-10 bg-[#11141d] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Seleziona stato...</option>
                        <option value="attivo">Idoneo</option>
                        <option value="infortunato">Infortunato</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Scadenza Visita Medica</label>
                      <input
                        type="date"
                        value={newAthleteData.medicalCertExpiry || ''}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, medicalCertExpiry: e.target.value })}
                        className="w-full h-10 bg-[#11141d] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-400 font-medium">Telefono Cellulare *</label>
                        {newAthleteData.phone && newAthleteData.phone.replace(/\D/g, '').length >= 8 && (
                          <a
                            href={getWhatsAppLink(newAthleteData.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-medium"
                            title="Test link WhatsApp"
                          >
                            <svg className="w-3 h-3 fill-current shrink-0" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                            </svg>
                            WhatsApp
                          </a>
                        )}
                      </div>
                      <input
                        type="tel"
                        required
                        placeholder="es. 340 1234567 oppure +39 340..."
                        value={newAthleteData.phone || ''}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, phone: e.target.value })}
                        className={`w-full h-10 bg-[#11141d] border rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none ${
                          addModalDupCheck.duplicateFields.phone ? 'border-rose-500/80' : 'border-slate-700/80 focus:border-amber-500'
                        }`}
                      />
                      {addModalDupCheck.duplicateFields.phone && (
                        <p className="text-[10px] text-rose-400 mt-1">{addModalDupCheck.duplicateFields.phone}</p>
                      )}
                      {newAthleteData.phone && newAthleteData.phone.replace(/\D/g, '').length >= 8 && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          Normalizzazione: <span className="text-amber-400 font-mono font-bold">{normalizePhoneDisplay(newAthleteData.phone)}</span>
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-400 font-medium">Email</label>
                        {newAthleteData.email && isValidEmail(newAthleteData.email) && (
                          <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                            <CheckCircle className="w-3 h-3" /> Email valida
                          </span>
                        )}
                      </div>
                      <input
                        type="email"
                        placeholder="es. atleta@email.it"
                        value={newAthleteData.email || ''}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, email: e.target.value })}
                        className={`w-full h-10 bg-[#11141d] border rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none ${
                          newAthleteData.email && !isValidEmail(newAthleteData.email)
                            ? 'border-rose-500/80 focus:border-rose-500'
                            : 'border-slate-700/80 focus:border-amber-500'
                        }`}
                      />
                      {newAthleteData.email && !isValidEmail(newAthleteData.email) && (
                        <p className="text-[10px] text-rose-400 mt-1">Formato email non valido (es. atleta@societa.it)</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* CATEGORIA 3: Parametri Fisici e Elevazione */}
                <div className="bg-[#0b0e14] p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2 pb-2 border-b border-slate-800/60">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    3. Parametri Fisici & Elevazione
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Altezza (cm)</label>
                      <input
                        type="number"
                        value={newAthleteData.heightCm === 0 || (newAthleteData.heightCm as any) === '' ? '' : newAthleteData.heightCm}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, heightCm: e.target.value === '' ? '' as any : Number(e.target.value) })}
                        className="w-full h-10 bg-[#11141d] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Peso (kg)</label>
                      <input
                        type="number"
                        value={newAthleteData.weightKg === 0 || (newAthleteData.weightKg as any) === '' ? '' : newAthleteData.weightKg}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, weightKg: e.target.value === '' ? '' as any : Number(e.target.value) })}
                        className="w-full h-10 bg-[#11141d] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Salto Attacco (cm)</label>
                      <input
                        type="number"
                        value={newAthleteData.spikeReachCm === 0 || (newAthleteData.spikeReachCm as any) === '' ? '' : newAthleteData.spikeReachCm}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, spikeReachCm: e.target.value === '' ? '' as any : Number(e.target.value) })}
                        className="w-full h-10 bg-[#11141d] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Salto Muro (cm)</label>
                      <input
                        type="number"
                        value={newAthleteData.blockReachCm === 0 || (newAthleteData.blockReachCm as any) === '' ? '' : newAthleteData.blockReachCm}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, blockReachCm: e.target.value === '' ? '' as any : Number(e.target.value) })}
                        className="w-full h-10 bg-[#11141d] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
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
                        ref={fileInputRef}
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <div className="flex items-center gap-3">
                        <img
                          src={newAthleteData.photoUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'}
                          alt="Preview Avatar"
                          className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-700 shrink-0"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 px-3.5 py-2 bg-[#161b26] hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          Carica Foto JPG / PNG
                        </button>
                        <span className="text-[11px] text-slate-500 hidden sm:inline">
                          Seleziona un file dal tuo dispositivo
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Note Tecniche & Comportamentali</label>
                      <textarea
                        rows={2}
                        placeholder="Eventuali annotazioni dello staff tecnico sul giocatore..."
                        value={newAthleteData.notes || ''}
                        onChange={(e) => setNewAthleteData({ ...newAthleteData, notes: e.target.value })}
                        className="w-full bg-[#11141d] border border-slate-700/80 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="shrink-0 p-4 bg-[#0b0e14] border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-[#11141d] rounded-xl border border-slate-800 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-102"
                >
                  Salva Atleta in Rosa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
