import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { Lock, User as UserIcon, AlertCircle, ArrowRight, X, Shield, KeyRound } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  canDismiss?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, canDismiss = true }) => {
  const { login, currentUser } = useAuth();
  const { showToast } = useDialog();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await login(username, password);
    setLoading(false);

    if (res.success) {
      showToast({
        message: `Benvenuto in VolleyLab! Accesso eseguito come ${username.trim()}`,
        type: 'success',
      });
      onClose();
    } else {
      setError(res.message || 'Credenziali non valide. Inserisci utente e password corretti.');
      showToast({
        message: 'Credenziali non corrette. Riprova.',
        type: 'error',
      });
    }
  };

  const handleBackdropClick = () => {
    if (canDismiss && currentUser) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#0b0e14]/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        id="login-modal-box"
        className="bg-[#11141d] border border-slate-800 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl space-y-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button (only allowed if already logged in) */}
        {canDismiss && currentUser && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Modal Header */}
        <div className="text-center space-y-2 pt-1">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 text-slate-950 font-black text-2xl tracking-wider ring-1 ring-amber-400/40">
            VL
          </div>
          <h2 className="text-2xl font-black text-white font-display tracking-tight">
            Accedi a VolleyLab
          </h2>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1.5 font-semibold flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-amber-400" />
              Utente
            </label>
            <input
              type="text"
              id="login-input-username"
              required
              autoFocus
              placeholder="Inserisci nome utente"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1.5 font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Password
            </label>
            <input
              type="password"
              id="login-input-password"
              required
              placeholder="Inserisci la password associata"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            id="login-submit-button"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:via-orange-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Verifica in corso...
              </span>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Accedi al Portale
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
