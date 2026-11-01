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
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'vm_current_user_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>(INITIAL_USERS);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize DB and load users + subscribe for real-time sync
  useEffect(() => {
    let unsubUsers: (() => void) | undefined;

    async function init() {
      try {
        await seedInitialDataIfEmpty();
        const users = await fetchUsers();
        if (users && users.length > 0) {
          setAllUsers(users);
        }

        const savedSession = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            const userList = (users && users.length > 0 ? users : INITIAL_USERS);
            const found = userList.find(
              (u) => u.id === parsed.id || u.username?.toLowerCase() === parsed.username?.toLowerCase()
            );
            if (found) {
              setCurrentUser(found);
            } else {
              setCurrentUser(null);
              localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
            }
          } catch (e) {
            setCurrentUser(null);
            localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
          }
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Failed initializing auth & data:', err);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    init();

    unsubUsers = subscribeToUsers((freshUsers) => {
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
      if (unsubUsers) unsubUsers();
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

    // Always fetch fresh users from Firestore & local storage to be 100% up-to-date with any changes
    let userList = allUsers;
    try {
      const freshUsers = await fetchUsers();
      if (freshUsers && freshUsers.length > 0) {
        userList = freshUsers;
        setAllUsers(freshUsers);
      }
    } catch (e) {
      // fallback to current in-memory allUsers
    }

    // Completely case-insensitive match on username, email, full name, or alphanumeric handle
    const user = userList.find((u) => {
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

  // Role booleans
  const isCoach = currentUser?.role === 'coach';
  const isStaff = currentUser?.role === 'staff';
  const isAthlete = currentUser?.role === 'athlete';

  // Privileges matrix
  const canManageUsers = isCoach;
  const canManageAthletes = isCoach;
  const canEditHealthAndProgress = isCoach || isStaff;
  const canManageTrainings = isCoach;
  const canTakeAttendance = isCoach || isStaff;
  const canManageMatches = isCoach;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        users: allUsers,
        isCoach,
        isStaff,
        isAthlete,
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

