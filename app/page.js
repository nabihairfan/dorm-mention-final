'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import Link from 'next/link';

export default function ProtectedPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();
  }, []);

  if (loading) return <p>Loading...</p>;

  if (!user) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h1>🛑 Gated Content</h1>
        <p>This route is protected.</p>
        <Link href="/login">Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '50px' }}>
      <h1>✅ Access Granted</h1>
      <p>Welcome, {user.email}</p>
      <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())}>
        Logout
      </button>
    </div>
  );
}
