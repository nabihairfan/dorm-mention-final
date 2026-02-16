'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const getData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data: captions } = await supabase.from('captions').select('content');
      const { data: dorms } = await supabase.from('dorms').select('short_name');

      if (captions && dorms) {
        const counts = dorms.map(d => ({
          name: d.short_name,
          count: captions.filter(c => c.content?.toLowerCase().includes(d.short_name.toLowerCase())).length
        })).sort((a,b) => b.count - a.count);
        setResults(counts);
      }
      setLoading(false);
    };
    getData();
  }, [router]);

  if (loading) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      {/* Fun Header */}
      <nav style={{ background: 'white', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h1 style={{ margin: 0, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: '900' }}>DormPulse.</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontWeight: '600', color: '#475569' }}>👋 {user.email.split('@')[0]}</span>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Logout</button>
        </div>
      </nav>

      <main style={{ padding: '40px' }}>
        <header style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '32px', color: '#1e293b' }}>Live Dorm Mentions</h2>
          <p style={{ color: '#64748b' }}>Real-time data from your Supabase captions table.</p>
        </header>

        {/* Bento Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
          {results.map((dorm, i) => (
            <div key={i} style={{ background: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', transition: 'transform 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '800' }}>DORM</span>
                <span style={{ fontSize: '24px' }}>🏠</span>
              </div>
              <h3 style={{ fontSize: '22px', margin: '0 0 5px 0', color: '#1e293b' }}>{dorm.name}</h3>
              <p style={{ margin: 0, fontSize: '48px', fontWeight: '800', color: '#6366f1' }}>{dorm.count}</p>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', fontWeight: '600' }}>TOTAL MENTIONS</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
