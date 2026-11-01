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
import { INITIAL_USERS, INITIAL_ATHLETES, INITIAL_TRAININGS, INITIAL_MATCHES } from './mockData';

const COLLECTIONS = {
  USERS: 'users',
  ATHLETES: 'athletes',
  TRAININGS: 'trainings',
  MATCHES: 'matches',
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

const SEEDED_KEY = 'vm_initial_seed_completed_v5_users_only';

// ----------------- SEEDING -----------------
export async function seedInitialDataIfEmpty(force = false): Promise<void> {
  try {
    const alreadySeeded = localStorage.getItem(SEEDED_KEY);
    if (alreadySeeded && !force) {
      return;
    }

    const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
    if (usersSnap.empty || force) {
      console.log('Synchronizing VolleyLab initial users into empty Firestore collection...');
      for (const u of INITIAL_USERS) {
        await setDoc(doc(db, COLLECTIONS.USERS, u.id), u);
      }
      setLocal(LS_KEYS.USERS, INITIAL_USERS);
    }

    // Empty athletes, trainings, matches in Firestore
    const athSnap = await getDocs(collection(db, COLLECTIONS.ATHLETES));
    for (const d of athSnap.docs) {
      await deleteDoc(doc(db, COLLECTIONS.ATHLETES, d.id));
    }
    setLocal(LS_KEYS.ATHLETES, []);

    const trSnap = await getDocs(collection(db, COLLECTIONS.TRAININGS));
    for (const d of trSnap.docs) {
      await deleteDoc(doc(db, COLLECTIONS.TRAININGS, d.id));
    }
    setLocal(LS_KEYS.TRAININGS, []);

    const mSnap = await getDocs(collection(db, COLLECTIONS.MATCHES));
    for (const d of mSnap.docs) {
      await deleteDoc(doc(db, COLLECTIONS.MATCHES, d.id));
    }
    setLocal(LS_KEYS.MATCHES, []);

    localStorage.setItem(SEEDED_KEY, 'true');
    console.log('Database synced: users table kept, other tables emptied.');
  } catch (err) {
    console.warn('Firestore seeding/clearing error:', err);
    if (!localStorage.getItem(LS_KEYS.USERS)) setLocal(LS_KEYS.USERS, INITIAL_USERS);
    setLocal(LS_KEYS.ATHLETES, []);
    setLocal(LS_KEYS.TRAININGS, []);
    setLocal(LS_KEYS.MATCHES, []);
    localStorage.setItem(SEEDED_KEY, 'true');
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

