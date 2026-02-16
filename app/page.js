'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormMentionDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const initializePage = async () => {
      // 1. Check for Authentication Session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      // 2. Fetch Data from both tables
      const { data: captionsData } = await supabase.from('captions').select('content');
      const { data: dormsData } = await supabase.from('dorms').select('short_name');

      if (captionsData && dormsData) {
        // 3. Logic to count mentions
        const counts = dormsData.map(dorm => {
          const mentionCount = captionsData.filter(cap => 
            cap.content?.toLowerCase().includes(dorm.short_name.toLowerCase())
          ).length;
          
          return {
            name: dorm.short_name,
            count: mentionCount
          };
        });

        // Sort by highest mentions
        setResults(counts.sort((a, b) => b.count - a.count));
      }
      
      setLoading(false);
    };

    initializePage();
  }, [router]);

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>🔄 Loading Protected Data...</div>;

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto', padding: '20px', color: '#333' }}>
      {/* Navbar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>🏫 Dorm Mention Tracker</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>{user.email}</span>
          <button 
            onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
            style={{ padding: '8px 16px', cursor: 'pointer', borderRadius: '5px', border: '1px solid #ccc' }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Assignment Content */}
      <main style={{ marginTop: '40px' }}>
        <div style={{ backgroundColor: '#eefaff', padding: '15px', borderRadius: '8px', marginBottom: '30px' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>✅ Access Verified</h3>
          <p style={{ margin: 0 }}>This data is pulled from the <strong>captions</strong> and <strong>dorms</strong> tables in your Supabase database.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
          {results.map((dorm, index) => (
            <div key={index} style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '10px', textAlign: 'center', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#0070f3' }}>{dorm.name}</h4>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{dorm.count}</div>
              <div style={{ fontSize: '12px', color: '#999' }}>Mentions</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
