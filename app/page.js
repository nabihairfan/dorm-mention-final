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
        // Fetch existing votes to show what the user previously picked
        const { data: existingVotes } = await supabase
          .from('caption_votes')
          .select('caption_id, vote')
          .eq('profile_id', session.user.id);

        const formattedCaptions = captionsData.map(cap => {
          const pastVote = existingVotes?.find(v => v.caption_id === cap.id);
          return {
            ...cap,
            userVote: pastVote ? pastVote.vote : null // This will be 1, -1, or null
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

    // DATA MUTATION: This sends exactly 1 or -1 to the 'vote' column
    const { error } = await supabase
      .from('caption_votes')
      .upsert(
        { 
          caption_id: captionId, 
          profile_id: user.id, 
          vote: voteValue // value is passed as 1 or -1
        }, 
        { onConflict: 'caption_id, profile_id' }
      );

    if (error) {
      console.error("Mutation failed:", error.message);
      alert(`Database Error: ${error.message}`);
    } else {
      // Immediate UI update
      setCaptions(prev => prev.map(c => 
        c.id === captionId ? { ...c, userVote: voteValue } : c
      ));
    }
  };

  if (loading) return <div style={styles.loader}>✨ Syncing your feed...</div>;

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
        <p style={styles.subtitle}>Click to rate. Values stored: Fire (1) | Trash (-1)</p>
      </header>

      <div style={styles.masonryGrid}>
        {captions.map((cap, i) => (
          <div key={cap.id} style={{...styles.card, backgroundColor: colors[i % colors.length]}}>
            <p style={styles.cardText}>“{cap.content}”</p>
            
            <div style={styles.actionRow}>
              {/* VOTE VALUE: 1 */}
              <button 
                onClick={() => handleVote(cap.id, 1)} 
                style={{
                  ...styles.voteBtn, 
                  backgroundColor: cap.userVote === 1 ? '#4ade80' : 'rgba(255,255,255,0.6)',
                  color: cap.userVote === 1 ? 'white' : '#1e293b',
                  fontWeight: 'bold'
                }}
              >
                🔥 Fire
              </button>
              
              {/* VOTE VALUE: -1 */}
              <button 
                onClick={() => handleVote(cap.id, -1)} 
                style={{
                  ...styles.voteBtn, 
                  backgroundColor: cap.userVote === -1 ? '#f87171' : 'rgba(255,255,255,0.6)',
                  color: cap.userVote === -1 ? 'white' : '#1e293b',
                  fontWeight: 'bold'
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
  page: { minHeight: '100vh', background: '#ffffff', padding: '0 20px 50px 20px', fontFamily: 'sans-serif' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderBottom: '1px solid #f1f5f9' },
  logo: { fontSize: '24px', fontWeight: '900', color: '#6366f1' },
  userSection: { display: 'flex', alignItems: 'center', gap: '15px' },
  email: { fontSize: '13px', color: '#64748b' },
  logout: { padding: '8px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' },
  header: { textAlign: 'center', margin: '50px 0' },
  title: { fontSize: '52px', fontWeight: '900', margin: '0' },
  subtitle: { color: '#64748b', fontSize: '18px' },
  masonryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', maxWidth: '1100px', margin: '0 auto' },
  card: { padding: '30px', borderRadius: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '190px' },
  cardText: { fontSize: '20px', fontWeight: '800', color: '#1e293b' },
  actionRow: { display: 'flex', gap: '10px' },
  voteBtn: { flex: 1, padding: '12px', borderRadius: '14px', border: 'none', cursor: 'pointer', transition: '0.2s' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }
};