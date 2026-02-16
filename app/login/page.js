'use client';

import { supabase } from '../../utils/supabaseClient';

/**
 * LOGIN PAGE
 * This is the "Gated UI" for your application.
 * It uses Google OAuth without a Client Secret, as per assignment requirements.
 */
export default function LoginPage() {
  
  const handleLogin = async () => {
    // This initiates the OAuth flow
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        /**
         * REDIRECT URI:
         * This must land exactly on /auth/callback. 
         * Using window.location.origin ensures it works on both localhost and Vercel.
         */
        redirectTo: `${window.location.origin}/auth/callback`,
        
        queryParams: {
          /**
           * GOOGLE CLIENT ID:
           * Provided in assignment instructions.
           */
          client_id: '388960353527-fh4grc6mla425lg0e3g1hh67omtrdihd.apps.googleusercontent.com',
          prompt: 'consent',
          access_type: 'offline',
        },
      },
    });

    if (error) {
      console.error('Error during login initiation:', error.message);
      alert('Login failed to start. Check your console for details.');
    }
  };

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🛑 Gated Access</h1>
        <p style={styles.subtitle}>
          This route is protected. Please sign in with your Google account to proceed.
        </p>
        
        <button onClick={handleLogin} style={styles.button}>
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google" 
            style={styles.icon} 
          />
          Sign in with Google
        </button>

        <footer style={styles.footer}>
          Requirement: Google OAuth (No Client Secret)
        </footer>
      </div>
    </main>
  );
}

// Simple CSS-in-JS for styling the Gated UI
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    padding: '40px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    textAlign: 'center',
    maxWidth: '400px',
  },
  title: {
    fontSize: '24px',
    color: '#333',
    marginBottom: '10px',
  },
  subtitle: {
    color: '#666',
    marginBottom: '30px',
    lineHeight: '1.5',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  icon: {
    width: '20px',
    height: '20px',
  },
  footer: {
    marginTop: '20px',
    fontSize: '12px',
    color: '#999',
  }
};