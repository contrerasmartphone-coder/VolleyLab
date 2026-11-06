import React from 'react';
import { Athlete, TrainingSession, MatchEvent, User } from '../../types';
import {
  User as UserIcon,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Activity,
  Award,
  Zap,
  Shield,
  HeartPulse,
  Flame,
  Check,
  ChevronRight,
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
} from 'recharts';
import { useDialog } from '../../context/DialogContext';

interface AthletePortalProps {
  athlete: Athlete | undefined;
  trainings: TrainingSession[];
  matches: MatchEvent[];
  onToggleTrainingReg: (training: TrainingSession) => Promise<void>;
  onConfirmMatchCallUp: (match: MatchEvent, status: 'confermato' | 'non_disponibile') => Promise<void>;
  onOpenMyDetailModal: () => void;
}

export const AthletePortal: React.FC<AthletePortalProps> = ({
  athlete,
  trainings,
  matches,
  onToggleTrainingReg,
  onConfirmMatchCallUp,
  onOpenMyDetailModal,
}) => {
  const { prompt, showToast } = useDialog();

  if (!athlete) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
        <UserIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white">Profilo Atleta non collegato</h3>
        <p className="text-xs text-slate-400 mt-1">
          Nessun record atleta associato a questo account. Contatta il coach.
        </p>
      </div>
    );
  }

  // Upcoming trainings (next 5)
  const nowStr = new Date().toISOString().split('T')[0];
  const upcomingTrainings = trainings
    .filter((t) => t.date >= nowStr || t.status === 'programmato')
    .slice(0, 4);

  // Upcoming matches with call-up for this athlete
  const myUpcomingMatches = matches.filter((m) =>
    m.convocati?.some((c) => c.athleteId === athlete.id)
  );

  // Physical jump progress data
  const progressData = (athlete.physicalProgress || []).map((p) => ({
    date: new Date(p.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
    spike: p.spikeReachCm,
    block: p.blockReachCm,
    weight: p.weightKg,
  }));

  // Latest Technical Radar
  const latestEval = athlete.technicalEvaluations?.[0];
  const radarData = latestEval
    ? [
        { subject: 'Battuta', value: latestEval.serveRating, fullMark: 10 },
        { subject: 'Ricezione', value: latestEval.receptionRating, fullMark: 10 },
        { subject: 'Alzata', value: latestEval.setRating, fullMark: 10 },
        { subject: 'Attacco', value: latestEval.attackRating, fullMark: 10 },
        { subject: 'Muro', value: latestEval.blockRating, fullMark: 10 },
        { subject: 'Difesa', value: latestEval.defenseRating, fullMark: 10 },
        { subject: 'Tattica', value: latestEval.tacticalIQRating, fullMark: 10 },
      ]
    : [];

  // Attendance calculation
  const myCompletedTrainings = trainings.filter((t) =>
    t.attendees?.some((a) => a.athleteId === athlete.id && a.status === 'presente')
  ).length;
  const totalCompletedSessions = trainings.filter((t) => t.status === 'completato').length || 1;
  const attendanceRate = Math.round((myCompletedTrainings / totalCompletedSessions) * 100);

  return (
    <div className="space-y-6">
      {/* Athlete Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <img
                src={athlete.photoUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80'}
                alt={athlete.lastName}
                className="w-20 h-20 rounded-2xl object-cover ring-2 ring-orange-500/50 shadow-xl"
              />
              <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-lg bg-orange-600 text-white font-black text-xs shadow-md">
                #{athlete.jerseyNumber}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white font-display">
                  {athlete.firstName} {athlete.lastName}
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full">
                  {athlete.role}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {athlete.category} • Visita medica valida fino al{' '}
                <strong className="text-emerald-400">{athlete.medicalCertExpiry}</strong>
              </p>

              <div className="flex items-center gap-4 mt-3 text-xs text-slate-300">
                <span>Altezza: <strong className="text-white">{athlete.heightCm ? `${athlete.heightCm} cm` : 'N/D'}</strong></span>
                <span>Peso: <strong className="text-white">{athlete.weightKg ? `${athlete.weightKg} kg` : 'N/D'}</strong></span>
                <span>Salto Attacco: <strong className="text-orange-400">{athlete.spikeReachCm ? `${athlete.spikeReachCm} cm` : 'N/D'}</strong></span>
              </div>
            </div>
          </div>

          <button
            id="open-my-full-dossier"
            onClick={onOpenMyDetailModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold rounded-xl border border-slate-700 transition-colors shadow-lg"
          >
            <Activity className="w-4 h-4 text-orange-400" />
            Visualizza Scheda Completa & Statistiche
          </button>
        </div>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Punti Totali Campionato</span>
              <span className="text-base font-bold text-white">{athlete.stats?.totalPoints || 0} pt</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Presenza Allenamenti</span>
              <span className="text-base font-bold text-emerald-400">{attendanceRate}%</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Ace / Battute Vincenti</span>
              <span className="text-base font-bold text-white">{athlete.stats?.aces || 0}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Muri Vincenti</span>
              <span className="text-base font-bold text-purple-400">{athlete.stats?.blockPoints || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Trainings Sign-up & Official Match Call-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trainings & Instant Registration */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                Iscrizione Prossimi Allenamenti
              </h2>
              <p className="text-xs text-slate-400">
                Iscriviti o conferma la tua presenza alle sessioni programmate
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {upcomingTrainings.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Nessun allenamento in programma.</p>
            ) : (
              upcomingTrainings.map((session) => {
                const isRegistered = session.registeredAthleteIds?.includes(athlete.id);
                return (
                  <div
                    key={session.id}
                    className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{session.title}</span>
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-slate-800 text-orange-400 border border-slate-700">
                          {session.primaryFocus}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 flex items-center gap-2">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {session.date} • {session.startTime} - {session.endTime}
                      </p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-600" />
                        {session.location}
                      </p>
                    </div>

                    <button
                      id={`athlete-portal-toggle-${session.id}`}
                      onClick={async () => {
                        await onToggleTrainingReg(session);
                        showToast({
                          message: isRegistered
                            ? 'Iscrizione all\'allenamento rimossa'
                            : 'Presenza all\'allenamento registrata!',
                          type: isRegistered ? 'info' : 'success',
                        });
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                        isRegistered
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-rose-950/30 hover:text-rose-300'
                          : 'bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/20'
                      }`}
                    >
                      {isRegistered ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Iscritto
                        </>
                      ) : (
                        '+ Iscriviti'
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Official Match Call-ups */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Convocazioni Partite Ufficiali
              </h2>
              <p className="text-xs text-slate-400">
                Gare di campionato a cui sei stato convocato dal mister
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {myUpcomingMatches.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Nessuna convocazione attiva al momento.</p>
            ) : (
              myUpcomingMatches.map((match) => {
                const callUp = match.convocati?.find((c) => c.athleteId === athlete.id);
                return (
                  <div
                    key={match.id}
                    className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white">vs {match.opponent}</span>
                        <span className="text-[10px] text-slate-400 block">{match.round} • {match.championship}</span>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-500/20 text-orange-400 rounded-md border border-orange-500/30">
                        Ruolo: {callUp?.roleInMatch || 'Titolare'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span>{match.date} alle {match.time}</span>
                      <span className="truncate max-w-[200px]">{match.locationName}</span>
                    </div>

                    {/* Confirmation state */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="text-[11px] text-slate-400">
                        Stato:{' '}
                        <strong className={callUp?.confirmed === 'confermato' ? 'text-emerald-400' : 'text-amber-400'}>
                          {callUp?.confirmed === 'confermato' ? 'Presenza Confermata' : 'In attesa di conferma'}
                        </strong>
                      </span>

                      {match.callUpStatus !== 'conclusa' && (
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              await onConfirmMatchCallUp(match, 'confermato');
                              showToast({
                                message: `Presenza alla gara contro ${match.opponent} confermata!`,
                                type: 'success',
                              });
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            ✓ Confermo
                          </button>
                          <button
                            onClick={async () => {
                              const reason = await prompt({
                                title: 'Motivo Indisponibilità Partita',
                                message: `Comunica allo staff il motivo della tua indisponibilità per la gara contro ${match.opponent}:`,
                                placeholder: 'Es. Infortunio, lavoro, esame universitario...',
                                confirmText: 'Invia Notifica',
                                cancelText: 'Annulla',
                              });
                              if (reason !== null) {
                                await onConfirmMatchCallUp(match, 'non_disponibile');
                                showToast({
                                  message: `Indisponibilità per la gara contro ${match.opponent} salvata`,
                                  type: 'warning',
                                });
                              }
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 rounded-lg text-xs cursor-pointer"
                          >
                            Non Disp.
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Charts Row: Physical Jump Progress & Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Physical Progression Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              I Tuoi Progressi di Salto & Elevazione (cm)
            </h3>
            <p className="text-xs text-slate-400">Evoluzione storica rilevata durante i test fisici</p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={['auto', 'auto']} unit=" cm" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="spike"
                  name="Salto Attacco (cm)"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#f97316' }}
                />
                <Line
                  type="monotone"
                  dataKey="block"
                  name="Salto Muro (cm)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#06b6d4' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Technical Radar Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Valutazione Tecnica del Coach (Radar 1-10)
            </h3>
            <p className="text-xs text-slate-400">
              {latestEval ? `Aggiornata al ${latestEval.date}` : 'Nessuna valutazione registrata'}
            </p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} stroke="#64748b" tick={{ fontSize: 8 }} />
                <Radar
                  name="Valutazione"
                  dataKey="value"
                  stroke="#06b6d4"
                  fill="#06b6d4"
                  fillOpacity={0.4}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
