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

      // Fetch captions
      const { data: captionsData } = await supabase.from('captions').select('id, content').limit(30);
      
      if (captionsData) {
        // We also fetch the user's existing votes so the buttons stay highlighted on refresh
        const { data: existingVotes } = await supabase
          .from('caption_votes')
          .select('caption_id, vote')
          .eq('user_id', session.user.id);

        const formattedCaptions = captionsData.map(cap => {
          const pastVote = existingVotes?.find(v => v.caption_id === cap.id);
          return {
            ...cap,
            userVote: pastVote ? pastVote.vote : null
          };
        });

        setCaptions(formattedCaptions);
      }
      setLoading(false);
    };
    fetchSessionAndData();
  }, [router]);

  const handleVote = async (captionId, voteValue) => {
    if (!user) return alert("Please sign in first!");

    console.log("Attempting vote:", { captionId, userId: user.id, voteValue });

    const { error } = await supabase
      .from('caption_votes')
      .upsert({ 
        caption_id: captionId, 
        user_id: user.id, 
        vote: voteValue 
      });

    if (error) {
      // THIS WILL PRINT THE ACTUAL REASON IN YOUR CONSOLE (F12)
      console.error("FULL DATABASE ERROR:", error);
      alert(`Error: ${error.message}. Check the F12 console for the code.`);
    } else {
      setCaptions(prev => prev.map(c => 
        c.id === captionId ? { ...c, userVote: voteValue } : c
      ));
    }
  };

  if (loading) return <div style={styles.loader}>✨ Organizing the feed...</div>;

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
        <p style={styles.subtitle}>Rate the latest campus vibes. Your votes are saved to the database.</p>
      </header>

      <div style={styles.masonryGrid}>
        {captions.map((cap, i) => (
          <div 
            key={cap.id} 
            style={{...styles.card, backgroundColor: colors[i % colors.length]}}
          >
            <p style={styles.cardText}>“{cap.content}”</p>
            
            <div style={styles.actionRow}>
              <button 
                onClick={() => handleVote(cap.id, 1)} 
                style={{
                  ...styles.voteBtn, 
                  backgroundColor: cap.userVote === 1 ? '#4ade80' : 'rgba(255,255,255,0.6)',
                  color: cap.userVote === 1 ? 'white' : '#1e293b',
                  boxShadow: cap.userVote === 1 ? '0 4px 10px rgba(74, 222, 128, 0.4)' : 'none'
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
                  boxShadow: cap.userVote === -1 ? '0 4px 10px rgba(248, 113, 113, 0.4)' : 'none'
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
  page: { minHeight: '100vh', background: '#ffffff', padding: '0 20px 50px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderBottom: '1px solid #f1f5f9' },
  logo: { fontSize: '24px', fontWeight: '900', color: '#6366f1', letterSpacing: '-1px' },
  userSection: { display: 'flex', alignItems: 'center', gap: '15px' },
  email: { fontSize: '14px', color: '#64748b', fontWeight: '500' },
  logout: { padding: '8px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  header: { textAlign: 'center', margin: '60px 0' },
  title: { fontSize: '56px', fontWeight: '900', margin: '0 0 10px 0', letterSpacing: '-2px', color: '#0f172a' },
  subtitle: { color: '#64748b', fontSize: '19px', maxWidth: '600px', margin: '0 auto' },
  masonryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px', maxWidth: '1200px', margin: '0 auto' },
  card: { padding: '35px', borderRadius: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '200px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.03)' },
  cardText: { fontSize: '22px', fontWeight: '800', color: '#1e293b', lineHeight: '1.3', margin: '0 0 25px 0' },
  actionRow: { display: 'flex', gap: '12px' },
  voteBtn: { flex: 1, padding: '12px', borderRadius: '15px', border: 'none', fontWeight: '800', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s ease' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '600', color: '#6366f1' }
};