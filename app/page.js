'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ConfessionsBoard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const router = useRouter();

  const colors = ['#FFEDD5', '#DBEAFE', '#D1FAE5', '#FCE7F3', '#FEF3C7', '#EDE9FE'];

  useEffect(() => {
    const fetchSessionAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data: captionsData } = await supabase.from('captions').select('id, content').limit(30);
      
      if (captionsData) {
        const { data: existingVotes } = await supabase
          .from('caption_votes')
          .select('caption_id, vote_value')
          .eq('profile_id', session.user.id);

        const formattedCaptions = captionsData.map(cap => {
          const pastVote = existingVotes?.find(v => v.caption_id === cap.id);
          return {
            ...cap,
            userVote: pastVote ? pastVote.vote_value : null 
          };
        });

        setCaptions(formattedCaptions);
      }
      setLoading(false);
    };
    fetchSessionAndData();
  }, [router]);

  const handleVote = async (captionId, voteValue) => {
    if (!user) return;

    // THE FIX: Adding created_datetime_utc because the database requires it
    const { error } = await supabase
      .from('caption_votes')
      .upsert(
        { 
          caption_id: captionId, 
          profile_id: user.id, 
          vote_value: voteValue,
          created_datetime_utc: new Date().toISOString() // Manually sending the timestamp
        }, 
        { onConflict: 'caption_id, profile_id' }
      );

    if (error) {
      console.error("Mutation failed:", error.message);
      alert(`Database Error: ${error.message}`);
    } else {
      setCaptions(prev => prev.map(c => 
        c.id === captionId ? { ...c, userVote: voteValue } : c
      ));
    }
  };

  if (loading) return <div style={styles.loader}>✨ Syncing the campus vibes...</div>;

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <h1 style={styles.logo}>DormPulse ✨</h1>
        <div style={styles.userSection}>
          <span style={styles.email}>{user.email}</span>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={styles.logout}>Sign Out</button>
        </div>
      </nav>

      <header style={styles.header}>
        <h2 style={styles.title}>Campus Feed</h2>
        <p style={styles.subtitle}>Click a card to cast your vote. 🔥 (1) | 🗑️ (-1)</p>
      </header>

      <div style={styles.masonryGrid}>
        {captions.map((cap, i) => (
          <div key={cap.id} style={{...styles.card, backgroundColor: colors[i % colors.length]}}>
            <p style={styles.cardText}>“{cap.content}”</p>
            
            <div style={styles.actionRow}>
              <button 
                onClick={() => handleVote(cap.id, 1)} 
                style={{
                  ...styles.voteBtn, 
                  backgroundColor: cap.userVote === 1 ? '#4ade80' : 'rgba(255,255,255,0.6)',
                  color: cap.userVote === 1 ? 'white' : '#1e293b',
                  boxShadow: cap.userVote === 1 ? '0 4px 12px rgba(74, 222, 128, 0.4)' : 'none'
                }}
              >
                🔥 Fire
              </button>
              
              <button 
                onClick={() => handleVote(cap.id, -1)} 
                style={{
                  ...styles.voteBtn, 
                  backgroundColor: cap.userVote === -1 ? '#f87171' : 'rgba(255,255,255,0.6)',
                  color: cap.userVote === -1 ? 'white' : '#1e293b',
                  boxShadow: cap.userVote === -1 ? '0 4px 12px rgba(248, 113, 113, 0.4)' : 'none'
                }}
              >
                🗑️ Trash
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#ffffff', padding: '0 20px 50px 20px', fontFamily: '-apple-system, sans-serif' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderBottom: '1px solid #f1f5f9' },
  logo: { fontSize: '24px', fontWeight: '900', color: '#6366f1' },
  userSection: { display: 'flex', alignItems: 'center', gap: '15px' },
  email: { fontSize: '13px', color: '#64748b', fontWeight: '600' },
  logout: { padding: '8px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
  header: { textAlign: 'center', margin: '50px 0' },
  title: { fontSize: '52px', fontWeight: '900', margin: '0 0 10px 0', letterSpacing: '-2px' },
  subtitle: { color: '#64748b', fontSize: '18px' },
  masonryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', maxWidth: '1100px', margin: '0 auto' },
  card: { padding: '30px', borderRadius: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '190px', boxShadow: '0 8px 20px -6px rgba(0,0,0,0.05)' },
  cardText: { fontSize: '20px', fontWeight: '800', color: '#1e293b', lineHeight: '1.3' },
  actionRow: { display: 'flex', gap: '10px' },
  voteBtn: { flex: 1, padding: '12px', borderRadius: '14px', border: 'none', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', color: '#6366f1' }
};