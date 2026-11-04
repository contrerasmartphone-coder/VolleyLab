import React, { useState } from 'react';
import { User, Athlete } from '../../types';
import {
  KeyRound,
  Shield,
  User as UserIcon,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  RefreshCw,
  Search,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  AlertOctagon,
  UserX,
  CopyX,
} from 'lucide-react';
import { useDialog } from '../../context/DialogContext';
import {
  arePhoneNumbersMatching,
  getWhatsAppLink,
  normalizePhoneDisplay,
  isValidEmail,
} from '../../lib/athleteValidation';

export { getWhatsAppLink, normalizePhoneDisplay };

interface UserManagerProps {
  users: User[];
  athletes: Athlete[];
  currentUser: User | null;
  onSaveUser: (user: User) => Promise<void>;
  onDeleteUser?: (userId: string) => Promise<void>;
  onSaveAthlete?: (athlete: Athlete) => Promise<void>;
}

export interface ConflictField {
  field: 'firstName' | 'lastName' | 'phone' | 'email';
  label: string;
  userValue: string;
  athleteValue: string;
  chosenValue: string;
}

export interface DuplicateUserConflict {
  field: 'fullName' | 'username' | 'phone' | 'email';
  label: string;
  matchedUser: User;
  matchedValue: string;
}

// Detects conflicting fields between user form values and selected athlete profile
export function detectDataConflicts(
  userForm: Partial<User>,
  athlete: Athlete
): ConflictField[] {
  const conflicts: ConflictField[] = [];

  // 1. First Name
  const uFirst = (userForm.firstName || '').trim();
  const aFirst = (athlete.firstName || '').trim();
  if (uFirst && aFirst && uFirst.toLowerCase() !== aFirst.toLowerCase()) {
    conflicts.push({
      field: 'firstName',
      label: 'Nome',
      userValue: uFirst,
      athleteValue: aFirst,
      chosenValue: aFirst,
    });
  }

  // 2. Last Name
  const uLast = (userForm.lastName || '').trim();
  const aLast = (athlete.lastName || '').trim();
  if (uLast && aLast && uLast.toLowerCase() !== aLast.toLowerCase()) {
    conflicts.push({
      field: 'lastName',
      label: 'Cognome',
      userValue: uLast,
      athleteValue: aLast,
      chosenValue: aLast,
    });
  }

  // 3. Phone Number
  const uPhoneRaw = (userForm.phone || '').trim();
  const aPhoneRaw = (athlete.phone || '').trim();
  const uPhoneNorm = uPhoneRaw ? normalizePhoneDisplay(uPhoneRaw) : '';
  const aPhoneNorm = aPhoneRaw ? normalizePhoneDisplay(aPhoneRaw) : '';

  const uPhoneDigits = uPhoneRaw.replace(/\D/g, '');
  const aPhoneDigits = aPhoneRaw.replace(/\D/g, '');

  if (
    uPhoneDigits &&
    aPhoneDigits &&
    uPhoneNorm !== aPhoneNorm &&
    !arePhoneNumbersMatching(uPhoneRaw, aPhoneRaw)
  ) {
    conflicts.push({
      field: 'phone',
      label: 'Telefono',
      userValue: uPhoneNorm || uPhoneRaw,
      athleteValue: aPhoneNorm || aPhoneRaw,
      chosenValue: aPhoneNorm || aPhoneRaw,
    });
  }

  // 4. Email
  const uEmail = (userForm.email || '').trim().toLowerCase();
  const aEmail = (athlete.email || '').trim().toLowerCase();
  if (uEmail && aEmail && uEmail !== aEmail) {
    conflicts.push({
      field: 'email',
      label: 'Email',
      userValue: userForm.email || '',
      athleteValue: athlete.email || '',
      chosenValue: athlete.email || '',
    });
  }

  return conflicts;
}

// Checks for duplicate users in the system on NOME+COGNOME, TELEFONO, EMAIL, USERNAME
export function findDuplicateUserConflicts(
  userForm: Partial<User>,
  users: User[],
  currentEditingUserId?: string
): DuplicateUserConflict[] {
  const conflicts: DuplicateUserConflict[] = [];

  const norm = (s?: string) => (s || '').trim().toLowerCase();
  const digits = (s?: string) => (s || '').replace(/\D/g, '');

  const newFirst = norm(userForm.firstName);
  const newLast = norm(userForm.lastName);
  const newUsername = norm(userForm.username);
  const newEmail = norm(userForm.email);
  const newPhoneDigits = digits(userForm.phone);

  const otherUsers = users.filter((u) => u.id !== currentEditingUserId);

  for (const existingUser of otherUsers) {
    const exFirst = norm(existingUser.firstName);
    const exLast = norm(existingUser.lastName);
    const exUsername = norm(existingUser.username);
    const exEmail = norm(existingUser.email);
    const exPhoneDigits = digits(existingUser.phone);

    // 1. Check Nome + Cognome
    if (newFirst && newLast && exFirst === newFirst && exLast === newLast) {
      if (!conflicts.some((c) => c.field === 'fullName' && c.matchedUser.id === existingUser.id)) {
        conflicts.push({
          field: 'fullName',
          label: 'Nome e Cognome',
          matchedUser: existingUser,
          matchedValue: `${existingUser.firstName} ${existingUser.lastName}`,
        });
      }
    }

    // 2. Check Username
    if (newUsername && exUsername === newUsername) {
      if (!conflicts.some((c) => c.field === 'username' && c.matchedUser.id === existingUser.id)) {
        conflicts.push({
          field: 'username',
          label: 'Nome Utente (Username)',
          matchedUser: existingUser,
          matchedValue: `@${existingUser.username}`,
        });
      }
    }

    // 3. Check Phone
    if (
      userForm.phone &&
      existingUser.phone &&
      arePhoneNumbersMatching(userForm.phone, existingUser.phone)
    ) {
      if (!conflicts.some((c) => c.field === 'phone' && c.matchedUser.id === existingUser.id)) {
        conflicts.push({
          field: 'phone',
          label: 'Numero di Telefono',
          matchedUser: existingUser,
          matchedValue: existingUser.phone || '',
        });
      }
    }

    // 4. Check Email
    if (newEmail && exEmail && newEmail === exEmail) {
      if (!conflicts.some((c) => c.field === 'email' && c.matchedUser.id === existingUser.id)) {
        conflicts.push({
          field: 'email',
          label: 'Email di Contatto',
          matchedUser: existingUser,
          matchedValue: existingUser.email,
        });
      }
    }
  }

  return conflicts;
}

export const UserManager: React.FC<UserManagerProps> = ({
  users,
  athletes,
  currentUser,
  onSaveUser,
  onDeleteUser,
  onSaveAthlete,
}) => {
  const { confirm, showToast } = useDialog();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Athlete Conflict Modal State
  const [pendingAthlete, setPendingAthlete] = useState<Athlete | null>(null);
  const [conflictFields, setConflictFields] = useState<ConflictField[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Duplicate User Modal State
  const [duplicateConflicts, setDuplicateConflicts] = useState<DuplicateUserConflict[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<Partial<User>>({
    username: '',
    password: '',
    role: 'athlete',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    athleteId: '',
  });

  const handleSendCredentialsWhatsApp = (user: User) => {
    if (!user.phone) {
      showToast({
        message: 'Numero di telefono non specificato per questo utente.',
        type: 'error',
      });
      return;
    }
    const message = `Ciao ${user.firstName},
Ecco le tue credenziali di accesso per l'applicazione VolleyLab:
URL: https://volleylab-palermo.vercel.app
Utente: ${user.username}
Password: ${user.password || '******'}
Ti aspettiamo!`;
    const waUrl = `${getWhatsAppLink(user.phone)}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleOpenCreate = () => {
    setIsSubmitting(false);
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      role: 'athlete',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      athleteId: '',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: User) => {
    setIsSubmitting(false);
    setEditingUser(user);
    setFormData({
      ...user,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      athleteId: user.athleteId || '',
    });
    setShowAddModal(true);
  };

  const handleSelectAthlete = (athleteId: string) => {
    if (!athleteId) {
      setFormData((prev) => ({ ...prev, athleteId: '' }));
      return;
    }

    const found = athletes.find((a) => a.id === athleteId);
    if (!found) {
      setFormData((prev) => ({ ...prev, athleteId }));
      return;
    }

    const detected = detectDataConflicts(formData, found);

    if (detected.length > 0) {
      setPendingAthlete(found);
      setConflictFields(detected);
      setShowConflictModal(true);
    } else {
      setFormData((prev) => ({
        ...prev,
        athleteId: found.id,
        firstName: prev.firstName?.trim() || found.firstName,
        lastName: prev.lastName?.trim() || found.lastName,
        phone: prev.phone?.trim() || found.phone || '',
        email: prev.email?.trim() || found.email || '',
      }));
      showToast({
        message: `Profilo atleta #${found.jerseyNumber} ${found.firstName} ${found.lastName} associato con successo!`,
        type: 'success',
      });
    }
  };

  const handleApplyConflictResolution = async () => {
    if (!pendingAthlete) return;

    const resolvedValues = {
      firstName: formData.firstName?.trim() || pendingAthlete.firstName,
      lastName: formData.lastName?.trim() || pendingAthlete.lastName,
      phone: formData.phone?.trim() ? normalizePhoneDisplay(formData.phone) : (pendingAthlete.phone || ''),
      email: formData.email?.trim() || pendingAthlete.email || '',
    };

    conflictFields.forEach((c) => {
      let val = (c.chosenValue || '').trim();
      if (c.field === 'phone' && val) {
        val = normalizePhoneDisplay(val);
      }
      resolvedValues[c.field] = val;
    });

    const updatedUserForm: Partial<User> = {
      ...formData,
      athleteId: pendingAthlete.id,
      firstName: resolvedValues.firstName,
      lastName: resolvedValues.lastName,
      phone: resolvedValues.phone,
      email: resolvedValues.email,
    };

    setFormData(updatedUserForm);

    // Sync changes to the Athlete record as well so both sides match!
    const updatedAthlete: Athlete = {
      ...pendingAthlete,
      firstName: resolvedValues.firstName,
      lastName: resolvedValues.lastName,
      phone: resolvedValues.phone,
      email: resolvedValues.email,
    };

    if (onSaveAthlete) {
      await onSaveAthlete(updatedAthlete);
    }

    setShowConflictModal(false);
    setPendingAthlete(null);
    setConflictFields([]);

    showToast({
      message: 'Discrepanze risolte con successo! Dati unificati per Utente e Atleta.',
      type: 'success',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const username = formData.username?.trim() || '';
      const password = formData.password?.trim() || '';
      const firstName = formData.firstName?.trim() || '';
      const lastName = formData.lastName?.trim() || '';
      const email = formData.email?.trim() || '';
      const phone = formData.phone?.trim() || '';

      if (!username || !password || !firstName || !lastName) {
        showToast({
          message: 'Compila tutti i campi anagrafici e credenziali (Nome, Cognome, Username, Password).',
          type: 'warning',
        });
        setIsSubmitting(false);
        return;
      }

      if (email && !isValidEmail(email)) {
        showToast({
          message: 'L\'indirizzo email inserito non è valido (es. utente@dominio.it).',
          type: 'warning',
        });
        setIsSubmitting(false);
        return;
      }

      const phoneDigits = phone.replace(/\D/g, '');
      if (!phone || phoneDigits.length < 8) {
        showToast({
          message: 'Inserisci un numero di telefono valido (campo obbligatorio, min. 8 cifre).',
          type: 'warning',
        });
        setIsSubmitting(false);
        return;
      }

      // 1. Check for Duplicate Users (Nome+Cognome, Username, Telefono, Email)
      const duplicates = findDuplicateUserConflicts(formData, users, editingUser?.id);
      if (duplicates.length > 0) {
        setDuplicateConflicts(duplicates);
        setShowDuplicateModal(true);
        showToast({
          message: 'Utente duplicato rilevato. Controlla i dati evidenziati.',
          type: 'warning',
        });
        setIsSubmitting(false);
        return;
      }

      // 2. Check if there are unresolved conflicts with selected athlete
      if (formData.role === 'athlete' && formData.athleteId) {
        const targetAth = athletes.find((a) => a.id === formData.athleteId);
        if (targetAth) {
          const conflicts = detectDataConflicts(formData, targetAth);
          if (conflicts.length > 0) {
            setPendingAthlete(targetAth);
            setConflictFields(conflicts);
            setShowConflictModal(true);
            showToast({
              message: 'Risolvi prima le discrepanze riscontrate tra i dati Utente e Atleta.',
              type: 'warning',
            });
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Automatically normalize phone with +39 prefix if needed
      const normalizedPhone = normalizePhoneDisplay(phone);

      const userToSave: User = {
        id: editingUser?.id || `usr-${Date.now()}`,
        username: username,
        password: password,
        role: (formData.role as 'coach' | 'staff' | 'athlete') || 'athlete',
        firstName: firstName,
        lastName: lastName,
        name: `${firstName} ${lastName}`,
        email: email,
        phone: normalizedPhone,
        createdAt: editingUser?.createdAt || new Date().toISOString().split('T')[0],
        lastLogin: editingUser?.lastLogin || new Date().toISOString(),
        athleteId: formData.role === 'athlete' ? (formData.athleteId || '') : '',
      };

      await onSaveUser(userToSave);
      showToast({
        message: `Credenziali per l'utente @${userToSave.username} salvate con successo!`,
        type: 'success',
      });
      setShowAddModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter((user) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const firstName = (user.firstName || '').toLowerCase();
    const lastName = (user.lastName || '').toLowerCase();
    const username = (user.username || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const phone = (user.phone || '').toLowerCase();
    return (
      firstName.includes(q) ||
      lastName.includes(q) ||
      username.includes(q) ||
      email.includes(q) ||
      phone.includes(q)
    );
  });

  // Filter athletes so only those not associated to other users are selectable
  const availableAthletes = athletes.filter((a) => {
    const isAssociatedToOtherUser = users.some(
      (u) => u.athleteId === a.id && u.id !== editingUser?.id
    );
    return !isAssociatedToOtherUser;
  });

  const selectedAthlete = athletes.find((a) => a.id === formData.athleteId);
  const activeConflicts = selectedAthlete && !isSubmitting ? detectDataConflicts(formData, selectedAthlete) : [];

  // Live Duplicate Check for the active form (suppressed while submitting or when modal is closed)
  const liveDuplicates = isSubmitting || !showAddModal ? [] : findDuplicateUserConflicts(formData, users, editingUser?.id);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white font-display tracking-tight">
                Gestione Utenti
              </h1>
              <span className="px-2.5 py-1 text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
                {users.length === 1 ? '1 Account Registrato' : `${users.length} Account Registrati`}
              </span>
            </div>
          </div>

          <button
            id="create-user-button"
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-102"
          >
            <Plus className="w-4 h-4" />
            Nuovo Utente
          </button>
        </div>
      </div>

      {/* Smart Search Filter */}
      <div className="bg-[#11141d] border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca utente per nome, cognome, username, email o telefono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0b0e14] border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none transition-all"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors shrink-0"
          >
            Resetta
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-[#11141d] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0e14] text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
              <tr>
                <th className="p-4">Nome</th>
                <th className="p-4">Cognome</th>
                <th className="p-4">Username</th>
                <th className="p-4">Telefono</th>
                <th className="p-4">Ruolo</th>
                <th className="p-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <Shield className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-white">Nessun utente registrato nel sistema</p>
                    <p className="text-xs text-slate-500 mt-1">Crea un nuovo account per consentire l'accesso allo staff o agli atleti.</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <Search className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-white">Nessun utente trovato</p>
                    <p className="text-xs text-slate-500 mt-1">Nessun utente corrisponde alla ricerca "{searchQuery}".</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = currentUser?.id === user.id;

                  return (
                    <tr
                      key={user.id}
                      onClick={() => handleOpenEdit(user)}
                      className="hover:bg-[#161b26] transition-colors cursor-pointer"
                      title="Clicca per modificare l'utente"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              user.role === 'coach'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                            }`}
                          >
                            {user.role === 'coach' ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                          </div>
                          <span className="font-bold text-white block">{user.firstName}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white block">{user.lastName}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[9px] font-black rounded border border-emerald-500/30">
                              Tu
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 font-mono font-bold text-amber-400">
                        @{user.username}
                      </td>

                      <td className="p-4">
                        {user.phone ? (
                          <a
                            href={getWhatsAppLink(user.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-all group hover:border-emerald-500/60 shadow-sm cursor-pointer"
                            title={`Invia messaggio WhatsApp a ${user.firstName} ${user.lastName} (${user.phone})`}
                          >
                            <svg
                              className="w-3.5 h-3.5 fill-current shrink-0 text-emerald-400 group-hover:scale-110 transition-transform"
                              viewBox="0 0 24 24"
                            >
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.893 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                            </svg>
                            <span className="font-mono tracking-wide">{user.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 text-xs italic">Non specificato</span>
                        )}
                      </td>

                      <td className="p-4">
                        {user.role === 'coach' && (
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg border bg-amber-500/15 text-amber-300 border-amber-500/30">
                            COACH
                          </span>
                        )}
                        {user.role === 'staff' && (
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg border bg-indigo-500/15 text-indigo-300 border-indigo-500/30">
                            STAFF
                          </span>
                        )}
                        {user.role === 'athlete' && (
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg border bg-cyan-500/15 text-cyan-300 border-cyan-500/30">
                            ATLETA
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.phone && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendCredentialsWhatsApp(user);
                              }}
                              className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                              title="Invia credenziali di accesso su WhatsApp"
                            >
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(user);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Modifica credenziali"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteUser && !isCurrent && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const confirmed = await confirm({
                                  title: 'Elimina Account Utente',
                                  message: `Sei sicuro di voler eliminare l'account di ${user.firstName} ${user.lastName} (@${user.username})? L'utente non potrà più accedere all'applicazione.`,
                                  confirmText: 'Sì, Elimina Account',
                                  cancelText: 'Annulla',
                                  type: 'danger',
                                });
                                if (confirmed) {
                                  await onDeleteUser(user.id);
                                  showToast({
                                    message: `Utente @${user.username} eliminato con successo`,
                                    type: 'info',
                                  });
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                              title="Elimina utente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-[#0b0e14]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowAddModal(false)}
        >
          <div
            id="user-form-modal"
            className="bg-[#11141d] border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                {editingUser ? 'Modifica Credenziali Utente' : 'Crea Nuovo Account Utente'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Ruolo *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'coach', athleteId: '' })}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                      formData.role === 'coach'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/10'
                        : 'bg-[#0b0e14] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-amber-400" />
                    COACH
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'staff', athleteId: '' })}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                      formData.role === 'staff'
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-lg shadow-indigo-500/10'
                        : 'bg-[#0b0e14] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    STAFF
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'athlete' })}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                      formData.role === 'athlete'
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-lg shadow-cyan-500/10'
                        : 'bg-[#0b0e14] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <UserIcon className="w-4 h-4 text-cyan-400" />
                    ATLETA
                  </button>
                </div>
              </div>

              {formData.role === 'athlete' && (
                <div className="space-y-2">
                  <label className="block text-slate-400 font-medium">Collega a Profilo Atleta</label>
                  <select
                    value={formData.athleteId || ''}
                    onChange={(e) => handleSelectAthlete(e.target.value)}
                    className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Nessun atleta associato --</option>
                    {availableAthletes.map((a) => (
                      <option key={a.id} value={a.id}>
                        #{a.jerseyNumber} - {a.firstName} {a.lastName} ({a.role})
                      </option>
                    ))}
                  </select>

                  {/* Conflict Notice / Status Badge */}
                  {selectedAthlete && activeConflicts.length > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{activeConflicts.length} discrepanza/e riscontrata/e nei dati</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingAthlete(selectedAthlete);
                            setConflictFields(activeConflicts);
                            setShowConflictModal(true);
                          }}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-sm shrink-0"
                        >
                          Risolvi Ora
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-200/80">
                        I dati inseriti per l'utente differiscono da quelli del profilo atleta associato.
                      </p>
                    </div>
                  )}

                  {selectedAthlete && activeConflicts.length === 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium pt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Dati tra Utente e Atleta perfettamente allineati e sincronizzati</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nome *</label>
                  <input
                    type="text"
                    required
                    placeholder="es. Marco"
                    value={formData.firstName || ''}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Cognome *</label>
                  <input
                    type="text"
                    required
                    placeholder="es. Rossi"
                    value={formData.lastName || ''}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Username di Accesso *</label>
                  <input
                    type="text"
                    required
                    placeholder="es. marco.rossi"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Password di Accesso *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Password sicura"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-xl px-3 py-2 text-white pr-9 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    Email di Contatto <span className="text-slate-500 font-normal">(facoltativo)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="es. marco@email.com"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    Telefono (WhatsApp) <span className="text-amber-400 font-bold">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="es. 340 1234567"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Live Duplicate Warning Box */}
              {liveDuplicates.length > 0 && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>Rilevato Utente Duplicato ({liveDuplicates.length} campo/i già in uso)</span>
                  </div>
                  <ul className="text-[11px] text-rose-300/90 space-y-1 pl-5 list-disc">
                    {liveDuplicates.map((d, i) => (
                      <li key={i}>
                        <strong>{d.label}</strong>: "{d.matchedValue}" appartiene già all'utente{' '}
                        <strong className="text-white font-mono">@{d.matchedUser.username}</strong> ({d.matchedUser.firstName} {d.matchedUser.lastName})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Salva Credenziali
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate User Warning Modal */}
      {showDuplicateModal && duplicateConflicts.length > 0 && (
        <div
          className="fixed inset-0 z-70 overflow-y-auto bg-[#0b0e14]/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowDuplicateModal(false)}
        >
          <div
            id="duplicate-user-modal"
            className="bg-[#11141d] border border-rose-500/40 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start gap-3 pb-3 border-b border-slate-800">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl shrink-0">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-display">
                  Utente Duplicato Rilevato
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Nel sistema è già presente un account con i medesimi dati su <strong className="text-white">Nome+Cognome, Username, Telefono o Email</strong>:
                </p>
              </div>
            </div>

            {/* List of Matched Conflicts */}
            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
              {duplicateConflicts.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#0b0e14] border border-rose-500/20 rounded-2xl flex items-start gap-3"
                >
                  <UserX className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-rose-300 uppercase text-[10px] tracking-wider">
                      Campo in Conflitto: {item.label}
                    </p>
                    <p className="text-white font-semibold">
                      Valore coincidente: <span className="font-mono text-amber-300">{item.matchedValue}</span>
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      Appartiene già all'account <strong className="text-white">@{item.matchedUser.username}</strong> ({item.matchedUser.firstName} {item.matchedUser.lastName})
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const firstMatch = duplicateConflicts[0]?.matchedUser;
                  if (firstMatch) {
                    setShowDuplicateModal(false);
                    handleOpenEdit(firstMatch);
                    showToast({
                      message: `Aperta la scheda dell'utente esistente @${firstMatch.username}`,
                      type: 'info',
                    });
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-xl transition-all text-center"
              >
                Modifica Utente Esistente (@{duplicateConflicts[0]?.matchedUser.username})
              </button>

              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-950 bg-slate-200 hover:bg-white rounded-xl shadow-md transition-colors text-center"
              >
                Correggi Dati Inseriti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Athlete Conflict Resolution Modal */}
      {showConflictModal && pendingAthlete && (
        <div
          className="fixed inset-0 z-60 overflow-y-auto bg-[#0b0e14]/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowConflictModal(false)}
        >
          <div
            id="conflict-resolution-modal"
            className="bg-[#11141d] border border-amber-500/40 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start gap-3 pb-3 border-b border-slate-800">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-display">
                  Rilevate Discrepanze Dati Atleta / Utente
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  L'atleta <strong className="text-white">#{pendingAthlete.jerseyNumber} {pendingAthlete.firstName} {pendingAthlete.lastName}</strong> presenta informazioni diverse rispetto a quelle correnti. Seleziona i dati corretti da applicare a entrambi:
                </p>
              </div>
            </div>

            {/* Quick Action Toolbar */}
            <div className="flex items-center justify-between p-3 bg-[#0b0e14] border border-slate-800 rounded-2xl">
              <span className="text-xs text-slate-400 font-medium">Scelta rapida globale:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setConflictFields((prev) =>
                      prev.map((f) => ({ ...f, chosenValue: f.userValue }))
                    )
                  }
                  className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl transition-all"
                >
                  Usa tutti i dati Utente
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConflictFields((prev) =>
                      prev.map((f) => ({ ...f, chosenValue: f.athleteValue }))
                    )
                  }
                  className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold rounded-xl transition-all"
                >
                  Usa tutti i dati Atleta
                </button>
              </div>
            </div>

            {/* List of Conflicts */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {conflictFields.map((item) => (
                <div
                  key={item.field}
                  className="p-3 bg-[#0b0e14] border border-slate-800/80 rounded-2xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Campo: {item.label}
                    </span>
                    <span className="text-[10px] text-slate-400 italic">
                      Seleziona il valore da conservare
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* User Option */}
                    <button
                      type="button"
                      onClick={() =>
                        setConflictFields((prev) =>
                          prev.map((f) =>
                            f.field === item.field ? { ...f, chosenValue: item.userValue } : f
                          )
                        )
                      }
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        item.chosenValue === item.userValue
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                          : 'bg-[#11141d] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] uppercase font-black text-amber-400 tracking-wider">
                          Valore Inserito Utente
                        </span>
                        {item.chosenValue === item.userValue && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                      <span className="text-xs font-semibold block truncate">
                        {item.userValue || '(Nessun valore)'}
                      </span>
                    </button>

                    {/* Athlete Option */}
                    <button
                      type="button"
                      onClick={() =>
                        setConflictFields((prev) =>
                          prev.map((f) =>
                            f.field === item.field ? { ...f, chosenValue: item.athleteValue } : f
                          )
                        )
                      }
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        item.chosenValue === item.athleteValue
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold shadow-md shadow-cyan-500/10'
                          : 'bg-[#11141d] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] uppercase font-black text-cyan-400 tracking-wider">
                          Valore Profilo Atleta
                        </span>
                        {item.chosenValue === item.athleteValue && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                      </div>
                      <span className="text-xs font-semibold block truncate">
                        {item.athleteValue || '(Nessun valore)'}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowConflictModal(false);
                  setPendingAthlete(null);
                  setConflictFields([]);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleApplyConflictResolution}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                Conferma e Applica Dati
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
