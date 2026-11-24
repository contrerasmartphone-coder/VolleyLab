import React from 'react';
import { Athlete } from '../../types';
import { Shield, Activity, AlertCircle, CheckCircle2, ChevronRight, Zap, Award, Edit2, Trash2 } from 'lucide-react';
import { getWhatsAppLink } from '../../lib/athleteValidation';
import { WhatsAppIcon } from '../common/WhatsAppIcon';

interface AthleteCardProps {
  athlete: Athlete;
  onSelect: (athlete: Athlete) => void;
  isCoach: boolean;
  onDelete?: (e: React.MouseEvent, athlete: Athlete) => void;
}

export const getRoleColor = (role: string) => {
  switch (role) {
    case 'Schiacciatore':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'Opposto':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    case 'Centrale':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'Palleggiatore':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    case 'Libero':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
};

export const AthleteCard: React.FC<AthleteCardProps> = ({
  athlete,
  onSelect,
  isCoach,
  onDelete,
}) => {

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'attivo':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            IDONEO
          </span>
        );
      case 'infortunato':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            INFORTUNATO
          </span>
        );
      case 'in_recupero':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
            <Activity className="w-3 h-3 text-amber-400" />
            IN RECUPERO
          </span>
        );
      default:
        return null;
    }
  };

  // Active injuries count
  const activeInjuries = athlete.injuries?.filter((i) => i.status !== 'recuperato') || [];

  return (
    <div
      id={`athlete-card-${athlete.id}`}
      onClick={() => onSelect(athlete)}
      className="group relative bg-[#11141d] hover:bg-[#161b26] border border-slate-800 hover:border-slate-700 rounded-3xl p-4 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-2xl hover:-translate-y-0.5 flex flex-col justify-between"
    >
      <div>
        {/* Top bar with Jersey Number, Role and Status */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0b0e14] to-[#161b26] border border-slate-800 flex items-center justify-center font-black text-sm text-amber-400 shadow-inner group-hover:border-amber-500/50 transition-colors">
              #{athlete.jerseyNumber}
            </div>
            <div>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${getRoleColor(athlete.role)}`}>
                {athlete.role}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {getStatusBadge(athlete.status)}
            <span
              className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full border ${
                new Date(athlete.medicalCertExpiry) >= new Date()
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}
            >
              {new Date(athlete.medicalCertExpiry) >= new Date() ? 'CERT.VALIDO' : 'CERT.NON VALIDO'}
            </span>
          </div>
        </div>

        {/* Player Photo and Name */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative">
            <img
              src={athlete.photoUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80'}
              alt={`${athlete.firstName} ${athlete.lastName}`}
              className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-800 group-hover:ring-amber-500/40 transition-all"
            />
            {athlete.stats?.totalPoints > 150 && (
              <span className="absolute -bottom-1 -right-1 p-1 bg-amber-500 text-slate-950 rounded-full shadow-md" title="Top Scorer">
                <Award className="w-3 h-3" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors truncate">
              {athlete.firstName} {athlete.lastName}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-slate-400 font-medium">
                {athlete.heightCm} cm • {athlete.weightKg} kg
              </span>
            </div>
          </div>
        </div>


        {/* Active Injury Warning if any */}
        {activeInjuries.length > 0 && (
          <div className="mb-2 p-2 bg-rose-950/30 border border-rose-800/50 rounded-xl flex items-center gap-2 text-[11px] text-rose-300">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">
              Infortunio: <strong>{activeInjuries[0].title}</strong> ({activeInjuries[0].bodyPart})
            </span>
          </div>
        )}
      </div>

      {/* Footer / Open sheet indicator */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {athlete.phone && (
            <a
              href={getWhatsAppLink(athlete.phone)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium transition-all group hover:border-emerald-500/60 shadow-sm cursor-pointer"
              title={`Invia messaggio WhatsApp a ${athlete.firstName} (${athlete.phone})`}
            >
              <WhatsAppIcon className="w-3 h-3 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="font-mono text-[10px]">{athlete.phone}</span>
            </a>
          )}
        </div>
        {isCoach && (
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(athlete);
                    }}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                    title="Modifica scheda atleta"
                >
                    <Edit2 className="w-3.5 h-3.5" />
                </button>
                {onDelete && (
                  <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(e, athlete);
                      }}
                      className="p-1.5 hover:bg-rose-950/40 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Elimina atleta"
                  >
                      <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
