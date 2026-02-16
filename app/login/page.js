'use client';
import { supabase } from '../../utils/supabaseClient';

export default function LoginPage() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Redirecting to the page we just made
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          client_id: '388960353527-fh4grc6mla425lg0e3g1hh67omtrdihd.apps.googleusercontent.com',
        },
      },
    });
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>Sign In</h1>
      <button onClick={handleLogin} style={{ padding: '10px 20px', cursor: 'pointer' }}>
        Login with Google
      </button>
    </div>
  );
}