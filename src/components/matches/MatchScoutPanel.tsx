import React, { useMemo, useState } from 'react';
import {
  Athlete,
  CourtZone,
  MatchEvent,
  MatchScoutSet,
  ScoutEvent,
  ScoutRating,
  ScoutSkill,
  ScoutSubstitution,
} from '../../types';
import {
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  LogOut,
  Maximize2,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useDialog } from '../../context/DialogContext';
import {
  updateMatchScoutSetAtomic,
  setMatchScoutPublishedAtomic,
} from '../../lib/db';

interface MatchScoutPanelProps {
  match: MatchEvent;
  athletes: Athlete[];
  canManage: boolean;
  onSaveMatch: (updatedMatch: MatchEvent) => Promise<void>;
  onSyncMatchState?: (updatedMatch: MatchEvent) => void;
}

const ZONES_COUNTER_CLOCKWISE: CourtZone[] = ['1', '2', '3', '4', '5', '6'];

const ZONE_DESCRIPTIONS: Record<CourtZone, string> = {
  '1': 'Posto 1 (Battuta / 2ª Linea Dx)',
  '2': 'Posto 2 (1ª Linea Dx)',
  '3': 'Posto 3 (1ª Linea Centro)',
  '4': 'Posto 4 (1ª Linea Sx)',
  '5': 'Posto 5 (2ª Linea Sx)',
  '6': 'Posto 6 (2ª Linea Centro)',
};

const SKILL_LABELS: Record<ScoutSkill, string> = {
  battuta: 'Battuta',
  ricezione: 'Ricezione',
  attacco: 'Attacco',
  muro: 'Muro',
};

const ALL_SKILLS: ScoutSkill[] = ['battuta', 'ricezione', 'attacco', 'muro'];
const LIBERO_SKILLS: ScoutSkill[] = ['ricezione'];

const RATING_CONFIG: Array<{
  value: ScoutRating;
  label: string;
  shortDesc: string;
  buttonClass: string;
  badgeClass: string;
}> = [
  {
    value: '#',
    label: 'Perfetto / Punto',
    shortDesc: 'Punto diretto o azione perfetta',
    buttonClass:
      'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border-emerald-500/50',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    value: '+',
    label: 'Sufficiente',
    shortDesc: 'Azione positiva / giocabile',
    buttonClass:
      'bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border-cyan-500/50',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
  {
    value: '-',
    label: 'Negativo',
    shortDesc: 'Azione imprecisa / difficoltosa',
    buttonClass:
      'bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border-amber-500/50',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    value: '=',
    label: 'Errore Punto',
    shortDesc: 'Errore diretto (punto avversario)',
    buttonClass:
      'bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border-rose-500/50',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
];

function isAthleteLibero(athlete: Athlete, match: MatchEvent): boolean {
  if (athlete.role === 'Libero') return true;
  const callUp = match.convocati?.find((c) => c.athleteId === athlete.id);
  return callUp?.roleInMatch === '1° Libero' || callUp?.roleInMatch === '2° Libero';
}

function computeCurrentOnCourt(
  startingLineup: Partial<Record<CourtZone, string>>,
  substitutions: ScoutSubstitution[]
): Partial<Record<CourtZone, string>> {
  const current: Partial<Record<CourtZone, string>> = { ...startingLineup };
  for (const sub of substitutions) {
    if (sub.zone && sub.inAthleteId) {
      current[sub.zone] = sub.inAthleteId;
    } else if (sub.outAthleteId && sub.inAthleteId) {
      const zoneEntry = ZONES_COUNTER_CLOCKWISE.find(
        (z) => current[z] === sub.outAthleteId
      );
      if (zoneEntry) {
        current[zoneEntry] = sub.inAthleteId;
      }
    }
  }
  return current;
}

interface SkillCounts {
  '#': number;
  '+': number;
  '-': number;
  '=': number;
  total: number;
}

function emptySkillCounts(): SkillCounts {
  return { '#': 0, '+': 0, '-': 0, '=': 0, total: 0 };
}

function summarizeEventsForAthlete(
  events: ScoutEvent[],
  athleteId: string
): Record<ScoutSkill, SkillCounts> {
  const result: Record<ScoutSkill, SkillCounts> = {
    battuta: emptySkillCounts(),
    ricezione: emptySkillCounts(),
    attacco: emptySkillCounts(),
    muro: emptySkillCounts(),
  };
  for (const ev of events) {
    if (ev.athleteId !== athleteId) continue;
    const bucket = result[ev.skill];
    if (!bucket) continue;
    bucket[ev.rating] = (bucket[ev.rating] || 0) + 1;
    bucket.total += 1;
  }
  return result;
}

export const MatchScoutPanel: React.FC<MatchScoutPanelProps> = ({
  match,
  athletes,
  canManage,
  onSaveMatch,
  onSyncMatchState,
}) => {
  const { confirm, showToast } = useDialog();

  const [activeSetNumber, setActiveSetNumber] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [subView, setSubView] = useState<'setup' | 'stats'>('setup');
  const [isLiveFullscreen, setIsLiveFullscreen] = useState(false);
  const [statsScope, setStatsScope] = useState<'set' | 'match'>('set');
  const [useFullRoster, setUseFullRoster] = useState<boolean>(
    (match.convocati?.length || 0) === 0
  );
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Quick substitution modal/drawer state (usable directly from Live court too)
  const [showSubModal, setShowSubModal] = useState(false);
  const [subOutAthleteId, setSubOutAthleteId] = useState('');
  const [subInAthleteId, setSubInAthleteId] = useState('');
  const [subScore, setSubScore] = useState('');
  const [subNote, setSubNote] = useState('');

  // Quick evaluation modal state when clicking an athlete on court
  const [evalTarget, setEvalTarget] = useState<{
    athlete: Athlete;
    zoneLabel: string;
    isLibero: boolean;
  } | null>(null);
  const [keepEvalOpen, setKeepEvalOpen] = useState(false);

  // Eligible roster pool (Convocati by default if present, or full roster)
  const eligibleAthletes = useMemo(() => {
    const calledUpIds = new Set((match.convocati || []).map((c) => c.athleteId));
    const list =
      !useFullRoster && calledUpIds.size > 0
        ? athletes.filter((a) => calledUpIds.has(a.id))
        : athletes;
    return [...list].sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  }, [athletes, match.convocati, useFullRoster]);

  const courtEligibleAthletes = useMemo(
    () => eligibleAthletes.filter((a) => !isAthleteLibero(a, match)),
    [eligibleAthletes, match]
  );

  const liberoEligibleAthletes = useMemo(
    () => eligibleAthletes.filter((a) => isAthleteLibero(a, match)),
    [eligibleAthletes, match]
  );

  // Default libero IDs from match convocati or roster
  const defaultLiberoIds = useMemo(
    () => liberoEligibleAthletes.slice(0, 2).map((a) => a.id),
    [liberoEligibleAthletes]
  );

  const currentSetData: MatchScoutSet = useMemo(() => {
    const found = (match.scoutSets || []).find(
      (s) => s.setNumber === activeSetNumber
    );
    if (found) {
      return {
        setNumber: found.setNumber,
        lineup: found.lineup || {},
        liberoIds: found.liberoIds || [],
        substitutions: found.substitutions || [],
        events: found.events || [],
      };
    }
    return {
      setNumber: activeSetNumber,
      lineup: {},
      liberoIds: defaultLiberoIds,
      substitutions: [],
      events: [],
    };
  }, [match.scoutSets, activeSetNumber, defaultLiberoIds]);

  const currentOnCourt = useMemo(
    () =>
      computeCurrentOnCourt(
        currentSetData.lineup,
        currentSetData.substitutions
      ),
    [currentSetData.lineup, currentSetData.substitutions]
  );

  const filledZonesCount = ZONES_COUNTER_CLOCKWISE.filter((z) =>
    Boolean(currentSetData.lineup[z])
  ).length;

  const activeOnCourtIds = useMemo(() => {
    const ids = new Set<string>();
    for (const z of ZONES_COUNTER_CLOCKWISE) {
      const id = currentOnCourt[z];
      if (id) ids.add(id);
    }
    return ids;
  }, [currentOnCourt]);

  const activeLiberos = useMemo(() => {
    const ids = new Set(currentSetData.liberoIds);
    return athletes
      .filter((a) => ids.has(a.id))
      .sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  }, [athletes, currentSetData.liberoIds]);

  const benchNonLiberoAthletes = useMemo(
    () => courtEligibleAthletes.filter((a) => !activeOnCourtIds.has(a.id)),
    [courtEligibleAthletes, activeOnCourtIds]
  );

  const saveSetUpdate = async (
    setNumber: 1 | 2 | 3 | 4 | 5,
    updater: (prev: MatchScoutSet) => MatchScoutSet
  ): Promise<boolean> => {
    try {
      const updated = await updateMatchScoutSetAtomic(
        match.id,
        setNumber,
        updater,
        defaultLiberoIds
      );
      if (onSyncMatchState) {
        onSyncMatchState(updated);
      } else {
        await onSaveMatch(updated);
      }
      return true;
    } catch {
      showToast({
        message: 'Errore di salvataggio dello scout nel database. Riprova.',
        type: 'error',
      });
      return false;
    }
  };

  // Lineup position update (P1 -> P6)
  const handleSetStartingZone = async (zone: CourtZone, athleteId: string) => {
    if (!canManage) return;
    await saveSetUpdate(activeSetNumber, (prev) => {
      const nextLineup = { ...prev.lineup };
      if (!athleteId) {
        delete nextLineup[zone];
      } else {
        // Prevent duplicate athlete across zones
        for (const z of ZONES_COUNTER_CLOCKWISE) {
          if (z !== zone && nextLineup[z] === athleteId) {
            delete nextLineup[z];
          }
        }
        nextLineup[zone] = athleteId;
      }
      return { ...prev, lineup: nextLineup };
    });
  };

  const handleToggleSetLibero = async (athleteId: string) => {
    if (!canManage) return;
    await saveSetUpdate(activeSetNumber, (prev) => {
      const exists = prev.liberoIds.includes(athleteId);
      const nextLiberos = exists
        ? prev.liberoIds.filter((id) => id !== athleteId)
        : [...prev.liberoIds, athleteId];
      return { ...prev, liberoIds: nextLiberos };
    });
  };

  const handleCopyPreviousSetLineup = async () => {
    if (!canManage || activeSetNumber <= 1) return;
    const prevSet = (match.scoutSets || []).find(
      (s) => s.setNumber === activeSetNumber - 1
    );
    if (!prevSet) return;
    const ok = await saveSetUpdate(activeSetNumber, (prev) => ({
      ...prev,
      lineup: { ...(prevSet.lineup || {}) },
      liberoIds:
        prevSet.liberoIds && prevSet.liberoIds.length > 0
          ? [...prevSet.liberoIds]
          : prev.liberoIds,
    }));
    if (ok) {
      showToast({
        message: `Formazione iniziale copiata dal Set ${activeSetNumber - 1}`,
        type: 'success',
      });
    }
  };

  // Register substitution
  const handleAddSubstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !subOutAthleteId || !subInAthleteId) return;

    const zone = ZONES_COUNTER_CLOCKWISE.find(
      (z) => currentOnCourt[z] === subOutAthleteId
    );
    if (!zone) {
      showToast({
        message: 'Seleziona un giocatore attualmente in campo da sostituire.',
        type: 'warning',
      });
      return;
    }

    const outAth = athletes.find((a) => a.id === subOutAthleteId);
    const inAth = athletes.find((a) => a.id === subInAthleteId);

    const newSub: ScoutSubstitution = {
      id: `sub-${Date.now()}`,
      zone,
      outAthleteId: subOutAthleteId,
      inAthleteId: subInAthleteId,
      scoreAtSub: subScore.trim() || undefined,
      note: subNote.trim() || undefined,
      timestamp: new Date().toISOString(),
    };

    const ok = await saveSetUpdate(activeSetNumber, (prev) => ({
      ...prev,
      substitutions: [...prev.substitutions, newSub],
    }));
    if (!ok) return;

    setSubOutAthleteId('');
    setSubInAthleteId('');
    setSubScore('');
    setSubNote('');
    setShowSubModal(false);

    showToast({
      message: `Cambio registrato in Posto ${zone}: esce #${outAth?.jerseyNumber ?? ''} ${outAth?.lastName ?? ''} → entra #${inAth?.jerseyNumber ?? ''} ${inAth?.lastName ?? ''}`,
      type: 'success',
    });
  };

  const handleRemoveSubstitution = async (subId: string) => {
    if (!canManage) return;
    const confirmed = await confirm({
      title: 'Annulla Sostituzione',
      message:
        'Vuoi eliminare questo cambio dallo storico del set? Il sestetto in campo verrà ricalcolato automaticamente.',
      confirmText: 'Elimina Cambio',
      cancelText: 'Annulla',
      type: 'warning',
    });
    if (!confirmed) return;

    const ok = await saveSetUpdate(activeSetNumber, (prev) => ({
      ...prev,
      substitutions: prev.substitutions.filter((s) => s.id !== subId),
    }));
    if (ok) {
      showToast({ message: 'Cambio rimosso e sestetto aggiornato', type: 'info' });
    }
  };

  // Record 1-tap Scout Rating
  const handleRecordRating = async (
    athlete: Athlete,
    skill: ScoutSkill,
    rating: ScoutRating
  ) => {
    if (!canManage) return;
    const newEvent: ScoutEvent = {
      id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      athleteId: athlete.id,
      skill,
      rating,
      timestamp: new Date().toISOString(),
    };

    const ok = await saveSetUpdate(activeSetNumber, (prev) => ({
      ...prev,
      events: [...prev.events, newEvent],
    }));
    if (!ok) return;

    showToast({
      message: `#${athlete.jerseyNumber} ${athlete.lastName} • ${SKILL_LABELS[skill]}: ${rating}`,
      type: rating === '=' ? 'warning' : 'success',
    });

    if (!keepEvalOpen) {
      setEvalTarget(null);
    }
  };

  const handleUndoLastEvent = async () => {
    if (!canManage || currentSetData.events.length === 0) return;
    const lastEv = currentSetData.events[currentSetData.events.length - 1];
    const ath = athletes.find((a) => a.id === lastEv.athleteId);

    const ok = await saveSetUpdate(activeSetNumber, (prev) => ({
      ...prev,
      events: prev.events.slice(0, -1),
    }));
    if (!ok) return;

    showToast({
      message: `Annullato ultimo tocco: #${ath?.jerseyNumber ?? ''} ${ath?.lastName ?? ''} (${SKILL_LABELS[lastEv.skill]} ${lastEv.rating})`,
      type: 'info',
    });
  };

  const handleResetSetScout = async () => {
    if (!canManage) return;
    const confirmed = await confirm({
      title: `Azzera Scout Set ${activeSetNumber}`,
      message: `Vuoi cancellare formazione, cambi e rilevazioni del Set ${activeSetNumber}? L'operazione riguarda solo questo set.`,
      confirmText: 'Sì, Azzera Set',
      cancelText: 'Annulla',
      type: 'danger',
    });
    if (!confirmed) return;

    const ok = await saveSetUpdate(activeSetNumber, () => ({
      setNumber: activeSetNumber,
      lineup: {},
      liberoIds: defaultLiberoIds,
      substitutions: [],
      events: [],
    }));
    if (ok) {
      showToast({ message: `Scout Set ${activeSetNumber} azzerato`, type: 'info' });
    }
  };

  // Events in scope for stats table
  const statsEvents = useMemo(() => {
    if (statsScope === 'set') return currentSetData.events;
    return (match.scoutSets || []).flatMap((s) => s.events || []);
  }, [statsScope, currentSetData.events, match.scoutSets]);

  const scoutedAthleteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ev of statsEvents) ids.add(ev.athleteId);
    for (const z of ZONES_COUNTER_CLOCKWISE) {
      if (currentSetData.lineup[z]) ids.add(currentSetData.lineup[z]!);
      if (currentOnCourt[z]) ids.add(currentOnCourt[z]!);
    }
    for (const lId of currentSetData.liberoIds) ids.add(lId);
    return ids;
  }, [statsEvents, currentSetData, currentOnCourt]);

  const statsAthletes = useMemo(
    () =>
      athletes
        .filter((a) => scoutedAthleteIds.has(a.id))
        .sort((a, b) => a.jerseyNumber - b.jerseyNumber),
    [athletes, scoutedAthleteIds]
  );

  const lastEvent =
    currentSetData.events.length > 0
      ? currentSetData.events[currentSetData.events.length - 1]
      : null;
  const lastEventAthlete = lastEvent
    ? athletes.find((a) => a.id === lastEvent.athleteId)
    : null;

  const totalMatchScoutEvents = useMemo(
    () =>
      (match.scoutSets || []).reduce(
        (acc, s) => acc + (s.events?.length || 0),
        0
      ),
    [match.scoutSets]
  );

  const isScoutPublished = Boolean(match.scoutPublishedToAthletes);

  const handleTogglePublishScout = async () => {
    if (!canManage) return;
    if (!isScoutPublished) {
      if (totalMatchScoutEvents === 0) {
        showToast({
          message:
            "Registra almeno un'azione prima di pubblicare la raccolta dati agli atleti.",
          type: 'warning',
        });
        return;
      }
      const confirmed = await confirm({
        title: 'Pubblica Raccolta Dati agli Atleti',
        message: `Vuoi pubblicare la raccolta dati totale (${totalMatchScoutEvents} azioni rilevate) rendendola visibile a tutti gli atleti nella scheda partita e nel Portale Atleta?`,
        confirmText: 'Pubblica agli Atleti',
        cancelText: 'Annulla',
        type: 'info',
      });
      if (!confirmed) return;

      try {
        const updated = await setMatchScoutPublishedAtomic(match.id, true);
        if (onSyncMatchState) {
          onSyncMatchState(updated);
        } else {
          await onSaveMatch(updated);
        }
        showToast({
          message: 'Raccolta dati scout pubblicata! Ora è visibile agli atleti.',
          type: 'success',
        });
      } catch {
        showToast({
          message: 'Errore nella pubblicazione dello scout su Firestore.',
          type: 'error',
        });
      }
    } else {
      const confirmed = await confirm({
        title: 'Nascondi Dati Scout agli Atleti',
        message:
          'Vuoi ritirare la pubblicazione? I dati scout torneranno visibili esclusivamente allo staff.',
        confirmText: 'Nascondi agli Atleti',
        cancelText: 'Annulla',
        type: 'warning',
      });
      if (!confirmed) return;

      try {
        const updated = await setMatchScoutPublishedAtomic(match.id, false);
        if (onSyncMatchState) {
          onSyncMatchState(updated);
        } else {
          await onSaveMatch(updated);
        }
        showToast({
          message: 'Dati scout impostati come privati per il solo staff.',
          type: 'info',
        });
      } catch {
        showToast({
          message: 'Errore durante l\'aggiornamento dello stato di pubblicazione su Firestore.',
          type: 'error',
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Scout Control Bar */}
      <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-amber-400" />
              Scout Semplificato di Partita
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Formazione P1→P6 in senso antiorario, cambi e raccolta dati live a schermo intero.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <button
                type="button"
                id="publish-scout-header-btn"
                onClick={handleTogglePublishScout}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  isScoutPublished
                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                    : 'bg-[#11141d] hover:bg-emerald-950/40 text-slate-200 hover:text-emerald-300 border-slate-700 hover:border-emerald-500/40'
                }`}
                title={
                  isScoutPublished
                    ? 'Dati pubblicati agli atleti — clicca per nascondere'
                    : 'Pubblica raccolta dati totale agli atleti'
                }
              >
                {isScoutPublished ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    Pubblicato agli Atleti
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-amber-400" />
                    Pubblica agli Atleti
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Guida Operatore
            </button>

            <button
              type="button"
              id="enter-live-scout-btn"
              onClick={() => setIsLiveFullscreen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Modalità Scout Live
            </button>
          </div>
        </div>

        {/* Set Selector & Sub-view Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {([1, 2, 3, 4, 5] as const).map((setNum) => {
              const sData = (match.scoutSets || []).find(
                (s) => s.setNumber === setNum
              );
              const evCount = sData?.events?.length || 0;
              const isActive = activeSetNumber === setNum;
              return (
                <button
                  key={setNum}
                  type="button"
                  onClick={() => setActiveSetNumber(setNum)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
                      : 'bg-[#11141d] text-slate-400 hover:text-white border-slate-800'
                  }`}
                >
                  <span>Set {setNum}</span>
                  {evCount > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                        isActive
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-slate-800 text-amber-400'
                      }`}
                    >
                      {evCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 bg-[#11141d] p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setSubView('setup')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                subView === 'setup'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Formazione & Cambi ({filledZonesCount}/6)
            </button>
            <button
              type="button"
              onClick={() => setSubView('stats')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                subView === 'stats'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Riepilogo Dati
            </button>
          </div>
        </div>
      </div>

      {/* FULLSCREEN LIVE SCOUT DATA COLLECTION OVERLAY */}
      {isLiveFullscreen && (
        <div
          id="live-scout-fullscreen"
          className="fixed inset-0 z-[70] h-[100dvh] w-screen bg-[#0b0e14] flex flex-col overflow-hidden"
        >
          {/* Compact Top Action Bar */}
          <div className="px-3 py-2.5 sm:px-5 border-b border-slate-800 bg-[#11141d] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1 bg-[#0b0e14] p-1 rounded-xl border border-slate-800">
                {([1, 2, 3, 4, 5] as const).map((setNum) => (
                  <button
                    key={setNum}
                    type="button"
                    onClick={() => setActiveSetNumber(setNum)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                      activeSetNumber === setNum
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    S{setNum}
                  </button>
                ))}
              </div>
              <span className="text-xs font-bold text-slate-300 truncate hidden sm:inline">
                vs {match.opponent}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {canManage && (
                <button
                  type="button"
                  id="live-scout-subs-btn"
                  onClick={() => {
                    setSubOutAthleteId('');
                    setSubInAthleteId('');
                    setShowSubModal(true);
                  }}
                  disabled={filledZonesCount === 0}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Cambi ({currentSetData.substitutions.length})</span>
                </button>
              )}

              {canManage && (
                <button
                  type="button"
                  id="live-scout-undo-btn"
                  onClick={handleUndoLastEvent}
                  disabled={!lastEvent}
                  className="px-3 py-2 bg-[#0b0e14] hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title={
                    lastEvent
                      ? `Annulla ultimo: #${lastEventAthlete?.jerseyNumber ?? ''} ${SKILL_LABELS[lastEvent.skill]} ${lastEvent.rating}`
                      : 'Nessuna valutazione da annullare'
                  }
                >
                  <Undo2 className="w-4 h-4 text-amber-400" />
                  <span>Annulla</span>
                </button>
              )}

              <button
                type="button"
                id="live-scout-exit-btn"
                onClick={() => setIsLiveFullscreen(false)}
                className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Esci</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Touch Area: 6 Court Players (2 columns x 3 rows) + 2 Liberos (2 columns) */}
          <div className="flex-1 flex flex-col gap-2.5 sm:gap-3 p-2.5 sm:p-4 min-h-0">
            {/* 6 On-Court Athletes Grid (2 Columns) */}
            <div className="grid grid-cols-2 grid-rows-3 gap-2.5 sm:gap-3 flex-[3] min-h-0">
              {ZONES_COUNTER_CLOCKWISE.map((zone) => {
                const athleteId = currentOnCourt[zone];
                const athlete = athleteId
                  ? athletes.find((a) => a.id === athleteId)
                  : undefined;
                const isSubbedIn =
                  athleteId && currentSetData.lineup[zone] !== athleteId;

                return (
                  <button
                    key={zone}
                    type="button"
                    onClick={() => {
                      if (athlete) {
                        setEvalTarget({
                          athlete,
                          zoneLabel: `Posto ${zone}`,
                          isLibero: false,
                        });
                      } else if (canManage) {
                        setIsLiveFullscreen(false);
                        setSubView('setup');
                      }
                    }}
                    className={`relative rounded-2xl border p-3 sm:p-4 flex flex-col items-center justify-center text-center transition-all active:scale-[0.98] h-full w-full overflow-hidden ${
                      athlete
                        ? 'bg-[#11141d] hover:bg-[#161b26] border-slate-700 hover:border-amber-500/70 shadow-lg cursor-pointer'
                        : 'bg-[#11141d]/40 border-dashed border-slate-800 hover:border-slate-600 cursor-pointer'
                    }`}
                  >
                    <span className="absolute top-2 left-2.5 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] sm:text-xs font-black">
                      P{zone}
                    </span>

                    {isSubbedIn && (
                      <span className="absolute top-2 right-2.5 px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold uppercase">
                        Cambio
                      </span>
                    )}

                    {athlete ? (
                      <div className="flex flex-col items-center justify-center gap-0.5 max-w-full px-1">
                        <span className="text-2xl sm:text-4xl font-black text-amber-400 leading-none tracking-tight">
                          #{athlete.jerseyNumber}
                        </span>
                        <span className="text-sm sm:text-xl font-black text-white uppercase tracking-wide truncate max-w-full mt-1">
                          {athlete.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs sm:text-sm font-semibold text-slate-500">
                        Posto {zone} vuoto
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 2 Libero Buttons Row (2 Columns) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 flex-1 min-h-[82px]">
              {[0, 1].map((slotIdx) => {
                const lib = activeLiberos[slotIdx];
                return (
                  <button
                    key={slotIdx}
                    type="button"
                    onClick={() => {
                      if (lib) {
                        setEvalTarget({
                          athlete: lib,
                          zoneLabel: 'Libero',
                          isLibero: true,
                        });
                      } else if (canManage) {
                        setIsLiveFullscreen(false);
                        setSubView('setup');
                      }
                    }}
                    className={`relative rounded-2xl border p-3 sm:p-4 flex flex-col items-center justify-center text-center transition-all active:scale-[0.98] h-full w-full overflow-hidden ${
                      lib
                        ? 'bg-[#11141d] hover:bg-[#161b26] border-cyan-500/40 hover:border-cyan-400 shadow-lg cursor-pointer'
                        : 'bg-[#11141d]/40 border-dashed border-slate-800 hover:border-slate-600 cursor-pointer'
                    }`}
                  >
                    <span className="absolute top-2 left-2.5 px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] sm:text-xs font-black uppercase">
                      Libero {slotIdx + 1}
                    </span>

                    {lib ? (
                      <div className="flex flex-col items-center justify-center gap-0.5 max-w-full px-1">
                        <span className="text-2xl sm:text-3xl font-black text-cyan-400 leading-none tracking-tight">
                          #{lib.jerseyNumber}
                        </span>
                        <span className="text-sm sm:text-lg font-black text-white uppercase tracking-wide truncate max-w-full mt-0.5">
                          {lib.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500">
                        Libero {slotIdx + 1} non assegnato
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: STARTING LINEUP (P1 -> P6 COUNTER-CLOCKWISE, NO LIBEROS) & SUBSTITUTIONS */}
      {subView === 'setup' && (
        <div className="space-y-4">
          {/* Roster scope toggle & helpers */}
          <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  1. Formazione Iniziale Set {activeSetNumber} (Posto 1 → Posto 6 in senso antiorario, senza Liberi)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Ordine ufficiale sul campo: P1 → P2 → P3 → P4 → P5 → P6. I Liberi si gestiscono nella sezione dedicata sotto.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(match.convocati?.length || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setUseFullRoster((v) => !v)}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-[#11141d] text-slate-300 border border-slate-700 hover:border-amber-500/40 cursor-pointer"
                  >
                    {useFullRoster ? 'Mostra Solo Convocati' : 'Mostra Tutta la Rosa'}
                  </button>
                )}

                {canManage && activeSetNumber > 1 && (
                  <button
                    type="button"
                    onClick={handleCopyPreviousSetLineup}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 cursor-pointer"
                  >
                    Copia da Set {activeSetNumber - 1}
                  </button>
                )}

                {canManage && (
                  <button
                    type="button"
                    onClick={handleResetSetScout}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-950/30 text-rose-300 border border-rose-500/30 hover:bg-rose-950/50 cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Azzera Set
                  </button>
                )}
              </div>
            </div>

            {/* P1 -> P6 Sequential Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ZONES_COUNTER_CLOCKWISE.map((zone) => {
                const selectedId = currentSetData.lineup[zone] || '';
                const otherSelectedIds = new Set(
                  ZONES_COUNTER_CLOCKWISE.filter((z) => z !== zone)
                    .map((z) => currentSetData.lineup[z])
                    .filter(Boolean) as string[]
                );
                return (
                  <div
                    key={zone}
                    className="p-3 bg-[#11141d] rounded-xl border border-slate-800 space-y-1.5"
                  >
                    <label className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                      <span className="text-amber-400">{ZONE_DESCRIPTIONS[zone]}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        #{zone}
                      </span>
                    </label>
                    <select
                      disabled={!canManage}
                      value={selectedId}
                      onChange={(e) => handleSetStartingZone(zone, e.target.value)}
                      className="w-full bg-[#0b0e14] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
                    >
                      <option value="">-- Seleziona Giocatore --</option>
                      {courtEligibleAthletes
                        .filter(
                          (a) => a.id === selectedId || !otherSelectedIds.has(a.id)
                        )
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            #{a.jerseyNumber} {a.firstName} {a.lastName} ({a.role})
                          </option>
                        ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Liberos Selection */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 block">
                2. Liberi Disponibili nel Set {activeSetNumber}
              </span>
              {liberoEligibleAthletes.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nessun atleta con ruolo Libero trovato nella selezione corrente.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {liberoEligibleAthletes.map((lib) => {
                    const checked = currentSetData.liberoIds.includes(lib.id);
                    return (
                      <button
                        key={lib.id}
                        type="button"
                        disabled={!canManage}
                        onClick={() => handleToggleSetLibero(lib.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60 ${
                          checked
                            ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50'
                            : 'bg-[#11141d] text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-mono text-cyan-400">
                          #{lib.jerseyNumber}
                        </span>
                        <span>
                          {lib.firstName} {lib.lastName}
                        </span>
                        {checked && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {filledZonesCount === 6 && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsLiveFullscreen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Entra in Modalità Scout Live (Schermo Intero)
                </button>
              </div>
            )}
          </div>

          {/* Substitutions Manager */}
          <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
                  3. Annotazione Cambi (Sostituzioni Set {activeSetNumber})
                </h4>
                <p className="text-[11px] text-slate-400">
                  Ogni cambio aggiorna automaticamente il sestetto visibile nella schermata Campo Live.
                </p>
              </div>
            </div>

            {canManage && (
              <form
                onSubmit={handleAddSubstitution}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-[#11141d] rounded-xl border border-slate-800 text-xs"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase text-rose-400 mb-1">
                    Esce (In campo ora) *
                  </label>
                  <select
                    required
                    value={subOutAthleteId}
                    onChange={(e) => setSubOutAthleteId(e.target.value)}
                    className="w-full bg-[#0b0e14] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="">-- Giocatore che esce --</option>
                    {ZONES_COUNTER_CLOCKWISE.map((z) => {
                      const id = currentOnCourt[z];
                      if (!id) return null;
                      const ath = athletes.find((a) => a.id === id);
                      if (!ath) return null;
                      return (
                        <option key={z} value={ath.id}>
                          [P{z}] #{ath.jerseyNumber} {ath.firstName} {ath.lastName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-emerald-400 mb-1">
                    Entra (Panchina) *
                  </label>
                  <select
                    required
                    value={subInAthleteId}
                    onChange={(e) => setSubInAthleteId(e.target.value)}
                    className="w-full bg-[#0b0e14] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="">-- Giocatore che entra --</option>
                    {benchNonLiberoAthletes.map((ath) => (
                      <option key={ath.id} value={ath.id}>
                        #{ath.jerseyNumber} {ath.firstName} {ath.lastName} ({ath.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Punteggio / Nota
                  </label>
                  <input
                    type="text"
                    placeholder="es. 16-18 (cambio al servizio)"
                    value={subScore}
                    onChange={(e) => setSubScore(e.target.value)}
                    className="w-full bg-[#0b0e14] border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={!subOutAthleteId || !subInAthleteId}
                    className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Registra Cambio
                  </button>
                </div>
              </form>
            )}

            {/* Substitution Log */}
            {currentSetData.substitutions.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                Nessuna sostituzione annotata nel Set {activeSetNumber}.
              </div>
            ) : (
              <div className="space-y-2">
                {currentSetData.substitutions.map((sub, idx) => {
                  const outAth = athletes.find((a) => a.id === sub.outAthleteId);
                  const inAth = athletes.find((a) => a.id === sub.inAthleteId);
                  return (
                    <div
                      key={sub.id}
                      className="p-3 bg-[#11141d] rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold text-[10px] border border-amber-500/30">
                          #{idx + 1} • Posto {sub.zone}
                        </span>
                        <span className="text-rose-300 font-semibold">
                          Esce #{outAth?.jerseyNumber ?? '?'} {outAth?.lastName ?? 'Atleta'}
                        </span>
                        <span className="text-slate-500">→</span>
                        <span className="text-emerald-300 font-semibold">
                          Entra #{inAth?.jerseyNumber ?? '?'} {inAth?.lastName ?? 'Atleta'}
                        </span>
                        {sub.scoreAtSub && (
                          <span className="px-2 py-0.5 rounded bg-[#0b0e14] text-slate-300 border border-slate-700 font-mono text-[10px]">
                            {sub.scoreAtSub}
                          </span>
                        )}
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSubstitution(sub.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg cursor-pointer"
                          title="Rimuovi cambio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: SCOUT SUMMARY TABLE */}
      {subView === 'stats' && (
        <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-4">
          {/* Publish Status & Action Banner for Staff */}
          {canManage && (
            <div
              className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                isScoutPublished
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-[#11141d] border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isScoutPublished ? (
                  <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <div>
                  <span className="text-xs font-bold text-white block">
                    {isScoutPublished
                      ? 'Raccolta dati totale pubblicata agli atleti'
                      : 'Raccolta dati riservata allo staff (non ancora pubblicata)'}
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    {isScoutPublished
                      ? `Gli atleti possono consultare il riepilogo totale della partita (${totalMatchScoutEvents} azioni).`
                      : `Premi "Pubblica Raccolta Dati" per rendere visibili agli atleti tutte le ${totalMatchScoutEvents} azioni registrate.`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                id="publish-scout-stats-btn"
                onClick={handleTogglePublishScout}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  isScoutPublished
                    ? 'bg-[#0b0e14] hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                }`}
              >
                {isScoutPublished ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    Ritira Pubblicazione
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Pubblica Raccolta Dati agli Atleti
                  </>
                )}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Tabellino Scout Semplificato ({statsScope === 'set' ? `Set ${activeSetNumber}` : 'Intera Partita'})
              </h4>
              <p className="text-[11px] text-slate-400">
                Totale azioni rilevate: <strong className="text-amber-400">{statsEvents.length}</strong>
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-[#11141d] p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setStatsScope('set')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  statsScope === 'set'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Solo Set {activeSetNumber}
              </button>
              <button
                type="button"
                onClick={() => setStatsScope('match')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  statsScope === 'match'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Totale Partita
              </button>
            </div>
          </div>

          {statsAthletes.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
              Nessun dato scout registrato finora. Imposta la formazione e clicca sugli atleti nella vista Campo Live.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-[#11141d] text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 whitespace-nowrap">
                  <tr>
                    <th className="p-3">Atleta</th>
                    <th className="p-3 text-center">Battuta (# + - =)</th>
                    <th className="p-3 text-center">Ricezione (# + - =)</th>
                    <th className="p-3 text-center">Attacco (# + - =)</th>
                    <th className="p-3 text-center">Muro (# + - =)</th>
                    <th className="p-3 text-center">Totale Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {statsAthletes.map((ath) => {
                    const libero = isAthleteLibero(ath, match);
                    const summary = summarizeEventsForAthlete(statsEvents, ath.id);
                    const totalAll = ALL_SKILLS.reduce(
                      (acc, sk) => acc + summary[sk].total,
                      0
                    );
                    const renderSkillCell = (skill: ScoutSkill, disabled: boolean) => {
                      if (disabled) {
                        return <span className="text-slate-600 text-[10px]">N/D</span>;
                      }
                      const c = summary[skill];
                      if (c.total === 0) {
                        return <span className="text-slate-500">-</span>;
                      }
                      const posPct = Math.round(((c['#'] + c['+']) / c.total) * 100);
                      return (
                        <div className="space-y-0.5">
                          <div className="font-mono text-[11px] font-bold">
                            <span className="text-emerald-400">{c['#']}</span>/
                            <span className="text-cyan-400">{c['+']}</span>/
                            <span className="text-amber-400">{c['-']}</span>/
                            <span className="text-rose-400">{c['=']}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            {c.total} az • {posPct}% pos
                          </span>
                        </div>
                      );
                    };

                    return (
                      <tr key={ath.id} className="hover:bg-[#161b26] transition-colors">
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-[#11141d] text-amber-400 font-black border border-slate-800">
                              #{ath.jerseyNumber}
                            </span>
                            <div>
                              <span className="font-bold text-white block">
                                {ath.firstName} {ath.lastName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {libero ? 'Libero' : ath.role}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {renderSkillCell('battuta', libero)}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {renderSkillCell('ricezione', false)}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {renderSkillCell('attacco', libero)}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {renderSkillCell('muro', libero)}
                        </td>
                        <td className="p-3 text-center font-black text-white">
                          {totalAll}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* QUICK EVALUATION MODAL ON ATHLETE CLICK */}
      {evalTarget && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setEvalTarget(null)}
        >
          <div
            className="bg-[#11141d] border border-slate-700 rounded-3xl w-full max-w-lg p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src={evalTarget.athlete.photoUrl}
                  alt={evalTarget.athlete.lastName}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-amber-500/40"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-black text-xs border border-amber-500/30">
                      #{evalTarget.athlete.jerseyNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#0b0e14] text-cyan-300 text-[10px] font-bold border border-slate-800">
                      {evalTarget.zoneLabel} • Set {activeSetNumber}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white mt-1">
                    {evalTarget.athlete.firstName} {evalTarget.athlete.lastName}
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {evalTarget.isLibero
                      ? 'Libero (Fondamentale di competenza: Ricezione)'
                      : `${evalTarget.athlete.role} (Battuta, Ricezione, Attacco, Muro)`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEvalTarget(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fundamentals Grid */}
            {(() => {
              const allowedSkills = evalTarget.isLibero
                ? LIBERO_SKILLS
                : ALL_SKILLS;
              const counts = summarizeEventsForAthlete(
                currentSetData.events,
                evalTarget.athlete.id
              );

              return (
                <div className="space-y-3">
                  {allowedSkills.map((skill) => {
                    const c = counts[skill];
                    return (
                      <div
                        key={skill}
                        className="p-3 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-white">
                            {SKILL_LABELS[skill]}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            Set {activeSetNumber}:{' '}
                            <strong className="text-emerald-400">{c['#']}#</strong>{' '}
                            <strong className="text-cyan-400">{c['+']}+</strong>{' '}
                            <strong className="text-amber-400">{c['-']}-</strong>{' '}
                            <strong className="text-rose-400">{c['=']}=</strong>{' '}
                            <span className="text-slate-500">({c.total})</span>
                          </span>
                        </div>

                        {canManage && (
                          <div className="grid grid-cols-4 gap-2">
                            {RATING_CONFIG.map((r) => (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() =>
                                  handleRecordRating(
                                    evalTarget.athlete,
                                    skill,
                                    r.value
                                  )
                                }
                                className={`py-2.5 px-2 rounded-xl border font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${r.buttonClass}`}
                              >
                                <span className="text-lg font-black leading-none">
                                  {r.value}
                                </span>
                                <span className="text-[9px] mt-1 font-semibold opacity-90 text-center leading-tight">
                                  {r.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              {canManage ? (
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepEvalOpen}
                    onChange={(e) => setKeepEvalOpen(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  Mantieni aperto dopo la valutazione
                </label>
              ) : (
                <span className="text-[11px] text-slate-500">
                  Sola visualizzazione
                </span>
              )}
              <button
                type="button"
                onClick={() => setEvalTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK SUBSTITUTION MODAL FROM LIVE VIEW */}
      {showSubModal && canManage && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowSubModal(false)}
        >
          <div
            className="bg-[#11141d] border border-slate-700 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-amber-400" />
                Registra Cambio — Set {activeSetNumber}
              </h4>
              <button
                type="button"
                onClick={() => setShowSubModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubstitution} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-rose-400 mb-1">
                  Giocatore che esce (in campo ora) *
                </label>
                <select
                  required
                  value={subOutAthleteId}
                  onChange={(e) => setSubOutAthleteId(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                >
                  <option value="">-- Seleziona chi esce --</option>
                  {ZONES_COUNTER_CLOCKWISE.map((z) => {
                    const id = currentOnCourt[z];
                    if (!id) return null;
                    const ath = athletes.find((a) => a.id === id);
                    if (!ath) return null;
                    return (
                      <option key={z} value={ath.id}>
                        [Posto {z}] #{ath.jerseyNumber} {ath.firstName} {ath.lastName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-400 mb-1">
                  Giocatore che entra (dalla panchina) *
                </label>
                <select
                  required
                  value={subInAthleteId}
                  onChange={(e) => setSubInAthleteId(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                >
                  <option value="">-- Seleziona chi entra --</option>
                  {benchNonLiberoAthletes.map((ath) => (
                    <option key={ath.id} value={ath.id}>
                      #{ath.jerseyNumber} {ath.firstName} {ath.lastName} ({ath.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Punteggio / Nota cambio (facoltativo)
                </label>
                <input
                  type="text"
                  placeholder="es. 18-19, cambio in battuta"
                  value={subScore}
                  onChange={(e) => setSubScore(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSubModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  Conferma Cambio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OPERATOR GUIDE MODAL */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="bg-[#11141d] border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-800 bg-[#0b0e14] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white font-display">
                    Guida Operatore — Raccolta Dati Scout Semplificato
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Modalità operative e criteri ufficiali di valutazione per la rilevazione a bordo campo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-300 leading-relaxed">
              {/* 1. Workflow */}
              <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                  1. Procedura Operativa per ogni Set
                </h4>
                <ol className="space-y-2 list-decimal list-inside">
                  <li>
                    <strong className="text-white">Inserimento Formazione Iniziale (P1 → P6):</strong> nella scheda <em>Formazione & Cambi</em>, inserisci i 6 titolari partendo da <strong>Posto 1</strong> (zona battuta) e proseguendo in <strong>senso antiorario</strong> fino a <strong>Posto 6</strong> (P1 → P2 → P3 → P4 → P5 → P6), <strong>senza includere i Liberi</strong>.
                  </li>
                  <li>
                    <strong className="text-white">Selezione dei Liberi:</strong> spunta i Liberi disponibili per il set nell'apposita sezione sotto la formazione iniziale.
                  </li>
                  <li>
                    <strong className="text-white">Annotazione dei Cambi:</strong> ogni volta che l'allenatore effettua una sostituzione, premi <em>Registra Cambio</em> indicando chi esce dal campo e chi entra dalla panchina (con punteggio/nota opzionale). Il sestetto visibile nella schermata <em>Campo Live</em> si aggiorna subito.
                  </li>
                  <li>
                    <strong className="text-white">Rilevazione Live:</strong> passa alla vista <em>Campo Live (6 + Liberi)</em>, clicca sull'atleta interessato dall'azione e tocca il simbolo di valutazione sul fondamentale eseguito. In caso di errore di tocco, usa <em>Annulla ultimo</em>.
                  </li>
                </ol>
              </div>

              {/* 2. Fondamentali di competenza */}
              <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400">
                  2. Fondamentali di Competenza per Ruolo
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-[#11141d] rounded-xl border border-cyan-500/30">
                    <span className="font-bold text-cyan-300 block mb-1">Libero</span>
                    <p className="text-[11px] text-slate-300">
                      Valutato esclusivamente sul fondamentale: <strong>Ricezione</strong>.
                    </p>
                  </div>
                  <div className="p-3 bg-[#11141d] rounded-xl border border-amber-500/30">
                    <span className="font-bold text-amber-300 block mb-1">Tutti gli altri giocatori (6 in campo)</span>
                    <p className="text-[11px] text-slate-300">
                      Valutati sui 4 fondamentali: <strong>Battuta, Ricezione, Attacco, Muro</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Scala di valutazione */}
              <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  3. Criteri di Valutazione della Scala (# / + / - / =)
                </h4>

                <div className="space-y-2.5">
                  <div className="p-3 bg-[#11141d] rounded-xl border border-emerald-500/30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black text-sm">#</span>
                      <strong className="text-emerald-300">Perfetto / Punto</strong>
                    </div>
                    <ul className="text-[11px] text-slate-300 space-y-1">
                      <li>• <strong>Battuta:</strong> Ace diretto o battuta che costringe l'avversario a free ball immediata senza possibilità di attacco.</li>
                      <li>• <strong>Ricezione:</strong> Palla perfetta sulla testa del palleggiatore (tutte le opzioni d'attacco disponibili, incluso 1° tempo).</li>
                      <li>• <strong>Attacco:</strong> Punto diretto (palla a terra o mani-out vincente).</li>
                      <li>• <strong>Muro:</strong> Muro punto diretto nel campo avversario.</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-[#11141d] rounded-xl border border-cyan-500/30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-black text-sm">+</span>
                      <strong className="text-cyan-300">Sufficiente / Positivo</strong>
                    </div>
                    <ul className="text-[11px] text-slate-300 space-y-1">
                      <li>• <strong>Battuta:</strong> Battuta efficace che stacca la ricezione avversaria impedendo il gioco veloce al centro.</li>
                      <li>• <strong>Ricezione:</strong> Ricezione buona/giocabile nella zona di alzata che consente attacco sulle bande o opposto.</li>
                      <li>• <strong>Attacco:</strong> Attacco efficace che mette in difficoltà la difesa avversaria (rigiocata forzata o palla facile di ritorno).</li>
                      <li>• <strong>Muro:</strong> Tocco a muro positivo che rallenta il pallone favorendo la difesa e il contrattacco della nostra squadra.</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-[#11141d] rounded-xl border border-amber-500/30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black text-sm">-</span>
                      <strong className="text-amber-300">Negativo</strong>
                    </div>
                    <ul className="text-[11px] text-slate-300 space-y-1">
                      <li>• <strong>Battuta:</strong> Battuta facile/comoda che permette all'avversario una ricezione perfetta o positiva.</li>
                      <li>• <strong>Ricezione:</strong> Ricezione staccata o imprecisa che obbliga ad alzare palla alta scontata o free ball.</li>
                      <li>• <strong>Attacco:</strong> Attacco debole/prevedibile facilmente difeso o murato con copertura obbligata.</li>
                      <li>• <strong>Muro:</strong> Muro in ritardo, bucato o tocco scomposto che non permette una difesa organizzata.</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-[#11141d] rounded-xl border border-rose-500/30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-black text-sm">=</span>
                      <strong className="text-rose-300">Errore Punto</strong>
                    </div>
                    <ul className="text-[11px] text-slate-300 space-y-1">
                      <li>• <strong>Battuta:</strong> Palla in rete, lunga o fuori lateralmente (punto diretto avversario).</li>
                      <li>• <strong>Ricezione:</strong> Ace subito / palla non controllabile (punto diretto avversario).</li>
                      <li>• <strong>Attacco:</strong> Palla in rete, fuori, fallo di attacco o murata direttamente a terra (punto avversario).</li>
                      <li>• <strong>Muro:</strong> Invasione a rete/campo avversario o mani-out netto che chiude lo scambio per gli avversari.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 4. Consigli pratici */}
              <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-1.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  4. Regole d'Oro per la Coerenza dei Dati
                </h4>
                <p className="text-[11px] text-slate-400">
                  • Compila la formazione P1→P6 prima del fischio d'inizio del set (nei set dal 2° al 5° puoi usare <em>Copia da Set precedente</em> se il sestetto non cambia).<br />
                  • Registra subito i cambi durante l'interruzione di gioco per mantenere aggiornati i 6 giocatori cliccabili sul campo.<br />
                  • Mantieni sempre lo stesso metro di giudizio tra <strong>+</strong> e <strong>-</strong> in tutta la gara: la costanza rende affidabili le percentuali nel <em>Riepilogo Dati</em>.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-[#0b0e14] flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
              >
                Ho capito, chiudi guida
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface PublishedMatchScoutStatsProps {
  match: MatchEvent;
  athletes: Athlete[];
  highlightAthleteId?: string;
}

export const PublishedMatchScoutStats: React.FC<PublishedMatchScoutStatsProps> = ({
  match,
  athletes,
  highlightAthleteId,
}) => {
  const [scope, setScope] = useState<'match' | 1 | 2 | 3 | 4 | 5>('match');

  const setsWithEvents = useMemo(
    () =>
      (match.scoutSets || [])
        .filter((s) => (s.events?.length || 0) > 0)
        .sort((a, b) => a.setNumber - b.setNumber),
    [match.scoutSets]
  );

  const scopedEvents = useMemo(() => {
    if (scope === 'match') {
      return (match.scoutSets || []).flatMap((s) => s.events || []);
    }
    const targetSet = (match.scoutSets || []).find((s) => s.setNumber === scope);
    return targetSet?.events || [];
  }, [match.scoutSets, scope]);

  const scoutedAthletes = useMemo(() => {
    const ids = new Set<string>();
    for (const ev of scopedEvents) ids.add(ev.athleteId);
    if (scope === 'match') {
      for (const s of match.scoutSets || []) {
        for (const z of ZONES_COUNTER_CLOCKWISE) {
          if (s.lineup?.[z]) ids.add(s.lineup[z]!);
        }
        for (const sub of s.substitutions || []) {
          if (sub.inAthleteId) ids.add(sub.inAthleteId);
        }
        for (const lId of s.liberoIds || []) ids.add(lId);
      }
    } else {
      const s = (match.scoutSets || []).find((st) => st.setNumber === scope);
      if (s) {
        for (const z of ZONES_COUNTER_CLOCKWISE) {
          if (s.lineup?.[z]) ids.add(s.lineup[z]!);
        }
        for (const sub of s.substitutions || []) {
          if (sub.inAthleteId) ids.add(sub.inAthleteId);
        }
        for (const lId of s.liberoIds || []) ids.add(lId);
      }
    }
    return athletes
      .filter((a) => ids.has(a.id))
      .sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  }, [athletes, match.scoutSets, scopedEvents, scope]);

  if (setsWithEvents.length === 0) return null;

  return (
    <div className="p-4 sm:p-5 bg-[#0b0e14] rounded-2xl border border-emerald-500/30 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Raccolta Dati Scout Pubblicata ({scope === 'match' ? 'Totale Partita' : `Set ${scope}`})
            </h4>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Azioni totali rilevate: <strong className="text-amber-400">{scopedEvents.length}</strong> • Scala: <span className="text-emerald-400 font-bold">#</span> Perfetto / <span className="text-cyan-400 font-bold">+</span> Positivo / <span className="text-amber-400 font-bold">-</span> Negativo / <span className="text-rose-400 font-bold">=</span> Errore
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#11141d] p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setScope('match')}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
              scope === 'match'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Totale Partita
          </button>
          {setsWithEvents.map((s) => (
            <button
              key={s.setNumber}
              type="button"
              onClick={() => setScope(s.setNumber)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                scope === s.setNumber
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Set {s.setNumber}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-[#11141d] text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 whitespace-nowrap">
            <tr>
              <th className="p-3">Atleta</th>
              <th className="p-3 text-center">Battuta (# + - =)</th>
              <th className="p-3 text-center">Ricezione (# + - =)</th>
              <th className="p-3 text-center">Attacco (# + - =)</th>
              <th className="p-3 text-center">Muro (# + - =)</th>
              <th className="p-3 text-center">Totale Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {scoutedAthletes.map((ath) => {
              const libero = isAthleteLibero(ath, match);
              const summary = summarizeEventsForAthlete(scopedEvents, ath.id);
              const totalAll = ALL_SKILLS.reduce(
                (acc, sk) => acc + summary[sk].total,
                0
              );
              const isMe = highlightAthleteId === ath.id;
              const renderCell = (skill: ScoutSkill, disabled: boolean) => {
                if (disabled) {
                  return <span className="text-slate-600 text-[10px]">N/D</span>;
                }
                const c = summary[skill];
                if (c.total === 0) {
                  return <span className="text-slate-500">-</span>;
                }
                const posPct = Math.round(((c['#'] + c['+']) / c.total) * 100);
                return (
                  <div className="space-y-0.5">
                    <div className="font-mono text-[11px] font-bold">
                      <span className="text-emerald-400">{c['#']}</span>/
                      <span className="text-cyan-400">{c['+']}</span>/
                      <span className="text-amber-400">{c['-']}</span>/
                      <span className="text-rose-400">{c['=']}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      {c.total} az • {posPct}% pos
                    </span>
                  </div>
                );
              };

              return (
                <tr
                  key={ath.id}
                  className={`transition-colors ${
                    isMe
                      ? 'bg-amber-500/10 hover:bg-amber-500/15'
                      : 'hover:bg-[#161b26]'
                  }`}
                >
                  <td className="p-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#11141d] text-amber-400 font-black border border-slate-800">
                        #{ath.jerseyNumber}
                      </span>
                      <div>
                        <span className="font-bold text-white flex items-center gap-1.5">
                          {ath.firstName} {ath.lastName}
                          {isMe && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 text-[9px] font-black uppercase">
                              Tu
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {libero ? 'Libero' : ath.role}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    {renderCell('battuta', libero)}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    {renderCell('ricezione', false)}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    {renderCell('attacco', libero)}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    {renderCell('muro', libero)}
                  </td>
                  <td className="p-3 text-center font-black text-white">
                    {totalAll}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

