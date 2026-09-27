import { useState } from 'react';
import { Shield, Loader2, Lock } from 'lucide-react';
import { useSearchStore } from '../store/useSearchStore';

export default function LoginScreen() {
  const login = useSearchStore((s) => s.login);
  const authError = useSearchStore((s) => s.authError);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(username, password);
    } catch {
      /* authError is set by the store */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-surface-950">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-850 p-6 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-950/50">
            <Shield size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="text-[15px] font-bold text-white">SYLTHARAE</div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Sign in to continue</div>
        </div>

        <label htmlFor="login-username" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Username</label>
        <input
          id="login-username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          className="mb-3 w-full rounded-md border border-surface-border bg-surface-800 px-3 py-2 text-[13px] text-slate-200 focus-ring"
        />
        <label htmlFor="login-password" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-surface-border bg-surface-800 px-3 py-2 text-[13px] text-slate-200 focus-ring"
        />

        {authError && (
          <div role="alert" className="mb-3 flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11.5px] text-red-300">
            <Lock size={12} /> {authError}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !username || !password}
          aria-busy={busy}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Sign in
        </button>
      </form>
    </div>
  );
}
