'use client';
import { supabase } from '../../utils/supabaseClient';

export default function LoginPage() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Strict assignment requirement: final landing must be /auth/callback
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          client_id: '388960353527-fh4grc6mla425lg0e3g1hh67omtrdihd.apps.googleusercontent.com',
        },
      },
    });
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
      <h1>Locked Route</h1>
      <p>Please sign in to continue.</p>
      <button 
        onClick={handleLogin} 
        style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '4px' }}
      >
        Sign in with Google
      </button>
    </div>
  );
}