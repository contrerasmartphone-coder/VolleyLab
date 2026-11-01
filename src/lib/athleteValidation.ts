import { Athlete } from '../types';

export interface AthleteDuplicateCheckResult {
  hasDuplicate: boolean;
  duplicateFields: {
    jerseyNumber?: string;
    fiscalCode?: string;
    fullName?: string;
    phone?: string;
  };
  summaryMessages: string[];
}

/**
 * Convalida del Codice Fiscale italiano quando presente:
 * - Se vuoto o non specificato, ritorna valido (campo facoltativo).
 * - Se presente, deve rispettare lo standard italiano (16 caratteri alfanumerici
 *   formato standard o omocodia: 6 lettere, 2 cifre/omocodia, 1 lettera, 2 cifre/omocodia, 1 lettera, 3 cifre/omocodia, 1 lettera di controllo)
 *   oppure 11 cifre numeriche (codice numerico / provvisorio).
 */
export function isValidFiscalCode(fiscalCode?: string): boolean {
  if (!fiscalCode || fiscalCode.trim() === '') return true;
  const cf = fiscalCode.trim().toUpperCase();
  const standardPattern = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPR-T]{1}[0-9LMNPQRSTUV]{2}[A-Z]{1}[0-9LMNPQRSTUV]{3}[A-Z]{1}$/;
  const numericPattern = /^\d{11}$/;
  return standardPattern.test(cf) || numericPattern.test(cf);
}

/**
 * Convalida dell'indirizzo Email quando presente:
 * - Se vuoto o non specificato, ritorna valido (campo facoltativo).
 * - Se presente, deve essere un formato email valido (es. utente@dominio.ext).
 */
export function isValidEmail(email?: string): boolean {
  if (!email || email.trim() === '') return true;
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailPattern.test(email.trim());
}

/**
 * Checks if two phone numbers match, correctly handling international prefixes
 * (such as +39, +30, 0039, etc.) or no prefix.
 * E.g., "+30 3209485403" matches "3209485403", "0039 3209485403" matches "+39 320 948 5403", etc.
 */
export function arePhoneNumbersMatching(phoneA?: string, phoneB?: string): boolean {
  if (!phoneA || !phoneB) return false;

  // Extract only digits
  let cleanA = phoneA.replace(/\D/g, '');
  let cleanB = phoneB.replace(/\D/g, '');

  if (!cleanA || !cleanB) return false;

  // Strip international dialing prefix "00" (e.g. 0039 -> 39)
  if (cleanA.startsWith('00')) cleanA = cleanA.slice(2);
  if (cleanB.startsWith('00')) cleanB = cleanB.slice(2);

  // Exact digits match
  if (cleanA === cleanB) return true;

  // If too short, require exact match
  if (cleanA.length < 8 || cleanB.length < 8) return false;

  // If both numbers include prefixes and share the same 10-digit mobile number
  if (cleanA.length >= 10 && cleanB.length >= 10) {
    if (cleanA.slice(-10) === cleanB.slice(-10)) {
      return true;
    }
  }

  // Same 9-digit number
  if (cleanA.length >= 9 && cleanB.length >= 9) {
    if (cleanA.slice(-9) === cleanB.slice(-9)) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes phone numbers with +39 prefix if needed and generates direct WhatsApp URL
 */
export function getWhatsAppLink(rawPhone?: string): string {
  if (!rawPhone) return '';
  const trimmed = rawPhone.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('39') && digits.length >= 11) {
    return `https://wa.me/${digits}`;
  }

  if (trimmed.startsWith('+') && !digits.startsWith('39')) {
    return `https://wa.me/${digits}`;
  }

  return `https://wa.me/39${digits}`;
}

/**
 * Normalizes a phone number for display/storage:
 * Ensures it has an international prefix (default +39) and standard spacing.
 */
export function normalizePhoneDisplay(rawPhone?: string): string {
  if (!rawPhone) return '';
  const trimmed = rawPhone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;
  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`;
  }
  if (digits.startsWith('39') && digits.length >= 11) {
    return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  }
  return `+39 ${trimmed}`;
}

/**
 * Checks for duplicate athlete values:
 * 1. Numero maglia
 * 2. Codice Fiscale
 * 3. Nome + Cognome
 * 4. Telefono (con o senza prefisso internazionale)
 */
export function checkAthleteDuplicates(
  candidate: {
    id?: string;
    jerseyNumber?: number | string;
    fiscalCode?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  },
  existingAthletes: Athlete[]
): AthleteDuplicateCheckResult {
  const summaryMessages: string[] = [];
  const duplicateFields: AthleteDuplicateCheckResult['duplicateFields'] = {};

  // Filter out candidate if editing
  const otherAthletes = candidate.id
    ? existingAthletes.filter((a) => a.id !== candidate.id)
    : existingAthletes;

  // 1. Numero Maglia Check
  if (
    candidate.jerseyNumber !== undefined &&
    candidate.jerseyNumber !== null &&
    candidate.jerseyNumber !== ''
  ) {
    const num = Number(candidate.jerseyNumber);
    if (!isNaN(num)) {
      const match = otherAthletes.find((a) => a.jerseyNumber === num);
      if (match) {
        const msg = `Numero maglia #${num} già assegnato a ${match.firstName} ${match.lastName}`;
        duplicateFields.jerseyNumber = msg;
        summaryMessages.push(msg);
      }
    }
  }

  // 2. Codice Fiscale Check
  if (candidate.fiscalCode && candidate.fiscalCode.trim() !== '') {
    const cf = candidate.fiscalCode.trim().toUpperCase();
    const match = otherAthletes.find(
      (a) => a.fiscalCode && a.fiscalCode.trim().toUpperCase() === cf
    );
    if (match) {
      const msg = `Codice Fiscale "${cf}" già registrato per l'atleta ${match.firstName} ${match.lastName}`;
      duplicateFields.fiscalCode = msg;
      summaryMessages.push(msg);
    }
  }

  // 3. Nome + Cognome Check
  if (candidate.firstName?.trim() && candidate.lastName?.trim()) {
    const fn = candidate.firstName.trim().toLowerCase();
    const ln = candidate.lastName.trim().toLowerCase();
    const match = otherAthletes.find(
      (a) =>
        a.firstName.trim().toLowerCase() === fn &&
        a.lastName.trim().toLowerCase() === ln
    );
    if (match) {
      const msg = `Atleta "${candidate.firstName.trim()} ${candidate.lastName.trim()}" (#${match.jerseyNumber}) già presente in rosa`;
      duplicateFields.fullName = msg;
      summaryMessages.push(msg);
    }
  }

  // 4. Telefono Check (con e senza prefisso)
  if (candidate.phone && candidate.phone.trim() !== '') {
    const candidatePhone = candidate.phone.trim();
    const candidateDigits = candidatePhone.replace(/\D/g, '');
    if (candidateDigits.length >= 6) {
      const match = otherAthletes.find((a) => {
        if (!a.phone || a.phone.trim() === '') return false;
        return arePhoneNumbersMatching(candidatePhone, a.phone);
      });
      if (match) {
        const msg = `Telefono "${candidatePhone}" già registrato per l'atleta ${match.firstName} ${match.lastName} (${match.phone})`;
        duplicateFields.phone = msg;
        summaryMessages.push(msg);
      }
    }
  }

  return {
    hasDuplicate: summaryMessages.length > 0,
    duplicateFields,
    summaryMessages,
  };
}
