'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ProtectedDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login'); // Protection logic
      } else {
        setUser(user);
      }
      setLoading(false);
    };
    checkUser();
  }, [router]);

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>✅ Access Granted</h1>
      <p>Welcome to the protected dashboard, <strong>{user?.email}</strong></p>
      <button 
        onClick={async () => {
          await supabase.auth.signOut();
          router.push('/login');
        }}
        style={{ marginTop: '20px', padding: '10px', cursor: 'pointer' }}
      >
        Sign Out
      </button>
    </div>
  );
}
