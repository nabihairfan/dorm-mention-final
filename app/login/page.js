'use client';
import { supabase } from '../../utils/supabaseClient';

export default function LoginPage() {
  const handleLogin = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          client_id: '388960353527-fh4grc6mla425lg0e3g1hh67omtrdihd.apps.googleusercontent.com',
        },
      },
    });
  };

  return (
    <div style={{ padding: '100px', textAlign: 'center' }}>
      <h1>Gated Access</h1>
      <button onClick={handleLogin}>Sign in with Google</button>
    </div>
  );
}