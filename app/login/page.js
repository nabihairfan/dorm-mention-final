'use client';
import { supabase } from '../../utils/supabaseClient';

export default function LoginPage() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          client_id: '388960353527-fh4grc6mla425lg0e3g1hh67omtrdihd.apps.googleusercontent.com',
        },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div style={{textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif'}}>
      <h1>Login</h1>
      <button 
        onClick={handleLogin}
        style={{padding: '15px 30px', fontSize: '18px', cursor: 'pointer'}}
      >
        Sign in with Google
      </button>
    </div>
  );
}