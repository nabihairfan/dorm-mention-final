'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function DormDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    }
    checkUser();
  }, []);

  if (loading) return <div style={{padding: '50px'}}>Checking security...</div>;

  // --- GATED UI ---
  if (!user) {
    return (
      <div style={{textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif'}}>
        <h1 style={{fontSize: '3rem'}}>🛑 Gated Access</h1>
        <p>You must be signed in to view the Dorm Mention Dashboard.</p>
        <a href="/login" style={{
          display: 'inline-block', padding: '10px 20px', 
          backgroundColor: '#3b82f6', color: 'white', 
          borderRadius: '5px', textDecoration: 'none', marginTop: '20px'
        }}>Go to Login Page</a>
      </div>
    );
  }

  // --- PROTECTED CONTENT ---
  return (
    <div style={{padding: '40px', fontFamily: 'sans-serif'}}>
      <header style={{display: 'flex', justifyContent: 'space-between'}}>
        <h1>🏫 Dorm Mention Dashboard</h1>
        <button onClick={() => supabase.auth.signOut()}>Logout</button>
      </header>
      <div style={{marginTop: '40px', padding: '20px', border: '1px solid #ccc', borderRadius: '10px'}}>
        <p>Welcome, {user.email}! You have successfully bypassed the Gate.</p>
      </div>
    </div>
  );
}
