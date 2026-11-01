import React, { useState } from 'react';
import { MatchEvent, MatchCallUp, Athlete, User } from '../../types';
import { formatDate } from '../../lib/db';
import {
  Calendar,
  Clock,
  MapPin,
  Trophy,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Share2,
  Sparkles,
  Award,
  Check,
  X,
  ChevronRight,
  Shield,
  FileText,
} from 'lucide-react';
import { useDialog } from '../../context/DialogContext';

interface MatchCalendarProps {
  matches: MatchEvent[];
  athletes: Athlete[];
  currentUser: User | null;
  onSaveMatch: (match: MatchEvent) => Promise<void>;
  onDeleteMatch?: (matchId: string) => Promise<void>;
  isCoach: boolean;
}

export const MatchCalendar: React.FC<MatchCalendarProps> = ({
  matches,
  athletes,
  currentUser,
  onSaveMatch,
  onDeleteMatch,
  isCoach,
}) => {
  const { confirm, prompt, showToast } = useDialog();
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'past'>('all');
  const [selectedMatch, setSelectedMatch] = useState<MatchEvent | null>(null);
  const [showAddMatchModal, setShowAddMatchModal] = useState(false);
  const [activeTabModal, setActiveTabModal] = useState<'callups' | 'score' | 'info'>('callups');

  // Form states for new match
  const [newMatchData, setNewMatchData] = useState<Partial<MatchEvent>>({
    date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '18:30',
    category: 'Serie C Maschile',
    championship: 'Campionato Regionale FIPAV - Girone A',
    round: '17ª Giornata',
    opponent: '',
    isHome: true,
    locationName: 'PalaVolley Arena',
    locationAddress: 'Via dello Sport 12, Milano (MI)',
    callUpStatus: 'bozza',
    convocati: [],
  });

  const currentAthleteId = currentUser?.role === 'athlete' ? currentUser.athleteId : null;

  // Filter matches
  const nowStr = new Date().toISOString().split('T')[0];
  const filteredMatches = matches.filter((m) => {
    if (filterType === 'upcoming') return m.date >= nowStr;
    if (filterType === 'past') return m.date < nowStr || m.callUpStatus === 'conclusa';
    return true;
  });

  // Handle athlete confirming attendance to call-up
  const handleConfirmCallUp = async (
    match: MatchEvent,
    confirmed: 'confermato' | 'non_disponibile',
    responseNote?: string
  ) => {
    if (!currentAthleteId) return;

    const currentCallUps = [...(match.convocati || [])];
    const existingIdx = currentCallUps.findIndex((c) => c.athleteId === currentAthleteId);

    if (existingIdx >= 0) {
      currentCallUps[existingIdx] = {
        ...currentCallUps[existingIdx],
        confirmed,
        responseNote: responseNote || currentCallUps[existingIdx].responseNote,
        respondedAt: new Date().toISOString(),
      };
    } else {
      currentCallUps.push({
        athleteId: currentAthleteId,
        roleInMatch: 'Panchina',
        confirmed,
        responseNote,
        respondedAt: new Date().toISOString(),
      });
    }

    const updatedMatch: MatchEvent = {
      ...match,
      convocati: currentCallUps,
    };

    await onSaveMatch(updatedMatch);
    if (selectedMatch?.id === match.id) {
      setSelectedMatch(updatedMatch);
    }

    if (confirmed === 'confermato') {
      showToast({
        message: `Presenza alla gara contro ${match.opponent} confermata!`,
        type: 'success',
      });
    } else {
      showToast({
        message: `Indisponibilità per la gara contro ${match.opponent} salvata`,
        type: 'warning',
      });
    }
  };

  // Handle Coach modifying Call Up list
  const handleToggleAthleteCallUp = async (athleteId: string, roleInMatch: MatchCallUp['roleInMatch'] = 'Titolare') => {
    if (!selectedMatch) return;

    const currentCallUps = [...(selectedMatch.convocati || [])];
    const existingIdx = currentCallUps.findIndex((c) => c.athleteId === athleteId);

    if (existingIdx >= 0) {
      // Remove athlete
      const updated = currentCallUps.filter((c) => c.athleteId !== athleteId);
      const updatedMatch = { ...selectedMatch, convocati: updated };
      await onSaveMatch(updatedMatch);
      setSelectedMatch(updatedMatch);
    } else {
      // Add athlete
      currentCallUps.push({
        athleteId,
        roleInMatch,
        confirmed: 'in_attesa',
      });
      const updatedMatch = { ...selectedMatch, convocati: currentCallUps };
      await onSaveMatch(updatedMatch);
      setSelectedMatch(updatedMatch);
    }
  };

  // Handle Coach changing athlete's role in match
  const handleChangeRoleInMatch = async (athleteId: string, roleInMatch: MatchCallUp['roleInMatch']) => {
    if (!selectedMatch) return;

    const currentCallUps = selectedMatch.convocati.map((c) =>
      c.athleteId === athleteId ? { ...c, roleInMatch } : c
    );

    const updatedMatch = { ...selectedMatch, convocati: currentCallUps };
    await onSaveMatch(updatedMatch);
    setSelectedMatch(updatedMatch);
  };

  // Handle Coach Publishing Call-ups
  const handlePublishCallUps = async () => {
    if (!selectedMatch) return;
    const updatedMatch: MatchEvent = {
      ...selectedMatch,
      callUpStatus: 'pubblicata',
    };
    await onSaveMatch(updatedMatch);
    setSelectedMatch(updatedMatch);
    showToast({
      message: `Foglio convocazioni per la partita contro ${selectedMatch.opponent} pubblicato!`,
      type: 'success',
    });
  };

  // Handle Match Score Saving
  const handleSaveScore = async (e: React.FormEvent, scoreData: MatchEvent['score']) => {
    e.preventDefault();
    if (!selectedMatch) return;

    const updatedMatch: MatchEvent = {
      ...selectedMatch,
      callUpStatus: 'conclusa',
      score: scoreData,
    };

    await onSaveMatch(updatedMatch);
    setSelectedMatch(updatedMatch);
    showToast({
      message: `Risultato e tabellino partita salvati con successo!`,
      type: 'success',
    });
  };

  // Handle Create Match Submit
  const handleCreateMatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatchData.opponent || !newMatchData.date) return;

    const created: MatchEvent = {
      id: `match-${Date.now()}`,
      date: newMatchData.date || new Date().toISOString().split('T')[0],
      time: newMatchData.time || '18:00',
      category: newMatchData.category || 'Serie C Maschile',
      championship: newMatchData.championship || 'Campionato Regionale FIPAV',
      round: newMatchData.round || 'Prossima Giornata',
      opponent: newMatchData.opponent || 'Avversario',
      isHome: Boolean(newMatchData.isHome),
      locationName: newMatchData.locationName || 'PalaVolley',
      locationAddress: newMatchData.locationAddress || 'Via dello Sport',
      callUpStatus: 'bozza',
      convocati: athletes.slice(0, 12).map((a, i) => ({
        athleteId: a.id,
        roleInMatch: i === 0 ? 'Capitano' : a.role === 'Libero' ? '1° Libero' : i < 7 ? 'Titolare' : 'Panchina',
        confirmed: 'in_attesa',
      })),
    };

    await onSaveMatch(created);
    showToast({
      message: `Nuova partita contro ${created.opponent} aggiunta al calendario!`,
      type: 'success',
    });
    setShowAddMatchModal(false);
    setSelectedMatch(created);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-white font-display tracking-tight">
                Calendario Partite & Convocazioni Ufficiali
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
                {matches.length} Gare in Calendario
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isCoach
                ? 'Gestisci le convocazioni per le partite di campionato, assegna ruoli di formazione e pubblica i tabellini'
                : 'Consulta le convocazioni ufficiali alle partite, conferma la tua disponibilità e visualizza i dettagli logistici'}
            </p>
          </div>

          {isCoach && (
            <button
              id="add-match-button"
              onClick={() => setShowAddMatchModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-102"
            >
              <Plus className="w-4 h-4" />
              Aggiungi Partita
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#0b0e14] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Tutte le Gare ({matches.length})
          </button>
          <button
            onClick={() => setFilterType('upcoming')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'upcoming'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#0b0e14] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Prossime Partite
          </button>
          <button
            onClick={() => setFilterType('past')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'past'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#0b0e14] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Risultati & Concluse
          </button>
        </div>
      </div>

      {/* Matches Grid */}
      {filteredMatches.length === 0 ? (
        <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-12 text-center shadow-xl">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Nessuna partita a calendario</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Non ci sono incontri corrispondenti al filtro selezionato o tutti i match sono stati rimossi.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredMatches.map((match) => {
          const myCallUp = currentAthleteId ? match.convocati?.find((c) => c.athleteId === currentAthleteId) : null;
          const confirmedCount = match.convocati?.filter((c) => c.confirmed === 'confermato').length || 0;
          const totalCallUps = match.convocati?.length || 0;

          return (
            <div
              key={match.id}
              id={`match-card-${match.id}`}
              className="bg-[#11141d] border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition-all"
            >
              <div>
                {/* Header with Round & Home/Away Badge */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-[#0b0e14] border border-slate-800 text-amber-400 font-mono text-xs font-bold">
                      {formatDate(match.date)}
                    </span>
                    <div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[#0b0e14] text-slate-300 border border-slate-750">
                        {match.round} • {match.championship}
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {match.time} • {match.isHome ? 'In Casa' : 'Fuori Casa (Trasferta)'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                      match.callUpStatus === 'conclusa'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : match.callUpStatus === 'pubblicata'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-[#0b0e14] text-slate-400 border border-slate-800'
                    }`}
                  >
                    {match.callUpStatus === 'conclusa'
                      ? 'Conclusa'
                      : match.callUpStatus === 'pubblicata'
                      ? 'Convocazioni Ufficiali'
                      : 'Bozza Convocazioni'}
                  </span>
                </div>

                {/* Match Up Teams Banner */}
                <div className="mt-3 p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-xs">
                      VS
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Volley Spike Club</span>
                      <span className="text-[10px] text-slate-400">vs {match.opponent}</span>
                    </div>
                  </div>

                  {/* Score or Status */}
                  {match.score ? (
                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-400 block">
                        {match.score.setsHome} - {match.score.setsAway}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {match.score.partialScores?.join(', ')}
                      </span>
                    </div>
                  ) : (
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-300 block">
                        {confirmedCount}/{totalCallUps} Confermati
                      </span>
                      <span className="text-[10px] text-slate-500">Convocati Ufficiali</span>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-3">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{match.locationName} ({match.locationAddress})</span>
                </div>

                {/* Athlete Call-up Status Banner */}
                {!isCoach && myCallUp && (
                  <div className="mt-3 p-3 rounded-xl border bg-[#0b0e14] border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">
                        Sei convocato come: <strong className="text-amber-400">{myCallUp.roleInMatch}</strong>
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                          myCallUp.confirmed === 'confermato'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : myCallUp.confirmed === 'non_disponibile'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {myCallUp.confirmed === 'confermato'
                          ? '✓ Confermato'
                          : myCallUp.confirmed === 'non_disponibile'
                          ? '✗ Non Disponibile'
                          : 'In Attesa di Risposta'}
                      </span>
                    </div>

                    {match.callUpStatus !== 'conclusa' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          id={`confirm-match-${match.id}`}
                          onClick={() => handleConfirmCallUp(match, 'confermato')}
                          className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          ✓ Confermo Presenza
                        </button>
                        <button
                          id={`decline-match-${match.id}`}
                          onClick={async () => {
                            const reason = await prompt({
                              title: 'Motivo Indisponibilità Gara',
                              message: `Comunica allo staff il motivo per cui non puoi partecipare alla partita contro ${match.opponent}:`,
                              placeholder: 'Es. Risentimento muscolare, impegni di studio/lavoro...',
                              confirmText: 'Invia Notifica',
                              cancelText: 'Annulla',
                            });
                            if (reason !== null) {
                              await handleConfirmCallUp(match, 'non_disponibile', reason);
                            }
                          }}
                          className="py-1.5 px-3 bg-[#11141d] hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Non Disponibile
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  id={`open-match-details-${match.id}`}
                  onClick={() => {
                    setSelectedMatch(match);
                    setActiveTabModal('callups');
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-[#0b0e14] hover:bg-[#161b26] text-slate-200 border border-slate-700 transition-colors"
                >
                  <Users className="w-4 h-4 text-amber-400" />
                  {isCoach ? 'Gestisci Foglio Convocazioni & Risultato' : 'Visualizza Convocazioni & Info Gara'}
                </button>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Match Details & Convocations Modal */}
      {selectedMatch && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setSelectedMatch(null)}
        >
          <div
            id="match-detail-modal"
            className="bg-[#11141d] border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-[#0b0e14] flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {selectedMatch.round} • {selectedMatch.championship}
                </span>
                <h2 className="text-xl font-bold text-white font-display mt-1">
                  Volley Spike Club vs {selectedMatch.opponent}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {formatDate(selectedMatch.date)} alle ore {selectedMatch.time} • {selectedMatch.locationName} ({selectedMatch.locationAddress})
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isCoach && onDeleteMatch && (
                  <button
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: 'Elimina Partita dal Calendario',
                        message: `Sei sicuro di voler eliminare definitivamente la gara contro "${selectedMatch.opponent}" del ${formatDate(selectedMatch.date)}? L'operazione cancellerà anche tutte le convocazioni correlate.`,
                        confirmText: 'Sì, Elimina Partita',
                        cancelText: 'Annulla',
                        type: 'danger',
                      });
                      if (confirmed) {
                        await onDeleteMatch(selectedMatch.id);
                        showToast({
                          message: `Partita contro ${selectedMatch.opponent} eliminata dal calendario`,
                          type: 'info',
                        });
                        setSelectedMatch(null);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                    title="Elimina partita"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-[#161b26] rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-800 bg-[#0b0e14]/60">
              <button
                onClick={() => setActiveTabModal('callups')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTabModal === 'callups'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Convocazioni Ufficiali ({selectedMatch.convocati?.length || 0})
              </button>
              <button
                onClick={() => setActiveTabModal('score')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTabModal === 'score'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Risultato & Tabellino
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* TAB: CALL-UPS */}
              {activeTabModal === 'callups' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-white">Foglio Gara & Convocazioni</h3>
                      <p className="text-xs text-slate-400">
                        {isCoach
                          ? 'Seleziona i giocatori da convocare e assegna i ruoli di formazione (Titolare, Panchina, Capitano, Libero)'
                          : 'Elenco degli atleti convocati per la gara con stato di disponibilità'}
                      </p>
                    </div>

                    {isCoach && (
                      <div className="flex items-center gap-2">
                        {selectedMatch.callUpStatus === 'bozza' ? (
                          <button
                            onClick={handlePublishCallUps}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all"
                          >
                            ✓ Pubblica Convocazioni
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold">
                            ✓ Pubblicata per la Squadra
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Athletes selection list */}
                  <div className="bg-[#0b0e14] rounded-2xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#11141d] text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-3">Giocatore</th>
                          <th className="p-3">Ruolo Squadra</th>
                          <th className="p-3">Convocazione</th>
                          <th className="p-3">Ruolo Partita</th>
                          <th className="p-3">Conferma Atleta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {athletes.map((athlete) => {
                          const callUp = selectedMatch.convocati?.find((c) => c.athleteId === athlete.id);
                          const isCalledUp = Boolean(callUp);

                          return (
                            <tr key={athlete.id} className="hover:bg-[#161b26] transition-colors">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded bg-[#11141d] text-amber-400 font-bold text-xs flex items-center justify-center border border-slate-800">
                                    #{athlete.jerseyNumber}
                                  </span>
                                  <img
                                    src={athlete.photoUrl}
                                    alt={athlete.lastName}
                                    className="w-7 h-7 rounded-md object-cover"
                                  />
                                  <div>
                                    <span className="font-bold text-white block">
                                      {athlete.firstName} {athlete.lastName}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="p-3 text-slate-300">{athlete.role}</td>

                              <td className="p-3">
                                {isCoach ? (
                                  <button
                                    onClick={() => handleToggleAthleteCallUp(athlete.id)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                                      isCalledUp
                                        ? 'bg-amber-500 text-slate-950 font-bold'
                                        : 'bg-[#11141d] text-slate-400 hover:text-white border border-slate-800'
                                    }`}
                                  >
                                    {isCalledUp ? '✓ Convocato' : '+ Convoca'}
                                  </button>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                                      isCalledUp ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'
                                    }`}
                                  >
                                    {isCalledUp ? 'Convocato' : 'Non Convocato'}
                                  </span>
                                )}
                              </td>

                              <td className="p-3">
                                {isCoach && isCalledUp ? (
                                  <select
                                    value={callUp?.roleInMatch || 'Titolare'}
                                    onChange={(e) => handleChangeRoleInMatch(athlete.id, e.target.value as any)}
                                    className="bg-[#0b0e14] border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                                  >
                                    <option value="Capitano">Capitano</option>
                                    <option value="Titolare">Titolare</option>
                                    <option value="Panchina">Panchina</option>
                                    <option value="1° Libero">1° Libero</option>
                                    <option value="2° Libero">2° Libero</option>
                                  </select>
                                ) : isCalledUp ? (
                                  <span className="font-semibold text-slate-200">{callUp?.roleInMatch}</span>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>

                              <td className="p-3">
                                {isCalledUp ? (
                                  <div>
                                    <span
                                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${
                                        callUp?.confirmed === 'confermato'
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          : callUp?.confirmed === 'non_disponibile'
                                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      }`}
                                    >
                                      {callUp?.confirmed === 'confermato'
                                        ? 'Confermato'
                                        : callUp?.confirmed === 'non_disponibile'
                                        ? 'Non Disponibile'
                                        : 'In Attesa'}
                                    </span>
                                    {callUp?.responseNote && (
                                      <p className="text-[10px] text-slate-400 mt-0.5 italic">
                                        Nota: {callUp.responseNote}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-500 text-[10px]">-</span>
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

              {/* TAB: SCORE & MATCH REPORT */}
              {activeTabModal === 'score' && (
                <div className="space-y-6">
                  {selectedMatch.score ? (
                    <div className="p-5 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Risultato Finale
                        </span>
                        <span className="text-2xl font-black text-emerald-400">
                          {selectedMatch.score.setsHome} - {selectedMatch.score.setsAway}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs text-slate-400 block font-medium mb-1">Parziali Set:</span>
                        <div className="flex gap-2">
                          {selectedMatch.score.partialScores?.map((p, i) => (
                            <span key={i} className="px-3 py-1 bg-[#11141d] rounded-lg text-xs font-bold text-white border border-slate-800">
                              Set {i + 1}: {p}
                            </span>
                          ))}
                        </div>
                      </div>

                      {selectedMatch.score.matchReport && (
                        <div className="p-3 bg-[#11141d] rounded-xl border border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Cronaca & Commento Tecnico
                          </span>
                          <p className="text-xs text-slate-300">{selectedMatch.score.matchReport}</p>
                        </div>
                      )}
                    </div>
                  ) : isCoach ? (
                    <form
                      onSubmit={(e) => {
                        const target = e.target as any;
                        const setsHome = Number(target.setsHome.value);
                        const setsAway = Number(target.setsAway.value);
                        const partials = target.partials.value.split(',').map((s: string) => s.trim());
                        const report = target.report.value;
                        handleSaveScore(e, {
                          setsHome,
                          setsAway,
                          partialScores: partials,
                          matchReport: report,
                        });
                      }}
                      className="p-5 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-4 text-xs"
                    >
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        Inserisci Risultato & Tabellino Finale
                      </h4>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-400 mb-1">Set Volley Spike Club</label>
                          <input
                            name="setsHome"
                            type="number"
                            min="0"
                            max="3"
                            defaultValue={3}
                            required
                            className="w-full bg-[#11141d] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Set {selectedMatch.opponent}</label>
                          <input
                            name="setsAway"
                            type="number"
                            min="0"
                            max="3"
                            defaultValue={1}
                            required
                            className="w-full bg-[#11141d] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Punteggi Parziali (separati da virgola)</label>
                        <input
                          name="partials"
                          type="text"
                          defaultValue="25-22, 23-25, 25-18, 25-20"
                          placeholder="es. 25-22, 23-25, 25-18, 25-20"
                          className="w-full bg-[#11141d] border border-slate-700 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Commento Tecnico & Note Gara</label>
                        <textarea
                          name="report"
                          rows={3}
                          placeholder="Commento sulla prestazione della squadra, punti chiave e decisioni tattiche..."
                          className="w-full bg-[#11141d] border border-slate-700 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-600/20"
                        >
                          Salva Risultato Finale
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-8 text-center bg-[#0b0e14] rounded-2xl border border-slate-800">
                      <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-300">Partita non ancora disputata</p>
                      <p className="text-xs text-slate-500 mt-0.5">Il tabellino sarà inserito dallo staff dopo la fine del match.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add New Match Modal */}
      {showAddMatchModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowAddMatchModal(false)}
        >
          <div
            id="add-match-modal-container"
            className="bg-[#11141d] border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                Aggiungi Partita a Calendario
              </h2>
            </div>

            <form onSubmit={handleCreateMatchSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-medium">Squadra Avversaria *</label>
                  <input
                    type="text"
                    required
                    placeholder="es. ASD Volley Milano Stars"
                    value={newMatchData.opponent}
                    onChange={(e) => setNewMatchData({ ...newMatchData, opponent: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Data Partita *</label>
                  <input
                    type="date"
                    required
                    value={newMatchData.date}
                    onChange={(e) => setNewMatchData({ ...newMatchData, date: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Orario Inizio *</label>
                  <input
                    type="time"
                    required
                    value={newMatchData.time}
                    onChange={(e) => setNewMatchData({ ...newMatchData, time: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Campionato</label>
                  <input
                    type="text"
                    value={newMatchData.championship}
                    onChange={(e) => setNewMatchData({ ...newMatchData, championship: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Giornata / Turno</label>
                  <input
                    type="text"
                    value={newMatchData.round}
                    onChange={(e) => setNewMatchData({ ...newMatchData, round: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Sede Incontro</label>
                  <select
                    value={newMatchData.isHome ? 'home' : 'away'}
                    onChange={(e) => setNewMatchData({ ...newMatchData, isHome: e.target.value === 'home' })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="home">In Casa (PalaVolley)</option>
                    <option value="away">In Trasferta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nome Palazzetto / Palestra</label>
                  <input
                    type="text"
                    value={newMatchData.locationName}
                    onChange={(e) => setNewMatchData({ ...newMatchData, locationName: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-medium">Indirizzo Completo</label>
                  <input
                    type="text"
                    value={newMatchData.locationAddress}
                    onChange={(e) => setNewMatchData({ ...newMatchData, locationAddress: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddMatchModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Salva Partita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
