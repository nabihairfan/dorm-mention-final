'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
        } else {
          setUser(session.user);
        }
      } catch (e) {
        console.error("Auth error", e);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, [router]);

  if (loading) return <div style={{padding: '20px'}}>Loading...</div>;
  if (!user) return null; // Prevents the flicker before redirect

  return (
    <div style={{ padding: '50px', fontFamily: 'sans-serif' }}>
      <h1>✅ Access Granted</h1>
      <p>Welcome, {user.email}</p>
      <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())}>
        Sign Out
      </button>
    </div>
  );
}
