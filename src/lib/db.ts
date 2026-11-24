import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { db } from './firebase';
import { Athlete, TrainingSession, MatchEvent, User } from '../types';
import { INITIAL_USERS } from './mockData';

const COLLECTIONS = {
  USERS: 'users',
  ATHLETES: 'athletes',
  TRAININGS: 'trainings',
  MATCHES: 'matches',
  RESTORE_POINTS: 'restore_points',
};

// Fallback Local Storage Keys
const LS_KEYS = {
  USERS: 'vm_users_cache',
  ATHLETES: 'vm_athletes_cache',
  TRAININGS: 'vm_trainings_cache',
  MATCHES: 'vm_matches_cache',
};

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

// ----------------- SEEDING (SAFE & NON-DESTRUCTIVE) -----------------
export async function seedInitialDataIfEmpty(force = false): Promise<void> {
  try {
    const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
    // Provision initial base users only if the users collection is completely empty
    if (usersSnap.empty || force) {
      console.log('Synchronizing VolleyLab base users into empty collection...');
      for (const u of INITIAL_USERS) {
        await setDoc(doc(db, COLLECTIONS.USERS, u.id), u);
      }
      setLocal(LS_KEYS.USERS, INITIAL_USERS);
    }
    // Athletes, trainings, and matches are NEVER cleared or deleted on startup
  } catch (err) {
    console.warn('Firestore initial user check:', err);
    if (!localStorage.getItem(LS_KEYS.USERS)) setLocal(LS_KEYS.USERS, INITIAL_USERS);
  }
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
    console.warn('Error fetching users from Firestore:', err);
  }
  return getLocal<User[]>(LS_KEYS.USERS, []);
}

export function subscribeToUsers(callback: (users: User[]) => void): () => void {
  try {
    const q = query(collection(db, COLLECTIONS.USERS));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as User);
        setLocal(LS_KEYS.USERS, list);
        callback(list);
      },
      (err) => {
        console.warn('Users live listener error:', err);
        callback(getLocal<User[]>(LS_KEYS.USERS, []));
      }
    );
  } catch (err) {
    callback(getLocal<User[]>(LS_KEYS.USERS, []));
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
  const current = getLocal<User[]>(LS_KEYS.USERS, []);
  const idx = current.findIndex((u) => u.id === user.id);
  if (idx >= 0) current[idx] = user;
  else current.push(user);
  setLocal(LS_KEYS.USERS, current);

  try {
    const cleanUser = sanitizeForFirestore(user);
    await setDoc(doc(db, COLLECTIONS.USERS, user.id), cleanUser);
  } catch (err) {
    console.warn('Error saving user to Firestore:', err);
  }
}

export async function deleteUserFromDb(userId: string): Promise<void> {
  const current = getLocal<User[]>(LS_KEYS.USERS, []);
  const updated = current.filter((u) => u.id !== userId);
  setLocal(LS_KEYS.USERS, updated);

  try {
    await deleteDoc(doc(db, COLLECTIONS.USERS, userId));
  } catch (err) {
    console.warn('Error deleting user from Firestore:', err);
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
    console.warn('Error fetching athletes from Firestore:', err);
  }
  return getLocal<Athlete[]>(LS_KEYS.ATHLETES, []);
}

export function subscribeToAthletes(callback: (athletes: Athlete[]) => void): () => void {
  try {
    const q = query(collection(db, COLLECTIONS.ATHLETES));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Athlete);
        setLocal(LS_KEYS.ATHLETES, list);
        callback(list);
      },
      (err) => {
        console.warn('Athletes live listener error:', err);
        callback(getLocal<Athlete[]>(LS_KEYS.ATHLETES, []));
      }
    );
  } catch (err) {
    callback(getLocal<Athlete[]>(LS_KEYS.ATHLETES, []));
    return () => {};
  }
}

export async function saveAthleteToDb(athlete: Athlete): Promise<void> {
  const current = getLocal<Athlete[]>(LS_KEYS.ATHLETES, []);
  const idx = current.findIndex((a) => a.id === athlete.id);
  if (idx >= 0) current[idx] = athlete;
  else current.push(athlete);
  setLocal(LS_KEYS.ATHLETES, current);

  try {
    await setDoc(doc(db, COLLECTIONS.ATHLETES, athlete.id), sanitizeForFirestore(athlete));
  } catch (err) {
    console.warn('Error saving athlete to Firestore:', err);
  }
}

export async function deleteAthleteFromDb(athleteId: string): Promise<void> {
  const current = getLocal<Athlete[]>(LS_KEYS.ATHLETES, []);
  const updated = current.filter((a) => a.id !== athleteId);
  setLocal(LS_KEYS.ATHLETES, updated);

  try {
    await deleteDoc(doc(db, COLLECTIONS.ATHLETES, athleteId));
  } catch (err) {
    console.warn('Error deleting athlete from Firestore:', err);
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
    console.warn('Error fetching trainings from Firestore:', err);
  }
  return getLocal<TrainingSession[]>(LS_KEYS.TRAININGS, []);
}

export function subscribeToTrainings(callback: (trainings: TrainingSession[]) => void): () => void {
  try {
    const q = query(collection(db, COLLECTIONS.TRAININGS));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as TrainingSession);
        list.sort((a, b) => (a.date > b.date ? -1 : 1));
        setLocal(LS_KEYS.TRAININGS, list);
        callback(list);
      },
      (err) => {
        console.warn('Trainings live listener error:', err);
        callback(getLocal<TrainingSession[]>(LS_KEYS.TRAININGS, []));
      }
    );
  } catch (err) {
    callback(getLocal<TrainingSession[]>(LS_KEYS.TRAININGS, []));
    return () => {};
  }
}

export async function saveTrainingToDb(training: TrainingSession): Promise<void> {
  const current = getLocal<TrainingSession[]>(LS_KEYS.TRAININGS, []);
  const idx = current.findIndex((t) => t.id === training.id);
  if (idx >= 0) current[idx] = training;
  else current.push(training);
  setLocal(LS_KEYS.TRAININGS, current);

  try {
    await setDoc(doc(db, COLLECTIONS.TRAININGS, training.id), sanitizeForFirestore(training));
  } catch (err) {
    console.warn('Error saving training to Firestore:', err);
  }
}

export async function deleteTrainingFromDb(trainingId: string): Promise<void> {
  const current = getLocal<TrainingSession[]>(LS_KEYS.TRAININGS, []);
  const updated = current.filter((t) => t.id !== trainingId);
  setLocal(LS_KEYS.TRAININGS, updated);

  try {
    await deleteDoc(doc(db, COLLECTIONS.TRAININGS, trainingId));
  } catch (err) {
    console.warn('Error deleting training from Firestore:', err);
  }
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
    console.warn('Error fetching matches from Firestore:', err);
  }
  return getLocal<MatchEvent[]>(LS_KEYS.MATCHES, []);
}

export function subscribeToMatches(callback: (matches: MatchEvent[]) => void): () => void {
  try {
    const q = query(collection(db, COLLECTIONS.MATCHES));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as MatchEvent);
        list.sort((a, b) => (a.date > b.date ? 1 : -1));
        setLocal(LS_KEYS.MATCHES, list);
        callback(list);
      },
      (err) => {
        console.warn('Matches live listener error:', err);
        callback(getLocal<MatchEvent[]>(LS_KEYS.MATCHES, []));
      }
    );
  } catch (err) {
    callback(getLocal<MatchEvent[]>(LS_KEYS.MATCHES, []));
    return () => {};
  }
}

export async function saveMatchToDb(match: MatchEvent): Promise<void> {
  const current = getLocal<MatchEvent[]>(LS_KEYS.MATCHES, []);
  const idx = current.findIndex((m) => m.id === match.id);
  if (idx >= 0) current[idx] = match;
  else current.push(match);
  setLocal(LS_KEYS.MATCHES, current);

  try {
    await setDoc(doc(db, COLLECTIONS.MATCHES, match.id), sanitizeForFirestore(match));
  } catch (err) {
    console.warn('Error saving match to Firestore:', err);
  }
}

export async function deleteMatchFromDb(matchId: string): Promise<void> {
  const current = getLocal<MatchEvent[]>(LS_KEYS.MATCHES, []);
  const updated = current.filter((m) => m.id !== matchId);
  setLocal(LS_KEYS.MATCHES, updated);

  try {
    await deleteDoc(doc(db, COLLECTIONS.MATCHES, matchId));
  } catch (err) {
    console.warn('Error deleting match from Firestore:', err);
  }
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
  try {
    const q = query(collection(db, COLLECTIONS.RESTORE_POINTS));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as LocalRestorePoint);
        list.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
        setLocal(
          RESTORE_POINTS_KEY,
          list.map((p) => (p.isChunked ? { ...p, data: null } : p))
        );
        callback(list);
      },
      (err) => {
        console.warn('Restore points live listener error:', err);
        callback(getLocal<LocalRestorePoint[]>(RESTORE_POINTS_KEY, []));
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

// Aliases
export const saveCloudRestorePoint = saveLocalRestorePoint;
export const deleteCloudRestorePoint = deleteLocalRestorePoint;
export const subscribeRestorePoints = subscribeToRestorePoints;

