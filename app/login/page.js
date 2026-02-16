'use client';
import { supabase } from '../../utils/supabaseClient';

export default function LoginPage() {
  const handleLogin = async () => {
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
    <div style={styles.container}>
      <div style={styles.glassCard}>
        <div style={styles.emoji}>🚀</div>
        <h1 style={styles.title}>Welcome to DormPulse</h1>
        <p style={styles.subtitle}>The coolest way to track what people are saying about campus living.</p>
        <button onClick={handleLogin} style={styles.loginBtn}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{width:'20px'}}/>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'sans-serif' },
  glassCard: { background: 'rgba(255, 255, 255, 0.95)', padding: '50px', borderRadius: '30px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', textAlign: 'center', maxWidth: '400px' },
  emoji: { fontSize: '50px', marginBottom: '20px' },
  title: { fontSize: '28px', fontWeight: '800', color: '#1a1a1a', margin: '0 0 10px 0' },
  subtitle: { color: '#666', marginBottom: '30px', lineHeight: '1.6' },
  loginBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '15px', borderRadius: '15px', border: '2px solid #eee', background: 'white', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }
};