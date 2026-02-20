'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ConfessionsBoard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [myStats, setMyStats] = useState({ fire: 0, trash: 0 });
  const [vibeEffect, setVibeEffect] = useState(null); 
  const [showStats, setShowStats] = useState({}); // Track visibility per card
  const router = useRouter();

  const colors = ['#FFEDD5', '#DBEAFE', '#D1FAE5', '#FCE7F3', '#FEF3C7', '#EDE9FE'];

  const fetchEverything = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data: captionsData } = await supabase.from('captions').select('id, content').limit(25);
      const { data: allVotes } = await supabase.from('caption_votes').select('caption_id, vote_value');
      const { data: myVotes } = await supabase.from('caption_votes').select('caption_id, vote_value').eq('profile_id', session.user.id);

      if (captionsData) {
        const formatted = captionsData.map(cap => {
          const myVoteEntry = myVotes?.find(v => v.caption_id === cap.id);
          const globalFire = allVotes?.filter(v => v.caption_id === cap.id && v.vote_value === 1).length || 0;
          const globalTrash = allVotes?.filter(v => v.caption_id === cap.id && v.vote_value === -1).length || 0;
          return { 
            ...cap, 
            userVote: myVoteEntry ? myVoteEntry.vote_value : null, 
            globalFire, 
            globalTrash 
          };
        });
        setCaptions(formatted);
        setMyStats({
          fire: myVotes?.filter(v => v.vote_value === 1).length || 0,
          trash: myVotes?.filter(v => v.vote_value === -1).length || 0
        });
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchEverything(); }, [fetchEverything]);

  const handleVote = async (captionId, voteValue) => {
    if (!user) return;
    const currentCaption = captions.find(c => c.id === captionId);
    
    if (currentCaption?.userVote === voteValue) {
      await supabase.from('caption_votes').delete().eq('caption_id', captionId).eq('profile_id', user.id);
      fetchEverything();
      return;
    }

    setVibeEffect(voteValue === 1 ? 'fire' : 'trash');
    setTimeout(() => setVibeEffect(null), 1200);

    const { error } = await supabase.from('caption_votes').upsert({ 
      caption_id: captionId, 
      profile_id: user.id, 
      vote_value: voteValue,
      created_datetime_utc: new Date().toISOString()
    }, { onConflict: 'caption_id, profile_id' });

    if (!error) fetchEverything();
  };

  const toggleStats = (id) => {
    setShowStats(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const resetAllVotes = async () => {
    if (typeof window !== "undefined" && window.confirm("🚨 Wipe your vibe history?")) {
      await supabase.from('caption_votes').delete().eq('profile_id', user.id);
      fetchEverything();
    }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading Vibes...</div>;

  return (
    <div style={styles.page}>
      {vibeEffect === 'fire' && <div style={styles.effectOverlay}>🎉✨🎊</div>}
      {vibeEffect === 'trash' && <div style={styles.effectOverlay}>☹️😭💔</div>}

      <div style={styles.controlCenter}>
        <div style={styles.scoreboard}>
          <div style={styles.scoreItem}>🔥 {myStats.fire}</div>
          <div style={styles.scoreItem}>🗑️ {myStats.trash}</div>
        </div>
        <button onClick={resetAllVotes} style={styles.resetBtn}>RESET ALL</button>
      </div>

      <nav style={styles.nav}>
        <h1 style={styles.logo}>DormPulse.</h1>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={styles.logout}>Logout</button>
      </nav>

      <header style={styles.header}>
        <h2 style={styles.title}>The Social Wall</h2>
        <p style={styles.subtitle}>Vote privately or peek at the stats. Double-tap to undo!</p>
      </header>

      <div style={styles.masonryGrid}>
        {captions.map((cap, i) => (
          <div key={cap.id} style={{...styles.card, backgroundColor: colors[i % colors.length]}}>
            <div>
              <p style={styles.cardText}>“{cap.content}”</p>
              
              {/* Stats Section: Separate from voting */}
              <div style={styles.statsContainer}>
                <button onClick={() => toggleStats(cap.id)} style={styles.statsToggle}>
                  {showStats[cap.id] ? '🙈 Hide Stats' : '📊 Show Results'}
                </button>
                {showStats[cap.id] && (
                  <div style={styles.statsRow}>
                    <span style={styles.statChip}>🔥 {cap.globalFire}</span>
                    <span style={styles.statChip}>🗑️ {cap.globalTrash}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={styles.voteContainer}>
              <button 
                onClick={() => handleVote(cap.id, 1)} 
                style={{...styles.voteBtn, border: cap.userVote === 1 ? '6px solid #4ade80' : '3px solid #000'}}
              >
                🔥 Fire
              </button>
              <button 
                onClick={() => handleVote(cap.id, -1)} 
                style={{...styles.voteBtn, border: cap.userVote === -1 ? '6px solid #f87171' : '3px solid #000'}}
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
  page: { minHeight: '100vh', background: '#FFF', padding: '20px', fontFamily: 'system-ui, sans-serif', overflowX: 'hidden' },
  effectOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '100px', pointerEvents: 'none', zIndex: 1000 },
  controlCenter: { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', zIndex: 100 },
  scoreboard: { background: '#000', color: '#fff', padding: '12px 35px', borderRadius: '50px', display: 'flex', gap: '30px', boxShadow: '0 8px 0 #6366f1' },
  scoreItem: { fontSize: '24px', fontWeight: '900' },
  resetBtn: { background: '#ff4757', color: 'white', border: '2px solid #000', padding: '5px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: '32px', fontWeight: '900', color: '#000' },
  logout: { background: '#000', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' },
  header: { textAlign: 'center', margin: '40px 0' },
  title: { fontSize: 'clamp(40px, 10vw, 70px)', fontWeight: '900', margin: '0', textShadow: '4px 4px 0px #6366f1' },
  subtitle: { fontSize: '18px', fontWeight: 'bold', color: '#666' },
  masonryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px', maxWidth: '1200px', margin: '0 auto' },
  card: { padding: '25px', borderRadius: '30px', border: '4px solid #000', minHeight: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '8px 8px 0px #000' },
  cardText: { fontSize: '20px', fontWeight: '900', marginBottom: '10px' },
  statsContainer: { marginBottom: '15px' },
  statsToggle: { background: 'transparent', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', fontWeight: '700', padding: 0 },
  statsRow: { marginTop: '8px', display: 'flex', gap: '10px' },
  statChip: { background: 'white', border: '2px solid #000', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' },
  voteContainer: { display: 'flex', gap: '10px' },
  voteBtn: { flex: 1, padding: '12px', borderRadius: '15px', background: 'white', fontWeight: '900', fontSize: '16px', cursor: 'pointer' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontWeight: '900' }
};