import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  FileText,
  Users,
  Calendar,
  Layers,
  KeyRound,
  RefreshCw,
  HardDriveDownload,
  BookmarkPlus,
  HelpCircle,
  X,
} from 'lucide-react';
import { Athlete, TrainingSession, MatchEvent, User } from '../../types';
import {
  createFullSystemBackup,
  restoreSystemFromBackup,
  saveLocalRestorePoint,
  getLocalRestorePoints,
  deleteLocalRestorePoint,
  subscribeRestorePoints,
  SystemBackupPayload,
  LocalRestorePoint,
} from '../../lib/db';
import { useDialog } from '../../context/DialogContext';
import { config as firebaseConfig } from '../../lib/firebase';

interface SettingsManagerProps {
  athletes: Athlete[];
  trainings: TrainingSession[];
  matches: MatchEvent[];
  users: User[];
  currentUser: User | null;
  onRefreshData?: () => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  athletes,
  trainings,
  matches,
  users,
  currentUser,
}) => {
  const { confirm, showToast } = useDialog();

  const [restorePoints, setRestorePoints] = useState<LocalRestorePoint[]>([]);
  const [newPointLabel, setNewPointLabel] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Snapshot restore modal state
  const [selectedSnapshotForRestore, setSelectedSnapshotForRestore] = useState<LocalRestorePoint | null>(null);
  const [snapshotRestoreMode, setSnapshotRestoreMode] = useState<'replace' | 'merge'>('replace');

  // File import state
  const [selectedFileBackup, setSelectedFileBackup] = useState<SystemBackupPayload | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');

  useEffect(() => {
    const unsubscribe = subscribeRestorePoints((points) => {
      setRestorePoints(points);
    });
    return () => unsubscribe();
  }, []);

  // 1. Download JSON Backup (Pure export, no snapshot side-effects)
  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      const backup = await createFullSystemBackup({ athletes, trainings, matches, users });

      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const datePart = now.toISOString().split('T')[0];
      const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '-').slice(0, 5);
      const filename = `volleylab_backup_${datePart}_${timePart}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast({
        message: `File di backup scaricato con successo (${filename})`,
        type: 'success',
      });
    } catch (err) {
      console.error('Backup error:', err);
      showToast({
        message: 'Errore durante la creazione del backup.',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Create manual cloud snapshot
  const handleCreateRestorePoint = async () => {
    if (!newPointLabel.trim()) {
      showToast({
        message: 'Inserisci una descrizione o etichetta per il punto di ripristino cloud.',
        type: 'warning',
      });
      return;
    }

    const snapshotData = {
      athletes: [...athletes],
      trainings: [...trainings],
      matches: [...matches],
      users: [...users],
    };

    await saveLocalRestorePoint(newPointLabel, snapshotData);
    setNewPointLabel('');

    showToast({
      message: 'Punto di ripristino salvato nel cloud Firestore e accessibile a tutti gli utenti!',
      type: 'success',
    });
  };

  // 3. Handle File Selection for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    setSelectedFileBackup(null);

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== 'object' || !parsed.data) {
          throw new Error('Il file caricato non sembra un backup valido di VolleyLab (struttura dati mancante).');
        }
        setSelectedFileBackup(parsed as SystemBackupPayload);
      } catch (err: any) {
        setFileError(err.message || 'File JSON non valido o corrotto.');
      }
    };
    reader.onerror = () => {
      setFileError('Impossibile leggere il file selezionato.');
    };
    reader.readAsText(file);
  };

  // 4. Execute Restore from File
  const handleRestoreFromFile = async () => {
    if (!selectedFileBackup) return;

    const confirmed = await confirm({
      title: 'Conferma Ripristino Dati da File',
      message: `Stai per ripristinare ${selectedFileBackup.data.athletes?.length || 0} Atleti, ${selectedFileBackup.data.trainings?.length || 0} Allenamenti e ${selectedFileBackup.data.matches?.length || 0} Partite nel database cloud Firestore. Modalità: ${restoreMode === 'replace' ? 'SOSTITUZIONE TOTALE (i dati non presenti nel file verranno rimossi)' : 'UNIONE / AGGIORNAMENTO'}. Vuoi procedere?`,
      confirmText: 'Sì, Ripristina nel Cloud',
      cancelText: 'Annulla',
      type: restoreMode === 'replace' ? 'danger' : 'warning',
    });

    if (!confirmed) return;

    try {
      setIsRestoring(true);
      const result = await restoreSystemFromBackup(selectedFileBackup.data, restoreMode);

      showToast({
        message: `Ripristino completato: ${result.restoredAthletes} atleti, ${result.restoredTrainings} allenamenti, ${result.restoredMatches} partite sincronizzati su Firestore!`,
        type: 'success',
      });

      setSelectedFileBackup(null);
    } catch (err) {
      console.error('Restore error:', err);
      showToast({
        message: 'Errore durante il ripristino dei dati nel cloud.',
        type: 'error',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // 5. Open snapshot restore modal
  const handleOpenSnapshotRestoreModal = (point: LocalRestorePoint) => {
    setSelectedSnapshotForRestore(point);
    setSnapshotRestoreMode('replace'); // Default to replace (exact rollback)
  };

  const handleExecuteSnapshotRestore = async () => {
    if (!selectedSnapshotForRestore) return;

    try {
      setIsRestoring(true);
      const result = await restoreSystemFromBackup(selectedSnapshotForRestore.data, snapshotRestoreMode);

      showToast({
        message: snapshotRestoreMode === 'replace'
          ? `Ripristino esatto completato! Database sincronizzato allo stato dello snapshot "${selectedSnapshotForRestore.label}" (${result.restoredAthletes} atleti presenti).`
          : `Unione completata con successo! ${result.restoredAthletes} atleti sincronizzati nel cloud.`,
        type: 'success',
      });

      setSelectedSnapshotForRestore(null);
    } catch (err) {
      console.error('Restore point error:', err);
      showToast({
        message: 'Errore durante l\'applicazione del punto di ripristino nel cloud.',
        type: 'error',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // 6. Delete a cloud restore point
  const handleDeleteRestorePoint = async (pointId: string, pointLabel: string) => {
    const confirmed = await confirm({
      title: 'Elimina Punto di Ripristino Cloud',
      message: `Sei sicuro di voler rimuovere lo snapshot "${pointLabel}" dal database cloud? Non sarà più visibile agli altri utenti.`,
      confirmText: 'Elimina dal Cloud',
      cancelText: 'Annulla',
      type: 'danger',
    });

    if (confirmed) {
      await deleteLocalRestorePoint(pointId);
      showToast({
        message: 'Punto di ripristino eliminato dal cloud per tutti gli utenti.',
        type: 'info',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-white font-display tracking-tight">
                Impostazioni & Sicurezza Dati
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Protezione Cloud Attiva
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Gestione backup completi, esportazione file JSON e punti di ripristino per proteggere la rosa atleti, presenze e partite da errori operativi.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-102 cursor-pointer disabled:opacity-50"
            >
              <HardDriveDownload className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              {isExporting ? 'Generazione...' : 'Scarica Backup Completo (.json)'}
            </button>
          </div>
        </div>

        {/* Cloud Status Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-[#0b0e14] p-3 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Atleti Cloud</span>
              <span className="text-base font-black text-white">{athletes.length}</span>
            </div>
          </div>

          <div className="bg-[#0b0e14] p-3 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Allenamenti Cloud</span>
              <span className="text-base font-black text-white">{trainings.length}</span>
            </div>
          </div>

          <div className="bg-[#0b0e14] p-3 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Partite Cloud</span>
              <span className="text-base font-black text-white">{matches.length}</span>
            </div>
          </div>

          <div className="bg-[#0b0e14] p-3 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Utenti / Credenziali</span>
              <span className="text-base font-black text-white">{users.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SEZIONE 1: CREA PUNTO DI RIPRISTINO ISTANTANEO */}
        <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <BookmarkPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">Crea Nuovo Punto di Ripristino Cloud</h2>
              <p className="text-xs text-slate-400">Salva un'istantanea dell'intero database nel cloud Firestore, visibile a tutti gli operatori</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Nome o Etichetta dello Snapshot Cloud
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="es. Rosa Atleti Completa 2026, Prima di modificare presenze, ecc."
                value={newPointLabel}
                onChange={(e) => setNewPointLabel(e.target.value)}
                className="flex-1 bg-[#0b0e14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleCreateRestorePoint}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 hover:border-amber-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <BookmarkPlus className="w-4 h-4" />
                Salva Snapshot Cloud
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Gli snapshot salvati nel cloud sono condivisi e sincronizzati in tempo reale tra tutti i dispositivi di coach e staff.
            </p>
          </div>

          {/* Storico Punti di Ripristino */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Punti di Ripristino Cloud Salvati ({restorePoints.length})
            </h3>

            {restorePoints.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
                Nessun punto di ripristino cloud presente. Crea un nuovo snapshot per salvarne uno sul database.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {restorePoints.map((point) => (
                  <div
                    key={point.id}
                    className="p-3.5 bg-[#0b0e14] rounded-2xl border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white truncate">{point.label}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(point.timestamp).toLocaleDateString('it-IT')} {new Date(point.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span><strong>{point.athletesCount}</strong> Atleti</span>
                        <span>•</span>
                        <span><strong>{point.trainingsCount}</strong> Allenamenti</span>
                        <span>•</span>
                        <span><strong>{point.matchesCount}</strong> Partite</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenSnapshotRestoreModal(point)}
                        disabled={isRestoring}
                        className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Ripristina questo snapshot nel cloud Firestore"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Ripristina
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRestorePoint(point.id, point.label)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl transition-colors cursor-pointer"
                        title="Elimina punto di ripristino"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SEZIONE 2: RIPRISTINO DA FILE JSON */}
        <div className="bg-[#11141d] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white font-display">Ripristina da File Backup (.json)</h2>
                <p className="text-xs text-slate-400">Carica un file di backup scaricato in precedenza per ricostruire l'intero database</p>
              </div>
            </div>

            {/* Input file picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Seleziona il File di Backup (.json)
              </label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-amber-400 hover:file:bg-slate-700 file:cursor-pointer border border-slate-800 rounded-2xl p-2 bg-[#0b0e14]"
              />
              {fileError && (
                <div className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {fileError}
                </div>
              )}
            </div>

            {/* File Inspection Summary */}
            {selectedFileBackup && (
              <div className="p-4 bg-[#0b0e14] rounded-2xl border border-amber-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    File di Backup Valido
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Esportato il {new Date(selectedFileBackup.exportedAt).toLocaleDateString('it-IT')} ore {new Date(selectedFileBackup.exportedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Atleti</span>
                    <strong className="text-white text-sm">{selectedFileBackup.data.athletes?.length || 0}</strong>
                  </div>
                  <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Allenamenti</span>
                    <strong className="text-white text-sm">{selectedFileBackup.data.trainings?.length || 0}</strong>
                  </div>
                  <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Partite</span>
                    <strong className="text-white text-sm">{selectedFileBackup.data.matches?.length || 0}</strong>
                  </div>
                  <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Utenti</span>
                    <strong className="text-white text-sm">{selectedFileBackup.data.users?.length || 0}</strong>
                  </div>
                </div>

                {/* Modalità di ripristino */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <label className="text-[11px] font-bold text-slate-300 block">Modalità di Ripristino:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className={`p-2.5 rounded-xl border flex items-start gap-2 cursor-pointer transition-all ${
                      restoreMode === 'replace' ? 'bg-amber-500/15 border-amber-500/50 text-white' : 'bg-[#11141d] border-slate-800 text-slate-400'
                    }`}>
                      <input
                        type="radio"
                        name="restoreMode"
                        checked={restoreMode === 'replace'}
                        onChange={() => setRestoreMode('replace')}
                        className="mt-0.5 accent-amber-500"
                      />
                      <div>
                        <strong className="block text-xs text-amber-400">Ripristino Esatto (Consigliato)</strong>
                        <span className="text-[10px] text-slate-400 block leading-tight">Riporta il database all'esatto stato del file (rimuove dati creati dopo)</span>
                      </div>
                    </label>

                    <label className={`p-2.5 rounded-xl border flex items-start gap-2 cursor-pointer transition-all ${
                      restoreMode === 'merge' ? 'bg-amber-500/15 border-amber-500/50 text-white' : 'bg-[#11141d] border-slate-800 text-slate-400'
                    }`}>
                      <input
                        type="radio"
                        name="restoreMode"
                        checked={restoreMode === 'merge'}
                        onChange={() => setRestoreMode('merge')}
                        className="mt-0.5 accent-amber-500"
                      />
                      <div>
                        <strong className="block text-xs">Unione Dati</strong>
                        <span className="text-[10px] text-slate-400 block leading-tight">Conserva i record esistenti e aggiunge/sovrascrive quelli del file</span>
                      </div>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRestoreFromFile}
                  disabled={isRestoring}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                  {isRestoring ? 'Ripristino in corso...' : 'Conferma e Applica Ripristino su Firestore'}
                </button>
              </div>
            )}
          </div>

          {/* Database info card */}
          <div className="p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 space-y-2 text-xs text-slate-400 mt-4">
            <div className="flex items-center gap-2 text-white font-bold">
              <Database className="w-4 h-4 text-amber-400" />
              <span>Dettagli Connessione Cloud</span>
            </div>
            <div className="font-mono text-[11px] space-y-1">
              <div>Progetto Firebase: <strong className="text-slate-200">{firebaseConfig?.projectId || 'artful-dominion-gwn2z'}</strong></div>
              <div>Database ID: <strong className="text-slate-200">{firebaseConfig?.firestoreDatabaseId || 'ai-studio-091959d1-9a16-4eae-8631-c0bc089f9d76'}</strong></div>
              <div>Stato Sincronizzazione: <strong className="text-emerald-400">Tempo Reale (Active Listeners)</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* MODALE DI CONFERMA RIPRISTINO SNAPSHOT LOCALE */}
      {selectedSnapshotForRestore && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11141d] border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    Ripristino Snapshot
                  </h3>
                  <p className="text-xs text-slate-400">
                    "{selectedSnapshotForRestore.label}"
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSnapshotForRestore(null)}
                className="p-1.5 text-slate-500 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Confronto dati */}
            <div className="bg-[#0b0e14] p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1.5 border-b border-slate-800/80">
                <span>Creato il:</span>
                <span className="font-mono text-white">
                  {new Date(selectedSnapshotForRestore.timestamp).toLocaleDateString('it-IT')} ore{' '}
                  {new Date(selectedSnapshotForRestore.timestamp).toLocaleTimeString('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Atleti</span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="text-xs font-bold text-amber-400">
                      {selectedSnapshotForRestore.athletesCount}
                    </span>
                    <span className="text-[10px] text-slate-500">→ ora {athletes.length}</span>
                  </div>
                </div>

                <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Allenamenti</span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="text-xs font-bold text-cyan-400">
                      {selectedSnapshotForRestore.trainingsCount}
                    </span>
                    <span className="text-[10px] text-slate-500">→ ora {trainings.length}</span>
                  </div>
                </div>

                <div className="bg-[#11141d] p-2 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Partite</span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="text-xs font-bold text-indigo-400">
                      {selectedSnapshotForRestore.matchesCount}
                    </span>
                    <span className="text-[10px] text-slate-500">→ ora {matches.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Scelta modalità di ripristino */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Seleziona Modalità di Ripristino:
              </label>

              <div className="space-y-2">
                <label
                  className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                    snapshotRestoreMode === 'replace'
                      ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-md'
                      : 'bg-[#0b0e14] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="snapshotRestoreMode"
                    checked={snapshotRestoreMode === 'replace'}
                    onChange={() => setSnapshotRestoreMode('replace')}
                    className="mt-1 accent-amber-500"
                  />
                  <div>
                    <strong className="block text-xs text-amber-400 font-bold">
                      Ripristino Esatto allo Snapshot (Consigliato)
                    </strong>
                    <span className="text-[11px] text-slate-400 block mt-0.5 leading-snug">
                      Riporta il database all'esatto stato in cui è stato creato questo snapshot. Se hai aggiunto atleti o partite successivamente, verranno rimossi per tornare esattamente a questo punto.
                    </span>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                    snapshotRestoreMode === 'merge'
                      ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-md'
                      : 'bg-[#0b0e14] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="snapshotRestoreMode"
                    checked={snapshotRestoreMode === 'merge'}
                    onChange={() => setSnapshotRestoreMode('merge')}
                    className="mt-1 accent-amber-500"
                  />
                  <div>
                    <strong className="block text-xs font-bold">
                      Unione Dati (Conserva nuovi inserimenti)
                    </strong>
                    <span className="text-[11px] text-slate-400 block mt-0.5 leading-snug">
                      Mantiene gli atleti e le sessioni creati dopo questo snapshot, aggiungendo e aggiornando solo i record presenti nello snapshot.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Pulsanti azione */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedSnapshotForRestore(null)}
                disabled={isRestoring}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleExecuteSnapshotRestore}
                disabled={isRestoring}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                {isRestoring ? 'Ripristino in corso...' : 'Conferma e Applica nel Cloud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
