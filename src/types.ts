export type UserRole = 'coach' | 'staff' | 'athlete';

export interface User {
  id: string;
  email: string;
  username: string;
  password?: string;
  firstName: string;
  lastName: string;
  name?: string;
  role: UserRole;
  athleteId?: string; // Linked athlete profile if role === 'athlete'
  avatar?: string;
  team?: string;
  phone?: string;
  createdAt?: string;
  lastLogin?: string;
}

export type AthleteRole = 'Schiacciatore' | 'Opposto' | 'Centrale' | 'Palleggiatore' | 'Libero';
export type AthleteStatus = 'attivo' | 'infortunato' | 'in_recupero' | 'permesso';

export interface PhysicalProgressEntry {
  id: string;
  date: string;
  weightKg: number;
  spikeReachCm: number; // Salto in attacco
  blockReachCm: number; // Salto a muro
  verticalJumpCm: number; // Elevazione pura
  agilitySeconds?: number;
  benchPressKg?: number;
  notes?: string;
}

export interface TechnicalEvaluationEntry {
  id: string;
  date: string;
  evaluatorName: string;
  serveRating: number; // 1 - 10 (Battuta)
  receptionRating: number; // 1 - 10 (Ricezione)
  setRating: number; // 1 - 10 (Alzata/Palleggio)
  attackRating: number; // 1 - 10 (Attacco)
  blockRating: number; // 1 - 10 (Muro)
  defenseRating: number; // 1 - 10 (Difesa)
  tacticalIQRating: number; // 1 - 10 (Visione di gioco/Tattica)
  notes?: string;
  strengths: string[];
  areasToImprove: string[];
}

export interface InjuryRecord {
  id: string;
  athleteId: string;
  dateReported: string;
  title: string;
  injuryType: 'Distorsione' | 'Contrattura' | 'Stiramento/Strappo' | 'Tendinopatia' | 'Frattura' | 'Lussazione' | 'Altro';
  bodyPart: 'Caviglia' | 'Ginocchio' | 'Spalla' | 'Polso/Dita' | 'Schiena' | 'Coscia/Polpaccio' | 'Altro';
  severity: 'lieve' | 'moderata' | 'grave';
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: 'attivo' | 'in_cura' | 'recuperato';
  doctorDiagnosis?: string;
  physioNotes?: string;
  clearanceDoctor?: string;
}

export interface AthleteStats {
  matchesPlayed: number;
  setsPlayed: number;
  totalPoints: number;
  aces: number;
  serveErrors: number;
  attackKills: number;
  attackErrors: number;
  attackAttempts: number;
  blockPoints: number;
  blockTouches: number;
  receptionTotal: number;
  receptionPerfect: number;
  receptionErrors: number;
  digsTotal: number;
}

export interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  fiscalCode?: string;
  jerseyNumber: number;
  role: AthleteRole;
  secondaryRole?: AthleteRole;
  birthDate: string;
  heightCm?: number;
  weightKg?: number;
  spikeReachCm?: number;
  blockReachCm?: number;
  medicalCertExpiry: string;
  medicalCertValid: boolean;
  phone: string;
  email: string;
  photoUrl: string;
  status: AthleteStatus;
  notes?: string;
  category: string; // e.g. "Serie C Maschile", "Under 19"
  stats: AthleteStats;
  physicalProgress: PhysicalProgressEntry[];
  technicalEvaluations: TechnicalEvaluationEntry[];
  injuries: InjuryRecord[];
}

export interface TrainingDrill {
  id: string;
  name: string;
  durationMinutes: number;
  description: string;
}

export interface TrainingAttendee {
  athleteId: string;
  status: 'presente' | 'assente' | 'giustificato' | 'infortunato' | 'in_ritardo';
  checkInTime?: string;
  coachNotes?: string;
  performanceRating?: number; // 1-5
}

export interface TrainingSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
  teamCategory: string;
  title: string;
  objective: string;
  primaryFocus: 'Ricezione/Attacco' | 'Fase Break & Muro' | 'Palleggio & Schemi' | 'Potenziamento Fisico' | 'Partitella & Tattica' | 'Battuta & Ricezione';
  drills: TrainingDrill[];
  coachNotes?: string;
  maxParticipants?: number;
  registeredAthleteIds: string[]; // Atleti iscritti tramite dashboard
  attendees: TrainingAttendee[]; // Presenze effettive segnate dal coach
  status: 'programmato' | 'in_corso' | 'completato' | 'annullato';
}

export interface MatchCallUp {
  athleteId: string;
  roleInMatch: 'Titolare' | 'Panchina' | 'Capitano' | 'Vice Capitano' | '1° Libero' | '2° Libero';
  confirmed: 'in_attesa' | 'confermato' | 'non_disponibile';
  responseNote?: string;
  respondedAt?: string;
}

export interface MatchEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  category: string;
  championship: string;
  round: string; // es. "7ª Giornata"
  opponent: string;
  isHome: boolean;
  locationName: string;
  locationAddress: string;
  callUpStatus: 'bozza' | 'pubblicata' | 'conclusa';
  convocati: MatchCallUp[];
  score?: {
    setsHome: number;
    setsAway: number;
    partialScores: string[]; // es. ["25-22", "23-25", "25-18", "25-20"]
    mvpAthleteId?: string;
    matchReport?: string;
  };
}

export interface ClubInfo {
  name: string;
  tagline: string;
  city: string;
  gymnasium: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}
