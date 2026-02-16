'use client';
import { supabase } from '../../utils/supabaseClient';

export default function LoginPage() {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Strict requirement: Redirect URI must be /auth/callback
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          // The Client ID from your instructions
          client_id: '388960353527-fh4grc6mla425lg0e3g1hh67omtrdihd.apps.googleusercontent.com',
          prompt: 'consent',
          access_type: 'offline',
        },
      },
    });

    if (error) console.error("Login Error:", error.message);
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
      <h1>🛑 Gated Access</h1>
      <p>Please sign in with your student Google account to continue.</p>
      <button 
        onClick={handleLogin} 
        style={{ padding: '15px 30px', fontSize: '16px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
      >
        Sign in with Google
      </button>
    </div>
  );
}