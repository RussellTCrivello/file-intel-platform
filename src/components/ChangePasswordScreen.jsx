import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useSearchStore } from '../store/useSearchStore';
import { toast } from './ui/Toast';

// Upstream RES-AUTH-02: an active session is no longer sufficient proof to
// change a password -- the server now also requires the current one (so an
// unattended browser or a stolen session token can't take the account over).
// A wrong current password counts toward the same lockout as a failed
// sign-in; the server's own message/code is surfaced verbatim rather than
// re-worded, since it already distinguishes "wrong password" from "locked".
export default function ChangePasswordScreen() {
  const changePassword = useSearchStore((s) => s.changePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    setError('');
    try {
      await changePassword(currentPassword, password);
      toast('Password updated', { type: 'success' });
    } catch (e2) {
      setError(e2.body?.error || e2.message || 'Could not update password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-surface-950">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-850 p-6 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400"><KeyRound size={22} /></div>
          <div className="text-[15px] font-bold text-white">Set a new password</div>
          <div className="text-center text-[11.5px] text-slate-500">Your account requires a password change before continuing.</div>
        </div>
        <label htmlFor="current-password" className="sr-only">Current password</label>
        <input id="current-password" name="current-password" type="password" autoComplete="current-password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mb-3 w-full rounded-md border border-surface-border bg-surface-800 px-3 py-2 text-[13px] text-slate-200 focus-ring" />
        <label htmlFor="new-password" className="sr-only">New password</label>
        <input id="new-password" name="new-password" type="password" autoComplete="new-password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className="mb-3 w-full rounded-md border border-surface-border bg-surface-800 px-3 py-2 text-[13px] text-slate-200 focus-ring" />
        <label htmlFor="confirm-password" className="sr-only">Confirm password</label>
        <input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mb-4 w-full rounded-md border border-surface-border bg-surface-800 px-3 py-2 text-[13px] text-slate-200 focus-ring" />
        {error && <div role="alert" className="mb-3 text-[11.5px] text-red-300">{error}</div>}
        <button type="submit" disabled={busy || !password || !currentPassword} aria-busy={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-500 disabled:opacity-60">
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Update password
        </button>
      </form>
    </div>
  );
}
