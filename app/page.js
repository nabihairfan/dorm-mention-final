'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

// IMPORT YOUR COMPONENTS FROM ASSIGNMENT #2 HERE
// import MyOriginalWebsite from '../components/MyOriginalWebsite';

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login'); // Still kick to login if not authenticated
      } else {
        setUser(session.user);
      }
      setLoading(false);
    };
    checkUser();
  }, [router]);

  if (loading) return <div style={{ padding: '50px' }}>Verifying Access...</div>;
  if (!user) return null;

  return (
    <div>
      {/* 1. KEEP THE LOGOUT BUTTON AT THE TOP SO YOU DON'T GET STUCK */}
      <nav style={{ padding: '10px', background: '#eee', display: 'flex', justifyContent: 'space-between' }}>
        <span>Logged in as: {user.email}</span>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())}>
          Sign Out
        </button>
      </nav>

      {/* 2. PASTE YOUR ASSIGNMENT #2 WEBSITE CONTENT BELOW THIS LINE */}
      <main style={{ padding: '20px' }}>
        <h1>My Assignment #2 Website</h1>
        <p>This is the content that was hidden behind the gate.</p>
        {/* <MyOriginalWebsite /> */}
      </main>
    </div>
  );
}
