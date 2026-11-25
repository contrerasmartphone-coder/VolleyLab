import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Athlete,
  TrainingSession,
  TrainingAttendee,
  TrainingAbsence,
  MatchEvent,
  MatchCallUp,
  MatchScoutSet,
  User,
  RestoreHistoryEntry,
} from '../types';
import { INITIAL_USERS } from './mockData';

const COLLECTIONS = {
  USERS: 'users',
  ATHLETES: 'athletes',
  TRAININGS: 'trainings',
  MATCHES: 'matches',
  RESTORE_POINTS: 'restore_points',
  RESTORE_HISTORY: 'restore_history',
};

// Fallback Local Storage Keys
const LS_KEYS = {
  USERS: 'vm_users_cache',
  ATHLETES: 'vm_athletes_cache',
  TRAININGS: 'vm_trainings_cache',
  MATCHES: 'vm_matches_cache',
};

// Per-document async queue so rapid consecutive mutations from the same client are strictly serialized
const docMutationQueues = new Map<string, Promise<unknown>>();

function enqueueDocMutation<T>(docKey: string, task: () => Promise<T>): Promise<T> {
  const previous = docMutationQueues.get(docKey) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const tail = next.catch(() => undefined);
  docMutationQueues.set(docKey, tail);
  tail.finally(() => {
    if (docMutationQueues.get(docKey) === tail) {
      docMutationQueues.delete(docKey);
    }
  });
  return next;
}

// Helper for local storage backup
function getLocal<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function upsertLocalCollectionItem<T extends { id: string }>(key: string, item: T): void {
  const current = getLocal<T[]>(key, []);
  const idx = current.findIndex((x) => x.id === item.id);
  if (idx >= 0) current[idx] = item;
  else current.push(item);
  setLocal(key, current);
}

function removeLocalCollectionItem<T extends { id: string }>(key: string, id: string): void {
  const current = getLocal<T[]>(key, []);
  setLocal(
    key,
    current.filter((x) => x.id !== id)
  );
}

// ----------------- QUOTA & RESILIENCE HELPERS -----------------
let isQuotaExceeded = false;
const quotaListeners = new Set<(exceeded: boolean) => void>();

export function isFirestoreQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  const msg = String(e.message || '');
  return (
    e.code === 'resource-exhausted' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('Free daily read units')
  );
}

function notifyQuotaExceeded(): void {
  if (!isQuotaExceeded) {
    isQuotaExceeded = true;
    quotaListeners.forEach((cb) => cb(true));
  }
}

export function subscribeToQuotaStatus(callback: (exceeded: boolean) => void): () => void {
  quotaListeners.add(callback);
  callback(isQuotaExceeded);
  return () => {
    quotaListeners.delete(callback);
  };
}

// ----------------- SEEDING (SAFE & NON-DESTRUCTIVE) -----------------
let seedPromise: Promise<void> | null = null;

export async function seedInitialDataIfEmpty(force = false): Promise<void> {
  if (!force && seedPromise) {
    return seedPromise;
  }

  const runSeed = async () => {
    try {
      const cachedUsers = getLocal<User[]>(LS_KEYS.USERS, []);
      if (!force && cachedUsers.length > 0) {
        return;
      }

      const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
      // Provision initial base users only if the users collection is completely empty
      if (usersSnap.empty || force) {
        console.log('Synchronizing VolleyLab base users into empty collection...');
        for (const u of INITIAL_USERS) {
          await setDoc(doc(db, COLLECTIONS.USERS, u.id), u);
        }
        setLocal(LS_KEYS.USERS, INITIAL_USERS);
      } else {
        const list = usersSnap.docs.map((d) => d.data() as User);
        setLocal(LS_KEYS.USERS, list);
      }
      // Athletes, trainings, and matches are NEVER cleared or deleted on startup
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        notifyQuotaExceeded();
        console.warn('Firestore quota exceeded during initial user check; using cached users.');
      } else {
        console.warn('Firestore initial user check:', err);
      }
      if (!localStorage.getItem(LS_KEYS.USERS)) setLocal(LS_KEYS.USERS, INITIAL_USERS);
    }
  };

  if (!force) {
    seedPromise = runSeed();
    return seedPromise;
  }
  return runSeed();
}

// ----------------- USERS -----------------
export async function fetchUsers(): Promise<User[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.USERS));
    const list = snap.docs.map((d) => d.data() as User);
    if (list.length > 0) {
      setLocal(LS_KEYS.USERS, list);
      return list;
    }
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      notifyQuotaExceeded();
    }
    console.warn('Error fetching users from Firestore:', err);
  }
  return getLocal<User[]>(LS_KEYS.USERS, INITIAL_USERS);
}

export function subscribeToUsers(callback: (users: User[]) => void): () => void {
  let hasEmitted = false;
  try {
    const q = query(collection(db, COLLECTIONS.USERS));
    return onSnapshot(
      q,
      (snap) => {
        hasEmitted = true;
        const list = snap.docs.map((d) => d.data() as User);
        setLocal(LS_KEYS.USERS, list);
        callback(list);
      },
      (err) => {
        if (isFirestoreQuotaError(err)) {
          notifyQuotaExceeded();
          console.warn('Users live listener paused (Firestore daily quota exceeded); serving cached users.');
        } else {
          console.error('Users live listener error:', err);
        }
        if (!hasEmitted) {
          callback(getLocal<User[]>(LS_KEYS.USERS, INITIAL_USERS));
        }
      }
    );
  } catch (err) {
    callback(getLocal<User[]>(LS_KEYS.USERS, INITIAL_USERS));
    return () => {};
  }
}

// Recursively remove undefined values so Firestore setDoc does not throw
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return null as unknown as T;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(data as Record<string, any>)) {
      if (val !== undefined) {
        cleaned[key] = sanitizeForFirestore(val);
      }
    }
    return cleaned as T;
  }
  return data;
}

export async function saveUserToDb(user: User): Promise<void> {
  try {
    const cleanUser = sanitizeForFirestore(user);
    await setDoc(doc(db, COLLECTIONS.USERS, user.id), cleanUser);
    upsertLocalCollectionItem(LS_KEYS.USERS, user);
  } catch (err) {
    console.error('Error saving user to Firestore:', err);
    throw err;
  }
}

export async function deleteUserFromDb(userId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.USERS, userId));
    removeLocalCollectionItem<User>(LS_KEYS.USERS, userId);
  } catch (err) {
    console.error('Error deleting user from Firestore:', err);
    throw err;
  }
}

// ----------------- ATHLETES -----------------
export async function fetchAthletes(): Promise<Athlete[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.ATHLETES));
    const list = snap.docs.map((d) => d.data() as Athlete);
    setLocal(LS_KEYS.ATHLETES, list);
    return list;
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      notifyQuotaExceeded();
    }
    console.warn('Error fetching athletes from Firestore:', err);
  }
  return getLocal<Athlete[]>(LS_KEYS.ATHLETES, []);
}

export function subscribeToAthletes(callback: (athletes: Athlete[]) => void): () => void {
  let hasEmitted = false;
  try {
    const q = query(collection(db, COLLECTIONS.ATHLETES));
    return onSnapshot(
      q,
      (snap) => {
        hasEmitted = true;
        const list = snap.docs.map((d) => d.data() as Athlete);
        setLocal(LS_KEYS.ATHLETES, list);
        callback(list);
      },
      (err) => {
        if (isFirestoreQuotaError(err)) {
          notifyQuotaExceeded();
          console.warn('Athletes live listener paused (Firestore daily quota exceeded); serving cached athletes.');
        } else {
          console.error('Athletes live listener error:', err);
        }
        if (!hasEmitted) {
          callback(getLocal<Athlete[]>(LS_KEYS.ATHLETES, []));
        }
      }
    );
  } catch (err) {
    callback(getLocal<Athlete[]>(LS_KEYS.ATHLETES, []));
    return () => {};
  }
}

export async function saveAthleteToDb(athlete: Athlete): Promise<void> {
  try {
    await setDoc(doc(db, COLLECTIONS.ATHLETES, athlete.id), sanitizeForFirestore(athlete));
    upsertLocalCollectionItem(LS_KEYS.ATHLETES, athlete);
  } catch (err) {
    console.error('Error saving athlete to Firestore:', err);
    throw err;
  }
}

export async function deleteAthleteFromDb(athleteId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.ATHLETES, athleteId));
    removeLocalCollectionItem<Athlete>(LS_KEYS.ATHLETES, athleteId);
  } catch (err) {
    console.error('Error deleting athlete from Firestore:', err);
    throw err;
  }
}

// ----------------- TRAININGS -----------------
export async function fetchTrainings(): Promise<TrainingSession[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.TRAININGS));
    const list = snap.docs.map((d) => d.data() as TrainingSession);
    list.sort((a, b) => (a.date > b.date ? -1 : 1));
    setLocal(LS_KEYS.TRAININGS, list);
    return list;
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      notifyQuotaExceeded();
    }
    console.warn('Error fetching trainings from Firestore:', err);
  }
  return getLocal<TrainingSession[]>(LS_KEYS.TRAININGS, []);
}

export function subscribeToTrainings(callback: (trainings: TrainingSession[]) => void): () => void {
  let hasEmitted = false;
  try {
    const q = query(collection(db, COLLECTIONS.TRAININGS));
    return onSnapshot(
      q,
      (snap) => {
        hasEmitted = true;
        const list = snap.docs.map((d) => d.data() as TrainingSession);
        list.sort((a, b) => (a.date > b.date ? -1 : 1));
        setLocal(LS_KEYS.TRAININGS, list);
        callback(list);
      },
      (err) => {
        if (isFirestoreQuotaError(err)) {
          notifyQuotaExceeded();
          console.warn('Trainings live listener paused (Firestore daily quota exceeded); serving cached trainings.');
        } else {
          console.error('Trainings live listener error:', err);
        }
        if (!hasEmitted) {
          callback(getLocal<TrainingSession[]>(LS_KEYS.TRAININGS, []));
        }
      }
    );
  } catch (err) {
    callback(getLocal<TrainingSession[]>(LS_KEYS.TRAININGS, []));
    return () => {};
  }
}

export async function saveTrainingToDb(training: TrainingSession): Promise<void> {
  return enqueueDocMutation(`trainings:${training.id}`, async () => {
    try {
      await setDoc(doc(db, COLLECTIONS.TRAININGS, training.id), sanitizeForFirestore(training));
      upsertLocalCollectionItem(LS_KEYS.TRAININGS, training);
    } catch (err) {
      console.error('Error saving training to Firestore:', err);
      throw err;
    }
  });
}

export async function deleteTrainingFromDb(trainingId: string): Promise<void> {
  return enqueueDocMutation(`trainings:${trainingId}`, async () => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.TRAININGS, trainingId));
      removeLocalCollectionItem<TrainingSession>(LS_KEYS.TRAININGS, trainingId);
    } catch (err) {
      console.error('Error deleting training from Firestore:', err);
      throw err;
    }
  });
}

// Atomic transaction-based updater for concurrent training writes (registrations, absences, attendance)
export async function mutateTrainingSessionAtomic(
  trainingId: string,
  buildPatch: (latest: TrainingSession) => Partial<TrainingSession>
): Promise<TrainingSession> {
  return enqueueDocMutation(`trainings:${trainingId}`, async () => {
    const ref = doc(db, COLLECTIONS.TRAININGS, trainingId);
    try {
      const updatedSession = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) {
          throw new Error('Sessione di allenamento non trovata nel database.');
        }
        const latest = snap.data() as TrainingSession;
        const patch = buildPatch(latest);
        const cleanPatch = sanitizeForFirestore(patch) as Partial<TrainingSession>;
        tx.update(ref, cleanPatch as Record<string, any>);
        return {
          ...latest,
          ...patch,
          id: latest.id,
        } as TrainingSession;
      });
      upsertLocalCollectionItem(LS_KEYS.TRAININGS, updatedSession);
      return updatedSession;
    } catch (err) {
      console.error('Atomic training transaction failed:', err);
      throw err;
    }
  });
}

export async function toggleTrainingRegistrationAtomic(
  trainingId: string,
  athleteId: string
): Promise<TrainingSession> {
  return mutateTrainingSessionAtomic(trainingId, (latest) => {
    const currentReg = latest.registeredAthleteIds || [];
    const currentAbsences = latest.absentAthletes || [];
    const isRegistered = currentReg.includes(athleteId);

    const registeredAthleteIds = isRegistered
      ? currentReg.filter((id) => id !== athleteId)
      : Array.from(new Set([...currentReg, athleteId]));

    const absentAthletes = isRegistered
      ? currentAbsences
      : currentAbsences.filter((a) => a.athleteId !== athleteId);

    return { registeredAthleteIds, absentAthletes };
  });
}

export async function setTrainingAbsenceAtomic(
  trainingId: string,
  athleteId: string,
  absent: boolean,
  reason?: string
): Promise<TrainingSession> {
  return mutateTrainingSessionAtomic(trainingId, (latest) => {
    const currentReg = latest.registeredAthleteIds || [];
    const currentAbsences = latest.absentAthletes || [];

    if (!absent) {
      return {
        absentAthletes: currentAbsences.filter((a) => a.athleteId !== athleteId),
      };
    }

    const newEntry: TrainingAbsence = {
      athleteId,
      reason: reason?.trim() || undefined,
      communicatedAt: new Date().toISOString(),
    };
    const absentAthletes = [
      ...currentAbsences.filter((a) => a.athleteId !== athleteId),
      newEntry,
    ];
    const registeredAthleteIds = currentReg.filter((id) => id !== athleteId);
    return { registeredAthleteIds, absentAthletes };
  });
}

export async function updateTrainingAttendeeAtomic(
  trainingId: string,
  athleteId: string,
  status: TrainingAttendee['status'],
  performanceRating?: number,
  notes?: string
): Promise<TrainingSession> {
  return mutateTrainingSessionAtomic(trainingId, (latest) => {
    const currentAttendees = [...(latest.attendees || [])];
    const existingIndex = currentAttendees.findIndex((a) => a.athleteId === athleteId);
    const existing = existingIndex >= 0 ? currentAttendees[existingIndex] : undefined;

    const attendeeRecord: TrainingAttendee = {
      athleteId,
      status,
      performanceRating: performanceRating ?? existing?.performanceRating,
      coachNotes: notes ?? existing?.coachNotes,
      checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (existingIndex >= 0) {
      currentAttendees[existingIndex] = attendeeRecord;
    } else {
      currentAttendees.push(attendeeRecord);
    }

    return { attendees: currentAttendees };
  });
}

export async function completeTrainingSessionAtomic(
  trainingId: string,
  athletes: Athlete[]
): Promise<TrainingSession> {
  return mutateTrainingSessionAtomic(trainingId, (latest) => {
    const regIds = new Set(latest.registeredAthleteIds || []);
    const absByAth = new Map(
      (latest.absentAthletes || []).map((ab) => [ab.athleteId, ab])
    );
    const existingByAth = new Map(
      (latest.attendees || []).map((att) => [att.athleteId, att])
    );

    const attendees: TrainingAttendee[] = athletes.map((a) => {
      const existing = existingByAth.get(a.id);
      const communicatedAbs = absByAth.get(a.id);
      const defaultStatus: TrainingAttendee['status'] =
        a.status === 'infortunato'
          ? 'infortunato'
          : regIds.has(a.id)
          ? 'presente'
          : communicatedAbs
          ? 'giustificato'
          : 'assente';

      return {
        athleteId: a.id,
        status: existing?.status ?? defaultStatus,
        checkInTime: existing?.checkInTime,
        coachNotes: existing?.coachNotes ?? communicatedAbs?.reason,
        performanceRating: existing?.performanceRating ?? 4,
      };
    });

    return {
      status: 'completato' as const,
      attendees,
    };
  });
}

export async function updateTrainingMetadataAtomic(
  trainingId: string,
  metadata: Pick<
    TrainingSession,
    | 'date'
    | 'startTime'
    | 'endTime'
    | 'location'
    | 'teamCategory'
    | 'title'
    | 'objective'
    | 'primaryFocus'
    | 'coachNotes'
    | 'drills'
  >
): Promise<TrainingSession> {
  return mutateTrainingSessionAtomic(trainingId, () => ({ ...metadata }));
}

// ----------------- MATCHES -----------------
export async function fetchMatches(): Promise<MatchEvent[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.MATCHES));
    const list = snap.docs.map((d) => d.data() as MatchEvent);
    list.sort((a, b) => (a.date > b.date ? 1 : -1));
    setLocal(LS_KEYS.MATCHES, list);
    return list;
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      notifyQuotaExceeded();
    }
    console.warn('Error fetching matches from Firestore:', err);
  }
  return getLocal<MatchEvent[]>(LS_KEYS.MATCHES, []);
}

export function subscribeToMatches(callback: (matches: MatchEvent[]) => void): () => void {
  let hasEmitted = false;
  try {
    const q = query(collection(db, COLLECTIONS.MATCHES));
    return onSnapshot(
      q,
      (snap) => {
        hasEmitted = true;
        const list = snap.docs.map((d) => d.data() as MatchEvent);
        list.sort((a, b) => (a.date > b.date ? 1 : -1));
        setLocal(LS_KEYS.MATCHES, list);
        callback(list);
      },
      (err) => {
        if (isFirestoreQuotaError(err)) {
          notifyQuotaExceeded();
          console.warn('Matches live listener paused (Firestore daily quota exceeded); serving cached matches.');
        } else {
          console.error('Matches live listener error:', err);
        }
        if (!hasEmitted) {
          callback(getLocal<MatchEvent[]>(LS_KEYS.MATCHES, []));
        }
      }
    );
  } catch (err) {
    callback(getLocal<MatchEvent[]>(LS_KEYS.MATCHES, []));
    return () => {};
  }
}

export async function saveMatchToDb(match: MatchEvent): Promise<void> {
  return enqueueDocMutation(`matches:${match.id}`, async () => {
    try {
      await setDoc(doc(db, COLLECTIONS.MATCHES, match.id), sanitizeForFirestore(match));
      upsertLocalCollectionItem(LS_KEYS.MATCHES, match);
    } catch (err) {
      console.error('Error saving match to Firestore:', err);
      throw err;
    }
  });
}

export async function deleteMatchFromDb(matchId: string): Promise<void> {
  return enqueueDocMutation(`matches:${matchId}`, async () => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.MATCHES, matchId));
      removeLocalCollectionItem<MatchEvent>(LS_KEYS.MATCHES, matchId);
    } catch (err) {
      console.error('Error deleting match from Firestore:', err);
      throw err;
    }
  });
}

export async function mutateMatchEventAtomic(
  matchId: string,
  buildPatch: (latest: MatchEvent) => Partial<MatchEvent>
): Promise<MatchEvent> {
  return enqueueDocMutation(`matches:${matchId}`, async () => {
    const ref = doc(db, COLLECTIONS.MATCHES, matchId);
    try {
      const updatedMatch = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) {
          throw new Error('Partita non trovata nel database.');
        }
        const latest = snap.data() as MatchEvent;
        const patch = buildPatch(latest);
        const cleanPatch = sanitizeForFirestore(patch) as Partial<MatchEvent>;
        tx.update(ref, cleanPatch as Record<string, any>);
        return {
          ...latest,
          ...patch,
          id: latest.id,
        } as MatchEvent;
      });
      upsertLocalCollectionItem(LS_KEYS.MATCHES, updatedMatch);
      return updatedMatch;
    } catch (err) {
      console.error('Atomic match transaction failed:', err);
      throw err;
    }
  });
}

export async function confirmMatchCallUpAtomic(
  matchId: string,
  athleteId: string,
  confirmed: 'confermato' | 'non_disponibile',
  responseNote?: string
): Promise<MatchEvent> {
  return mutateMatchEventAtomic(matchId, (latest) => {
    const currentCallUps = [...(latest.convocati || [])];
    const existingIdx = currentCallUps.findIndex((c) => c.athleteId === athleteId);
    if (existingIdx >= 0) {
      currentCallUps[existingIdx] = {
        ...currentCallUps[existingIdx],
        confirmed,
        responseNote: responseNote || currentCallUps[existingIdx].responseNote,
        respondedAt: new Date().toISOString(),
      };
    } else {
      const newCallUp: MatchCallUp = {
        athleteId,
        roleInMatch: 'Panchina',
        confirmed,
        responseNote,
        respondedAt: new Date().toISOString(),
      };
      currentCallUps.push(newCallUp);
    }
    return { convocati: currentCallUps };
  });
}

export async function updateMatchScoutSetAtomic(
  matchId: string,
  setNumber: 1 | 2 | 3 | 4 | 5,
  updater: (prevSet: MatchScoutSet) => MatchScoutSet,
  defaultLiberoIds: string[]
): Promise<MatchEvent> {
  return mutateMatchEventAtomic(matchId, (latest) => {
    const existingSets = [...(latest.scoutSets || [])];
    const idx = existingSets.findIndex((s) => s.setNumber === setNumber);
    const baseSet: MatchScoutSet =
      idx >= 0
        ? {
            setNumber: existingSets[idx].setNumber,
            lineup: existingSets[idx].lineup || {},
            liberoIds: existingSets[idx].liberoIds || [],
            substitutions: existingSets[idx].substitutions || [],
            events: existingSets[idx].events || [],
          }
        : {
            setNumber,
            lineup: {},
            liberoIds: defaultLiberoIds,
            substitutions: [],
            events: [],
          };

    const nextSet = updater(baseSet);
    if (idx >= 0) {
      existingSets[idx] = nextSet;
    } else {
      existingSets.push(nextSet);
    }
    existingSets.sort((a, b) => a.setNumber - b.setNumber);
    return { scoutSets: existingSets };
  });
}

export async function setMatchScoutPublishedAtomic(
  matchId: string,
  published: boolean
): Promise<MatchEvent> {
  return mutateMatchEventAtomic(matchId, () =>
    published
      ? {
          scoutPublishedToAthletes: true,
          scoutPublishedAt: new Date().toISOString(),
        }
      : {
          scoutPublishedToAthletes: false,
        }
  );
}

// Convenient Named Aliases
export const saveAthlete = saveAthleteToDb;
export const deleteAthlete = deleteAthleteFromDb;
export const subscribeAthletes = subscribeToAthletes;

export const saveTrainingSession = saveTrainingToDb;
export const deleteTrainingSession = deleteTrainingFromDb;
export const subscribeTrainings = subscribeToTrainings;

export const saveMatchEvent = saveMatchToDb;
export const deleteMatchEvent = deleteMatchFromDb;
export const subscribeMatches = subscribeToMatches;

export const saveUser = saveUserToDb;
export const deleteUser = deleteUserFromDb;
export const subscribeUsers = subscribeToUsers;

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year.length === 4) {
      return `${day}-${month}-${year}`;
    }
  }
  return dateStr;
}

// ----------------- BACKUP & RESTORE / POINT-IN-TIME RECOVERY -----------------
export interface SystemBackupPayload {
  version: string;
  exportedAt: string;
  app: string;
  stats: {
    athletesCount: number;
    trainingsCount: number;
    matchesCount: number;
    usersCount: number;
  };
  data: {
    athletes: Athlete[];
    trainings: TrainingSession[];
    matches: MatchEvent[];
    users: User[];
  };
}

export interface LocalRestorePoint {
  id: string;
  label: string;
  timestamp: string;
  athletesCount: number;
  trainingsCount: number;
  matchesCount: number;
  usersCount: number;
  isChunked?: boolean;
  chunkCount?: number;
  data?: SystemBackupPayload['data'] | null;
}

const RESTORE_POINTS_KEY = 'vm_system_restore_points_v1';
const RESTORE_HISTORY_KEY = 'vm_system_restore_history_v1';
const FIRESTORE_SINGLE_DOC_SAFE_BYTES = 700_000;
const FIRESTORE_CHUNK_SAFE_BYTES = 550_000;

function getUtf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  return str.length * 2;
}

function splitJsonIntoSafeChunks(str: string, maxBytes = FIRESTORE_CHUNK_SAFE_BYTES): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < str.length) {
    // Conservative initial step (UTF-8 max 3 bytes per UTF-16 code unit for BMP, 4 for surrogate pairs)
    let end = Math.min(str.length, start + Math.floor(maxBytes / 2));
    // Expand end while byte size fits safely
    while (end < str.length) {
      const nextEnd = Math.min(str.length, end + 20_000);
      if (getUtf8ByteLength(str.slice(start, nextEnd)) <= maxBytes) {
        end = nextEnd;
      } else {
        break;
      }
    }
    // Shrink if needed to guarantee byte limit
    while (end > start + 1 && getUtf8ByteLength(str.slice(start, end)) > maxBytes) {
      end -= Math.max(1, Math.floor((end - start) * 0.1));
    }
    // Avoid splitting inside a UTF-16 surrogate pair
    if (end < str.length) {
      const code = str.charCodeAt(end - 1);
      if (code >= 0xd800 && code <= 0xdbff) {
        end -= 1;
      }
    }
    chunks.push(str.slice(start, end));
    start = end;
  }

  return chunks;
}

export async function createFullSystemBackup(
  fallbackData?: {
    athletes?: Athlete[];
    trainings?: TrainingSession[];
    matches?: MatchEvent[];
    users?: User[];
  }
): Promise<SystemBackupPayload> {
  let athletesList: Athlete[] = [];
  let trainingsList: TrainingSession[] = [];
  let matchesList: MatchEvent[] = [];
  let usersList: User[] = [];

  try {
    const aSnap = await getDocs(collection(db, COLLECTIONS.ATHLETES));
    athletesList = aSnap.docs.map((d) => d.data() as Athlete);
  } catch (e) {
    athletesList = getLocal<Athlete[]>(LS_KEYS.ATHLETES, []);
  }
  if (athletesList.length === 0 && fallbackData?.athletes && fallbackData.athletes.length > 0) {
    athletesList = fallbackData.athletes;
  }

  try {
    const tSnap = await getDocs(collection(db, COLLECTIONS.TRAININGS));
    trainingsList = tSnap.docs.map((d) => d.data() as TrainingSession);
  } catch (e) {
    trainingsList = getLocal<TrainingSession[]>(LS_KEYS.TRAININGS, []);
  }
  if (trainingsList.length === 0 && fallbackData?.trainings && fallbackData.trainings.length > 0) {
    trainingsList = fallbackData.trainings;
  }

  try {
    const mSnap = await getDocs(collection(db, COLLECTIONS.MATCHES));
    matchesList = mSnap.docs.map((d) => d.data() as MatchEvent);
  } catch (e) {
    matchesList = getLocal<MatchEvent[]>(LS_KEYS.MATCHES, []);
  }
  if (matchesList.length === 0 && fallbackData?.matches && fallbackData.matches.length > 0) {
    matchesList = fallbackData.matches;
  }

  try {
    const uSnap = await getDocs(collection(db, COLLECTIONS.USERS));
    usersList = uSnap.docs.map((d) => d.data() as User);
  } catch (e) {
    usersList = getLocal<User[]>(LS_KEYS.USERS, []);
  }
  if (usersList.length === 0 && fallbackData?.users && fallbackData.users.length > 0) {
    usersList = fallbackData.users;
  }

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    app: 'VolleyLab Palermo',
    stats: {
      athletesCount: athletesList.length,
      trainingsCount: trainingsList.length,
      matchesCount: matchesList.length,
      usersCount: usersList.length,
    },
    data: {
      athletes: athletesList,
      trainings: trainingsList,
      matches: matchesList,
      users: usersList,
    },
  };
}

export async function restoreSystemFromBackup(
  backupData: SystemBackupPayload['data'],
  mode: 'merge' | 'replace' = 'replace'
): Promise<{ restoredAthletes: number; restoredTrainings: number; restoredMatches: number; restoredUsers: number }> {
  const totalBackupItems =
    (backupData?.athletes?.length || 0) +
    (backupData?.trainings?.length || 0) +
    (backupData?.matches?.length || 0) +
    (backupData?.users?.length || 0);

  if (mode === 'replace' && totalBackupItems === 0) {
    throw new Error('Impossibile effettuare il ripristino in modalità Sostituisci da un backup completamente vuoto.');
  }

  if (mode === 'replace') {
    try {
      // 1. Delete athletes not present in snapshot
      const aSnap = await getDocs(collection(db, COLLECTIONS.ATHLETES));
      const backupAthleteIds = new Set((backupData.athletes || []).map((a) => a.id));
      for (const d of aSnap.docs) {
        if (!backupAthleteIds.has(d.id)) {
          await deleteDoc(doc(db, COLLECTIONS.ATHLETES, d.id));
        }
      }

      // 2. Delete trainings not present in snapshot
      const tSnap = await getDocs(collection(db, COLLECTIONS.TRAININGS));
      const backupTrainingIds = new Set((backupData.trainings || []).map((t) => t.id));
      for (const d of tSnap.docs) {
        if (!backupTrainingIds.has(d.id)) {
          await deleteDoc(doc(db, COLLECTIONS.TRAININGS, d.id));
        }
      }

      // 3. Delete matches not present in snapshot
      const mSnap = await getDocs(collection(db, COLLECTIONS.MATCHES));
      const backupMatchIds = new Set((backupData.matches || []).map((m) => m.id));
      for (const d of mSnap.docs) {
        if (!backupMatchIds.has(d.id)) {
          await deleteDoc(doc(db, COLLECTIONS.MATCHES, d.id));
        }
      }
    } catch (e) {
      console.error('Replace mode cleanup error:', e);
      throw e;
    }
  }

  let restoredAthletes = 0;
  if (Array.isArray(backupData.athletes)) {
    for (const ath of backupData.athletes) {
      if (ath && ath.id) {
        const clean = sanitizeForFirestore(ath);
        await setDoc(doc(db, COLLECTIONS.ATHLETES, ath.id), clean);
        restoredAthletes++;
      }
    }
    setLocal(LS_KEYS.ATHLETES, backupData.athletes);
  } else if (mode === 'replace') {
    setLocal(LS_KEYS.ATHLETES, []);
  }

  let restoredTrainings = 0;
  if (Array.isArray(backupData.trainings)) {
    for (const tr of backupData.trainings) {
      if (tr && tr.id) {
        const clean = sanitizeForFirestore(tr);
        await setDoc(doc(db, COLLECTIONS.TRAININGS, tr.id), clean);
        restoredTrainings++;
      }
    }
    setLocal(LS_KEYS.TRAININGS, backupData.trainings);
  } else if (mode === 'replace') {
    setLocal(LS_KEYS.TRAININGS, []);
  }

  let restoredMatches = 0;
  if (Array.isArray(backupData.matches)) {
    for (const m of backupData.matches) {
      if (m && m.id) {
        const clean = sanitizeForFirestore(m);
        await setDoc(doc(db, COLLECTIONS.MATCHES, m.id), clean);
        restoredMatches++;
      }
    }
    setLocal(LS_KEYS.MATCHES, backupData.matches);
  } else if (mode === 'replace') {
    setLocal(LS_KEYS.MATCHES, []);
  }

  let restoredUsers = 0;
  if (Array.isArray(backupData.users) && backupData.users.length > 0) {
    for (const u of backupData.users) {
      if (u && u.id) {
        const clean = sanitizeForFirestore(u);
        await setDoc(doc(db, COLLECTIONS.USERS, u.id), clean);
        restoredUsers++;
      }
    }
    setLocal(LS_KEYS.USERS, backupData.users);
  }

  return { restoredAthletes, restoredTrainings, restoredMatches, restoredUsers };
}

export async function fetchRestorePoints(): Promise<LocalRestorePoint[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.RESTORE_POINTS));
    const list = snap.docs.map((d) => d.data() as LocalRestorePoint);
    list.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
    setLocal(
      RESTORE_POINTS_KEY,
      list.map((p) => (p.isChunked ? { ...p, data: null } : p))
    );
    return list;
  } catch (err) {
    console.warn('Error fetching restore points from Firestore:', err);
  }
  return getLocal<LocalRestorePoint[]>(RESTORE_POINTS_KEY, []);
}

export function subscribeToRestorePoints(callback: (points: LocalRestorePoint[]) => void): () => void {
  let hasEmitted = false;
  try {
    const q = query(collection(db, COLLECTIONS.RESTORE_POINTS));
    return onSnapshot(
      q,
      (snap) => {
        hasEmitted = true;
        const list = snap.docs.map((d) => d.data() as LocalRestorePoint);
        list.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
        setLocal(
          RESTORE_POINTS_KEY,
          list.map((p) => (p.isChunked ? { ...p, data: null } : p))
        );
        callback(list);
      },
      (err) => {
        if (isFirestoreQuotaError(err)) {
          notifyQuotaExceeded();
        }
        console.warn('Restore points live listener error:', err);
        if (!hasEmitted) {
          callback(getLocal<LocalRestorePoint[]>(RESTORE_POINTS_KEY, []));
        }
      }
    );
  } catch (err) {
    callback(getLocal<LocalRestorePoint[]>(RESTORE_POINTS_KEY, []));
    return () => {};
  }
}

export async function resolveRestorePointData(
  point: LocalRestorePoint
): Promise<SystemBackupPayload['data']> {
  if (point.data && !point.isChunked) {
    return point.data;
  }

  const chunksSnap = await getDocs(
    collection(db, COLLECTIONS.RESTORE_POINTS, point.id, 'chunks')
  );
  if (chunksSnap.empty) {
    if (point.data) return point.data;
    throw new Error('I dati dello snapshot non sono disponibili o risultano incompleti.');
  }

  const sortedChunks = chunksSnap.docs
    .map((d) => d.data() as { index: number; payload: string })
    .sort((a, b) => a.index - b.index);

  const combinedJson = sortedChunks.map((c) => c.payload || '').join('');
  const parsed = JSON.parse(combinedJson) as SystemBackupPayload['data'];
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Impossibile ricostruire i dati dello snapshot.');
  }
  return parsed;
}

export async function saveLocalRestorePoint(
  label: string,
  data: SystemBackupPayload['data']
): Promise<LocalRestorePoint> {
  const cleanData = sanitizeForFirestore(data);
  const id = `rp-${Date.now()}`;
  const formattedLabel =
    label.trim() ||
    `Punto di ripristino (${new Date().toLocaleDateString('it-IT')} ore ${new Date().toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    })})`;
  const timestamp = new Date().toISOString();

  const rawJson = JSON.stringify(cleanData);
  const byteSize = getUtf8ByteLength(rawJson);

  let newPoint: LocalRestorePoint;

  if (byteSize <= FIRESTORE_SINGLE_DOC_SAFE_BYTES) {
    newPoint = {
      id,
      label: formattedLabel,
      timestamp,
      athletesCount: cleanData.athletes?.length || 0,
      trainingsCount: cleanData.trainings?.length || 0,
      matchesCount: cleanData.matches?.length || 0,
      usersCount: cleanData.users?.length || 0,
      isChunked: false,
      chunkCount: 0,
      data: cleanData,
    };

    await setDoc(doc(db, COLLECTIONS.RESTORE_POINTS, id), sanitizeForFirestore(newPoint));
  } else {
    // Split large payloads (e.g. athlete base64 profile photos) into safe subcollection chunks
    const chunks = splitJsonIntoSafeChunks(rawJson, FIRESTORE_CHUNK_SAFE_BYTES);
    const writtenChunkIds: string[] = [];

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `chunk_${String(i).padStart(4, '0')}`;
        await setDoc(doc(db, COLLECTIONS.RESTORE_POINTS, id, 'chunks', chunkId), {
          index: i,
          payload: chunks[i],
        });
        writtenChunkIds.push(chunkId);
      }

      newPoint = {
        id,
        label: formattedLabel,
        timestamp,
        athletesCount: cleanData.athletes?.length || 0,
        trainingsCount: cleanData.trainings?.length || 0,
        matchesCount: cleanData.matches?.length || 0,
        usersCount: cleanData.users?.length || 0,
        isChunked: true,
        chunkCount: chunks.length,
        data: null,
      };

      await setDoc(doc(db, COLLECTIONS.RESTORE_POINTS, id), sanitizeForFirestore(newPoint));
    } catch (err) {
      // Clean up partial chunks if creation fails
      for (const chunkId of writtenChunkIds) {
        try {
          await deleteDoc(doc(db, COLLECTIONS.RESTORE_POINTS, id, 'chunks', chunkId));
        } catch {
          // ignore cleanup failure
        }
      }
      throw err;
    }
  }

  // Update lightweight local cache without overflowing browser localStorage
  try {
    const points = getLocal<LocalRestorePoint[]>(RESTORE_POINTS_KEY, []);
    const cacheEntry = newPoint.isChunked ? { ...newPoint, data: null } : newPoint;
    const updated = [cacheEntry, ...points.filter((p) => p.id !== newPoint.id).slice(0, 19)];
    setLocal(RESTORE_POINTS_KEY, updated);
  } catch {
    // ignore localStorage quota error
  }

  return newPoint;
}

export function getLocalRestorePoints(): LocalRestorePoint[] {
  return getLocal<LocalRestorePoint[]>(RESTORE_POINTS_KEY, []);
}

export async function deleteLocalRestorePoint(id: string): Promise<void> {
  // 1. Delete any subcollection chunks first
  const chunksSnap = await getDocs(collection(db, COLLECTIONS.RESTORE_POINTS, id, 'chunks'));
  for (const chunkDoc of chunksSnap.docs) {
    await deleteDoc(doc(db, COLLECTIONS.RESTORE_POINTS, id, 'chunks', chunkDoc.id));
  }

  // 2. Delete header document from Firestore Cloud
  await deleteDoc(doc(db, COLLECTIONS.RESTORE_POINTS, id));

  // 3. Remove from local cache
  const points = getLocal<LocalRestorePoint[]>(RESTORE_POINTS_KEY, []);
  setLocal(RESTORE_POINTS_KEY, points.filter((p) => p.id !== id));
}

// ----------------- RESTORE HISTORY AUDIT LOG -----------------
export async function fetchRestoreHistory(): Promise<RestoreHistoryEntry[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.RESTORE_HISTORY));
    const list = snap.docs.map((d) => d.data() as RestoreHistoryEntry);
    list.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
    setLocal(RESTORE_HISTORY_KEY, list);
    return list;
  } catch (err) {
    console.warn('Error fetching restore history from Firestore:', err);
  }
  return getLocal<RestoreHistoryEntry[]>(RESTORE_HISTORY_KEY, []);
}

export function subscribeToRestoreHistory(
  callback: (entries: RestoreHistoryEntry[]) => void
): () => void {
  let hasEmitted = false;
  try {
    const q = query(collection(db, COLLECTIONS.RESTORE_HISTORY));
    return onSnapshot(
      q,
      (snap) => {
        hasEmitted = true;
        const list = snap.docs.map((d) => d.data() as RestoreHistoryEntry);
        list.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
        setLocal(RESTORE_HISTORY_KEY, list);
        callback(list);
      },
      (err) => {
        if (isFirestoreQuotaError(err)) {
          notifyQuotaExceeded();
          console.warn('Restore history live listener paused (Firestore daily quota exceeded); serving cached entries.');
        } else {
          console.error('Restore history live listener error:', err);
        }
        if (!hasEmitted) {
          callback(getLocal<RestoreHistoryEntry[]>(RESTORE_HISTORY_KEY, []));
        }
      }
    );
  } catch (err) {
    callback(getLocal<RestoreHistoryEntry[]>(RESTORE_HISTORY_KEY, []));
    return () => {};
  }
}

export async function recordRestoreHistory(
  entryData: Omit<RestoreHistoryEntry, 'id' | 'timestamp'>
): Promise<RestoreHistoryEntry> {
  const entry: RestoreHistoryEntry = {
    ...entryData,
    id: `rh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, COLLECTIONS.RESTORE_HISTORY, entry.id), sanitizeForFirestore(entry));
    const current = getLocal<RestoreHistoryEntry[]>(RESTORE_HISTORY_KEY, []);
    const updated = [entry, ...current.filter((item) => item.id !== entry.id).slice(0, 99)];
    setLocal(RESTORE_HISTORY_KEY, updated);
    return entry;
  } catch (err) {
    console.error('Error recording restore history to Firestore:', err);
    throw err;
  }
}

// Aliases
export const saveCloudRestorePoint = saveLocalRestorePoint;
export const deleteCloudRestorePoint = deleteLocalRestorePoint;
export const subscribeRestorePoints = subscribeToRestorePoints;
export const subscribeRestoreHistory = subscribeToRestoreHistory;
