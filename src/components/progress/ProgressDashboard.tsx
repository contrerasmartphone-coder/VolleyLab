import React, { useState } from 'react';
import { Athlete, TrainingSession } from '../../types';
import {
  Activity,
  Zap,
  TrendingUp,
  Award,
  Users,
  Target,
  BarChart3,
  Calendar,
  Sparkles,
  ArrowUpRight,
  Shield,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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

interface ProgressDashboardProps {
  athletes: Athlete[];
  trainings: TrainingSession[];
  onOpenAthleteModal?: (athlete: Athlete) => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  athletes,
  trainings,
  onOpenAthleteModal,
}) => {
  const [selectedAthleteId1, setSelectedAthleteId1] = useState<string>(athletes[0]?.id || '');
  const [selectedAthleteId2, setSelectedAthleteId2] = useState<string>(athletes[1]?.id || '');
  const [chartMetric, setChartMetric] = useState<'spike' | 'block' | 'jump'>('spike');

  const athlete1 = athletes.find((a) => a.id === selectedAthleteId1) || athletes[0];
  const athlete2 = athletes.find((a) => a.id === selectedAthleteId2) || athletes[1];

  // Prepare Jump Reach data for all athletes
  const jumpComparisonData = athletes.map((a) => ({
    name: `${a.jerseyNumber}. ${a.lastName}`,
    role: a.role,
    spikeReach: a.spikeReachCm,
    blockReach: a.blockReachCm,
    netElevation: a.spikeReachCm - a.heightCm,
    height: a.heightCm,
  })).sort((a, b) => b.spikeReach - a.spikeReach);

  // Prepare Radar Comparison Data for 2 selected athletes
  const eval1 = athlete1?.technicalEvaluations?.[0];
  const eval2 = athlete2?.technicalEvaluations?.[0];

  const comparativeRadarData = [
    { subject: 'Battuta', [athlete1?.lastName || 'Atleta 1']: eval1?.serveRating || 7, [athlete2?.lastName || 'Atleta 2']: eval2?.serveRating || 7, fullMark: 10 },
    { subject: 'Ricezione', [athlete1?.lastName || 'Atleta 1']: eval1?.receptionRating || 7, [athlete2?.lastName || 'Atleta 2']: eval2?.receptionRating || 6, fullMark: 10 },
    { subject: 'Alzata', [athlete1?.lastName || 'Atleta 1']: eval1?.setRating || 6, [athlete2?.lastName || 'Atleta 2']: eval2?.setRating || 7, fullMark: 10 },
    { subject: 'Attacco', [athlete1?.lastName || 'Atleta 1']: eval1?.attackRating || 8, [athlete2?.lastName || 'Atleta 2']: eval2?.attackRating || 8, fullMark: 10 },
    { subject: 'Muro', [athlete1?.lastName || 'Atleta 1']: eval1?.blockRating || 7.5, [athlete2?.lastName || 'Atleta 2']: eval2?.blockRating || 8, fullMark: 10 },
    { subject: 'Difesa', [athlete1?.lastName || 'Atleta 1']: eval1?.defenseRating || 7, [athlete2?.lastName || 'Atleta 2']: eval2?.defenseRating || 7, fullMark: 10 },
    { subject: 'Tattica', [athlete1?.lastName || 'Atleta 1']: eval1?.tacticalIQRating || 8, [athlete2?.lastName || 'Atleta 2']: eval2?.tacticalIQRating || 7.5, fullMark: 10 },
  ];

  // Leaderboards
  const topScorers = [...athletes].sort((a, b) => (b.stats?.totalPoints || 0) - (a.stats?.totalPoints || 0)).slice(0, 5);
  const topAces = [...athletes].sort((a, b) => (b.stats?.aces || 0) - (a.stats?.aces || 0)).slice(0, 5);
  const topBlockers = [...athletes].sort((a, b) => (b.stats?.blockPoints || 0) - (a.stats?.blockPoints || 0)).slice(0, 5);
  const topJumpers = [...athletes].sort((a, b) => (b.spikeReachCm - b.heightCm) - (a.spikeReachCm - a.heightCm)).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-white font-display tracking-tight">
                Dashboard Progressi Fisici & Tecnici
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
                Analisi Prestazionale
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Monitoraggio evoluzione elevazione, radar dei fondamentali, confronto atleti e classifiche di rendimento
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Comparison Chart & Jumps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Full Team Jumps Comparison (2 cols) */}
        <div className="lg:col-span-2 bg-[#11141d] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Confronto Elevazione & Salti Squadra (cm)
              </h2>
              <p className="text-xs text-slate-400">Rilevazione altezze di stacco in attacco e a muro</p>
            </div>

            {/* Metric Switch */}
            <div className="flex items-center bg-[#0b0e14] border border-slate-800 rounded-xl p-1">
              <button
                onClick={() => setChartMetric('spike')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  chartMetric === 'spike' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Salto Attacco
              </button>
              <button
                onClick={() => setChartMetric('block')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  chartMetric === 'block' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Salto Muro
              </button>
              <button
                onClick={() => setChartMetric('jump')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  chartMetric === 'jump' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Elevazione Netta
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={jumpComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={10}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis stroke="#64748b" fontSize={11} domain={['auto', 'auto']} unit=" cm" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0b0e14',
                    borderColor: '#1e293b',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                {chartMetric === 'spike' && (
                  <Bar dataKey="spikeReach" name="Salto in Attacco (cm)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                )}
                {chartMetric === 'block' && (
                  <Bar dataKey="blockReach" name="Salto a Muro (cm)" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                )}
                {chartMetric === 'jump' && (
                  <Bar dataKey="netElevation" name="Elevazione Pura (cm)" fill="#10b981" radius={[6, 6, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Head to Head Comparison */}
        <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" />
              Confronto Tecnico Diretto (Radar)
            </h2>
            <p className="text-xs text-slate-400">Seleziona due giocatori per confrontare i fondamentali</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium text-[10px]">Giocatore A (Ambra)</label>
              <select
                value={selectedAthleteId1}
                onChange={(e) => setSelectedAthleteId1(e.target.value)}
                className="w-full bg-[#0b0e14] border border-amber-500/40 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
              >
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    #{a.jerseyNumber} {a.lastName} ({a.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium text-[10px]">Giocatore B (Ciano)</label>
              <select
                value={selectedAthleteId2}
                onChange={(e) => setSelectedAthleteId2(e.target.value)}
                className="w-full bg-[#0b0e14] border border-cyan-500/40 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
              >
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    #{a.jerseyNumber} {a.lastName} ({a.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={comparativeRadarData}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} stroke="#475569" tick={{ fontSize: 8 }} />
                <Radar
                  name={athlete1?.lastName || 'Atleta 1'}
                  dataKey={athlete1?.lastName || 'Atleta 1'}
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.3}
                />
                <Radar
                  name={athlete2?.lastName || 'Atleta 2'}
                  dataKey={athlete2?.lastName || 'Atleta 2'}
                  stroke="#06b6d4"
                  fill="#06b6d4"
                  fillOpacity={0.3}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Leaderboards Grid (4 cols) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Top Scorer */}
        <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              Top Scorers
            </span>
            <span className="text-[10px] text-slate-500 font-bold">Punti Totali</span>
          </div>
          <div className="space-y-2">
            {topScorers.map((ath, idx) => (
              <div
                key={ath.id}
                onClick={() => onOpenAthleteModal && onOpenAthleteModal(ath)}
                className="flex items-center justify-between p-2 rounded-xl bg-[#0b0e14] hover:bg-[#161b26] cursor-pointer transition-colors border border-slate-800/60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${
                    idx === 0 ? 'bg-amber-500 text-slate-950' : 'bg-[#11141d] text-slate-400 border border-slate-800'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <span className="text-xs font-bold text-white block truncate">
                      {ath.firstName} {ath.lastName}
                    </span>
                    <span className="text-[10px] text-slate-400">{ath.role}</span>
                  </div>
                </div>
                <span className="text-xs font-black text-amber-400 shrink-0 ml-2">
                  {ath.stats?.totalPoints || 0} pt
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Aces */}
        <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              Specialisti Battuta
            </span>
            <span className="text-[10px] text-slate-500 font-bold">Ace Realizzati</span>
          </div>
          <div className="space-y-2">
            {topAces.map((ath, idx) => (
              <div
                key={ath.id}
                onClick={() => onOpenAthleteModal && onOpenAthleteModal(ath)}
                className="flex items-center justify-between p-2 rounded-xl bg-[#0b0e14] hover:bg-[#161b26] cursor-pointer transition-colors border border-slate-800/60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${
                    idx === 0 ? 'bg-amber-500 text-slate-950' : 'bg-[#11141d] text-slate-400 border border-slate-800'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <span className="text-xs font-bold text-white block truncate">
                      {ath.firstName} {ath.lastName}
                    </span>
                    <span className="text-[10px] text-slate-400">{ath.role}</span>
                  </div>
                </div>
                <span className="text-xs font-black text-amber-400 shrink-0 ml-2">
                  {ath.stats?.aces || 0} ace
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Blockers */}
        <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              Muro & Fase Break
            </span>
            <span className="text-[10px] text-slate-500 font-bold">Muri Punto</span>
          </div>
          <div className="space-y-2">
            {topBlockers.map((ath, idx) => (
              <div
                key={ath.id}
                onClick={() => onOpenAthleteModal && onOpenAthleteModal(ath)}
                className="flex items-center justify-between p-2 rounded-xl bg-[#0b0e14] hover:bg-[#161b26] cursor-pointer transition-colors border border-slate-800/60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${
                    idx === 0 ? 'bg-emerald-500 text-slate-950' : 'bg-[#11141d] text-slate-400 border border-slate-800'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <span className="text-xs font-bold text-white block truncate">
                      {ath.firstName} {ath.lastName}
                    </span>
                    <span className="text-[10px] text-slate-400">{ath.role}</span>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-400 shrink-0 ml-2">
                  {ath.stats?.blockPoints || 0} muri
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Elevation */}
        <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Elevazione Pura
            </span>
            <span className="text-[10px] text-slate-500 font-bold">Salto Netto</span>
          </div>
          <div className="space-y-2">
            {topJumpers.map((ath, idx) => (
              <div
                key={ath.id}
                onClick={() => onOpenAthleteModal && onOpenAthleteModal(ath)}
                className="flex items-center justify-between p-2 rounded-xl bg-[#0b0e14] hover:bg-[#161b26] cursor-pointer transition-colors border border-slate-800/60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${
                    idx === 0 ? 'bg-cyan-500 text-slate-950' : 'bg-[#11141d] text-slate-400 border border-slate-800'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <span className="text-xs font-bold text-white block truncate">
                      {ath.firstName} {ath.lastName}
                    </span>
                    <span className="text-[10px] text-slate-400">Attacco {ath.spikeReachCm} cm</span>
                  </div>
                </div>
                <span className="text-xs font-black text-cyan-400 shrink-0 ml-2">
                  +{ath.spikeReachCm - ath.heightCm} cm
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
