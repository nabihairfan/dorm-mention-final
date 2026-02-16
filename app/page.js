'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login'); // If no user, go to login
      } else {
        setUser(user);
      }
      setLoading(false);
    };
    fetchUser();
  }, [router]);

  if (loading) return <div style={{ padding: '50px' }}>Loading...</div>;

  return (
    <div style={{ padding: '50px', fontFamily: 'sans-serif' }}>
      <h1>✅ Success! You are signed in.</h1>
      <p>Welcome back, <strong>{user.email}</strong></p>
      <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>Protected Website Content</h3>
        <p>This information is only visible to authenticated students.</p>
      </div>
      <button 
        onClick={async () => {
          await supabase.auth.signOut();
          router.push('/login');
        }}
        style={{ marginTop: '20px', cursor: 'pointer' }}
      >
        Sign Out
      </button>
    </div>
  );
}
