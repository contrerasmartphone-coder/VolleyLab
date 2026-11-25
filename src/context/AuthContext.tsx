import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { fetchUsers, saveUserToDb, seedInitialDataIfEmpty, subscribeToUsers } from '../lib/db';
import { INITIAL_USERS } from '../lib/mockData';

interface AuthContextType {
  currentUser: User | null;
  allUsers: User[];
  users: User[]; // alias for compatibility
  isCoach: boolean;
  isStaff: boolean;
  isAthlete: boolean;
  canManageAll: boolean;
  canManageUsers: boolean;
  canManageAthletes: boolean;
  canEditHealthAndProgress: boolean;
  canManageTrainings: boolean;
  canTakeAttendance: boolean;
  canManageMatches: boolean;
  login: (identity: string, pass?: string) => Promise<{ success: boolean; message?: string }>;
  register: (userData: Omit<User, 'id' | 'createdAt'>) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  switchUser: (userId: string) => void;
  switchRoleDemo: (role: UserRole, athleteId?: string) => void;
  updateUser: (updates: Partial<User>) => Promise<void>;
  syncUsersList: (updater: (prev: User[]) => User[]) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'vm_current_user_session';
const USERS_CACHE_KEY = 'vm_users_cache';

function getCachedUsersSnapshot(): User[] {
  try {
    const raw = localStorage.getItem(USERS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore cache parse errors
  }
  return INITIAL_USERS;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<User[]>(() => getCachedUsersSnapshot());
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedSession = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (!savedSession) return null;
      const parsed = JSON.parse(savedSession);
      const cached = getCachedUsersSnapshot();
      return (
        cached.find(
          (u) => u.id === parsed.id || u.username?.toLowerCase() === parsed.username?.toLowerCase()
        ) || null
      );
    } catch {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  // Initialize DB once if needed and subscribe once to users for real-time sync
  useEffect(() => {
    let active = true;
    seedInitialDataIfEmpty().catch(() => undefined);

    const unsubUsers = subscribeToUsers((freshUsers) => {
      if (!active) return;
      if (Array.isArray(freshUsers) && freshUsers.length > 0) {
        setAllUsers(freshUsers);
        // Refresh currentUser if updated in DB
        setCurrentUser((prev) => {
          if (!prev) return null;
          const updatedSelf = freshUsers.find(
            (u) => u.id === prev.id || u.username?.toLowerCase() === prev.username?.toLowerCase()
          );
          if (updatedSelf) {
            localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updatedSelf));
            return updatedSelf;
          }
          return prev;
        });
      }
    });

    return () => {
      active = false;
      unsubUsers();
    };
  }, []);

  const login = async (identity: string, pass: string = ''): Promise<{ success: boolean; message?: string }> => {
    const normalize = (str?: string) => (str || '').trim().toLowerCase();
    const normalizeAlpha = (str?: string) => (str || '').trim().toLowerCase().replace(/[.\s_-]/g, '');

    const cleanId = normalize(identity);
    const cleanIdAlpha = normalizeAlpha(identity);
    const cleanPass = (pass || '').trim();

    if (!cleanId) {
      return { success: false, message: 'Inserisci il nome utente.' };
    }
    if (!cleanPass) {
      return { success: false, message: 'Inserisci la password.' };
    }

    // Check in-memory live list first; only fetch from Firestore if missing to save read quota
    const findMatchingUser = (list: User[]) =>
      list.find((u) => {
        const uUsername = normalize(u.username);
        const uEmail = normalize(u.email);
        const uName = normalize(`${u.firstName} ${u.lastName}`);
        const uAlpha = normalizeAlpha(u.username);

        return (
          uUsername === cleanId ||
          uEmail === cleanId ||
          uName === cleanId ||
          (cleanIdAlpha.length > 3 && uAlpha === cleanIdAlpha)
        );
      });

    let userList = allUsers;
    let matchedUser = findMatchingUser(userList);

    if (!matchedUser) {
      try {
        const freshUsers = await fetchUsers();
        if (freshUsers && freshUsers.length > 0) {
          userList = freshUsers;
          setAllUsers(freshUsers);
          matchedUser = findMatchingUser(userList);
        }
      } catch (e) {
        // fallback to current in-memory allUsers
      }
    }

    const user = matchedUser;

    if (!user) {
      return {
        success: false,
        message: 'Utente non trovato. Verifica il nome utente inserito.',
      };
    }

    // Password verification (tolerant to case if needed)
    const expectedPass = (user.password || '').trim();
    if (cleanPass !== expectedPass && cleanPass.toLowerCase() !== expectedPass.toLowerCase()) {
      return {
        success: false,
        message: 'Password non corretta. Riprova con la password associata.',
      };
    }

    setCurrentUser(user);
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
    return { success: true };
  };

  const register = async (userData: Omit<User, 'id' | 'createdAt'>) => {
    const existing = allUsers.find(
      (u) =>
        u.email.toLowerCase() === userData.email.toLowerCase() ||
        u.username.toLowerCase() === userData.username.toLowerCase()
    );
    if (existing) {
      return { success: false, message: 'Email o username già registrati.' };
    }

    const newUser: User = {
      ...userData,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    await saveUserToDb(newUser);
    const updatedUsers = [...allUsers, newUser];
    setAllUsers(updatedUsers);
    setCurrentUser(newUser);
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(newUser));
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  };

  const switchUser = (userId: string) => {
    const target = allUsers.find((u) => u.id === userId || u.username === userId);
    if (target) {
      setCurrentUser(target);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(target));
    }
  };

  const switchRoleDemo = (role: UserRole, athleteId?: string) => {
    const target = allUsers.find((u) => {
      if (role === 'coach') return u.role === 'coach';
      if (role === 'staff') return u.role === 'staff';
      if (athleteId) return u.athleteId === athleteId;
      return u.role === 'athlete';
    }) || allUsers[0];

    if (target) {
      setCurrentUser(target);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(target));
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated);
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updated));
    await saveUserToDb(updated);
    setAllUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const syncUsersList = (updater: (prev: User[]) => User[]) => {
    setAllUsers((prev) => updater(prev));
  };

  // Role booleans
  const isCoach = currentUser?.role === 'coach';
  const isStaff = currentUser?.role === 'staff';
  const isAthlete = currentUser?.role === 'athlete';

  // Privileges matrix: Staff e Coach hanno gli stessi identici privilegi e visualizzazioni
  const canManageAll = isCoach || isStaff;
  const canManageUsers = isCoach || isStaff;
  const canManageAthletes = isCoach || isStaff;
  const canEditHealthAndProgress = isCoach || isStaff;
  const canManageTrainings = isCoach || isStaff;
  const canTakeAttendance = isCoach || isStaff;
  const canManageMatches = isCoach || isStaff;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        users: allUsers,
        isCoach,
        isStaff,
        isAthlete,
        canManageAll,
        canManageUsers,
        canManageAthletes,
        canEditHealthAndProgress,
        canManageTrainings,
        canTakeAttendance,
        canManageMatches,
        login,
        register,
        logout,
        switchUser,
        switchRoleDemo,
        updateUser,
        syncUsersList,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

