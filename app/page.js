'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ConfessionsBoard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const router = useRouter();

  // Helper to pick a random soft color for each card
  const colors = ['#FFEDD5', '#DBEAFE', '#D1FAE5', '#FCE7F3', '#FEF3C7', '#EDE9FE'];

  useEffect(() => {
    const fetchSessionAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data } = await supabase.from('captions').select('id, content').limit(20);
      if (data) setCaptions(data);
      setLoading(false);
    };
    fetchSessionAndData();
  }, [router]);

  const handleVote = async (captionId, voteValue) => {
    const { error } = await supabase.from('caption_votes').insert([
      { caption_id: captionId, vote: voteValue, user_id: user.id }
    ]);

    if (error) {
      alert("Oops! Couldn't save that vote.");
    } else {
      // Visual feedback: remove the card or show a toast
      setCaptions(prev => prev.filter(c => c.id !== captionId));
    }
  };

  if (loading) return <div style={styles.loader}>✨ Polishing the board...</div>;

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
        <h2 style={styles.title}>Campus Confessions</h2>
        <p style={styles.subtitle}>Upvote the vibes, downvote the lies. Click a card to vote!</p>
      </header>

      <div style={styles.masonryGrid}>
        {captions.map((cap, i) => (
          <div 
            key={cap.id} 
            style={{...styles.card, backgroundColor: colors[i % colors.length]}}
          >
            <p style={styles.cardText}>“{cap.content}”</p>
            <div style={styles.actionRow}>
              <button onClick={() => handleVote(cap.id, 1)} style={styles.voteBtn}>🔥 Fire</button>
              <button onClick={() => handleVote(cap.id, -1)} style={styles.voteBtn}>🗑️ Trash</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#ffffff', padding: '0 20px 50px 20px', fontFamily: '"Segoe UI", Roboto, sans-serif' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderBottom: '1px solid #eee' },
  logo: { fontSize: '24px', fontWeight: '900', color: '#6366f1' },
  userSection: { display: 'flex', alignItems: 'center', gap: '15px' },
  email: { fontSize: '14px', color: '#666', fontWeight: '500' },
  logout: { padding: '8px 15px', borderRadius: '10px', border: '1px solid #ddd', background: 'none', cursor: 'pointer' },
  header: { textAlign: 'center', margin: '60px 0' },
  title: { fontSize: '48px', fontWeight: '900', margin: '0 0 10px 0', letterSpacing: '-1px' },
  subtitle: { color: '#94a3b8', fontSize: '18px' },
  masonryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px', maxWidth: '1200px', margin: '0 auto' },
  card: { padding: '30px', borderRadius: '25px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '180px', transition: 'transform 0.3s ease', cursor: 'default', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' },
  cardText: { fontSize: '20px', fontWeight: '700', color: '#1e293b', lineHeight: '1.4', margin: '0 0 20px 0' },
  actionRow: { display: 'flex', gap: '10px' },
  voteBtn: { flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,0.5)', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', transition: '0.2s' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }
};