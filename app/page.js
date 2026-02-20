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
  const [showStats, setShowStats] = useState({}); 
  const router = useRouter();

  const colors = ['#FFEDD5', '#DBEAFE', '#D1FAE5', '#FCE7F3', '#FEF3C7', '#EDE9FE'];

  const fetchEverything = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // Fetch captions in a STRICT order (by ID) so they never move
      const { data: captionsData } = await supabase
        .from('captions')
        .select('id, content')
        .order('id', { ascending: true });

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

    const currentCard = captions.find(c => c.id === captionId);
    const isRemoving = currentCard?.userVote === voteValue;

    // --- INSTANT UI UPDATE (Community Stats Logic) ---
    setCaptions(prev => prev.map(c => {
      if (c.id === captionId) {
        let newFire = c.globalFire;
        let newTrash = c.globalTrash;

        if (isRemoving) {
          // Subtracting vote: Math.max(0, ...) ensures we never go below zero
          voteValue === 1 ? newFire = Math.max(0, newFire - 1) : newTrash = Math.max(0, newTrash - 1);
        } else {
          // If switching sides, remove the old vote first
          if (c.userVote === 1) newFire = Math.max(0, newFire - 1);
          if (c.userVote === -1) newTrash = Math.max(0, newTrash - 1);
          
          // Add the new vote
          voteValue === 1 ? newFire++ : newTrash++;
        }

        return { ...c, userVote: isRemoving ? null : voteValue, globalFire: newFire, globalTrash: newTrash };
      }
      return c;
    }));

    // --- DATABASE UPDATE ---
    if (isRemoving) {
      await supabase.from('caption_votes').delete().eq('caption_id', captionId).eq('profile_id', user.id);
    } else {
      setVibeEffect(voteValue === 1 ? 'fire' : 'trash');
      setTimeout(() => setVibeEffect(null), 800);
      await supabase.from('caption_votes').upsert({ 
        caption_id: captionId, 
        profile_id: user.id, 
        vote_value: voteValue,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });
    }

    // Update the local scoreboard stats
    const { data: myNewVotes } = await supabase.from('caption_votes').select('vote_value').eq('profile_id', user.id);
    setMyStats({
      fire: myNewVotes?.filter(v => v.vote_value === 1).length || 0,
      trash: myNewVotes?.filter(v => v.vote_value === -1).length || 0
    });
  };

  const resetAllVotes = async () => {
    if (typeof window !== "undefined" && window.confirm("☢️ Reset all your votes? This is permanent!")) {
      const { error } = await supabase.from('caption_votes').delete().eq('profile_id', user.id);
      if (!error) await fetchEverything();
    }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading Vibes...</div>;

  return (
    <div style={styles.page}>
      {/* Vibe Overlays */}
      {vibeEffect === 'fire' && <div style={styles.effectOverlay}>🎉✨🎊</div>}
      {vibeEffect === 'trash' && <div style={styles.effectOverlay}>☹️😭💔</div>}

      <div style={styles.controlCenter}>
        <div style={styles.scoreboard}>
          <div style={styles.scoreItem}>🔥 {myStats.fire} <span style={styles.miniLabel}>GEMS</span></div>
          <div style={styles.scoreItem}>🗑️ {myStats.trash} <span style={styles.miniLabel}>TRASH</span></div>
        </div>
        <button onClick={resetAllVotes} style={styles.resetBtn}>☢️ RESET ALL VOTES</button>
      </div>

      <nav style={styles.nav}>
        <h1 style={styles.logo}>DormPulse.</h1>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={styles.logout}>Logout</button>
      </nav>

      <header style={styles.header}>
        <h2 style={styles.title}>The Social Wall</h2>
        <p style={styles.subtitle}>Community stats update instantly. Click again to undo.</p>
      </header>

      {/* Grid uses Flexbox to keep cards in a fixed order */}
      <div style={styles.grid}>
        {captions.map((cap, i) => (
          <div key={cap.id} style={{...styles.card, backgroundColor: colors[i % colors.length]}}>
            <p style={styles.cardText}>“{cap.content}”</p>
            
            <div style={styles.statsArea}>
              <button onClick={() => setShowStats(p => ({...p, [cap.id]: !p[cap.id]}))} style={styles.statsToggle}>
                {showStats[cap.id] ? '🙈 Hide Stats' : '📊 Show Community Results'}
              </button>
              {showStats[cap.id] && (
                <div style={styles.statsRow}>
                  <span style={styles.statChip}>🔥 Total: {cap.globalFire}</span>
                  <span style={styles.statChip}>🗑️ Total: {cap.globalTrash}</span>
                </div>
              )}
            </div>

            <div style={styles.voteRow}>
              <button 
                onClick={() => handleVote(cap.id, 1)} 
                style={{
                  ...styles.voteBtn, 
                  backgroundColor: cap.userVote === 1 ? '#4ade80' : '#FFF',
                  color: cap.userVote === 1 ? '#FFF' : '#000'
                }}
              >
                {cap.userVote === 1 ? '🔥 FIRE | +1' : '🔥 FIRE'}
              </button>
              <button 
                onClick={() => handleVote(cap.id, -1)} 
                style={{
                  ...styles.voteBtn, 
                  backgroundColor: cap.userVote === -1 ? '#f87171' : '#FFF',
                  color: cap.userVote === -1 ? '#FFF' : '#000'
                }}
              >
                {cap.userVote === -1 ? '🗑️ TRASH | -1' : '🗑️ TRASH'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#FFF', padding: '20px', fontFamily: 'sans-serif' },
  effectOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '100px', pointerEvents: 'none', zIndex: 1000 },
  controlCenter: { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', zIndex: 100 },
  scoreboard: { background: '#000', color: '#fff', padding: '12px 35px', borderRadius: '50px', display: 'flex', gap: '30px', border: '3px solid #6366f1' },
  scoreItem: { fontSize: '24px', fontWeight: '900', textAlign: 'center' },
  miniLabel: { fontSize: '10px', display: 'block', opacity: 0.6 },
  resetBtn: { background: '#ff4757', color: 'white', border: '2px solid #000', padding: '6px 15px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
  logo: { fontSize: '32px', fontWeight: '900', color: '#000' },
  logout: { background: '#000', color: '#fff', padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
  header: { textAlign: 'center', margin: '20px 0 40px 0' },
  title: { fontSize: 'clamp(32px, 8vw, 60px)', fontWeight: '900' },
  subtitle: { fontSize: '16px', color: '#555' },
  grid: { display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', maxWidth: '1200px', margin: '0 auto', paddingBottom: '140px' },
  card: { width: '320px', padding: '25px', borderRadius: '25px', border: '4px solid #000', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '8px 8px 0px #000' },
  cardText: { fontSize: '20px', fontWeight: '900' },
  statsArea: { margin: '15px 0' },
  statsToggle: { background: 'none', border: 'none', textDecoration: 'underline', fontWeight: '700', cursor: 'pointer', fontSize: '12px', padding: 0 },
  statsRow: { marginTop: '10px', display: 'flex', gap: '8px' },
  statChip: { background: '#FFF', border: '2px solid #000', padding: '3px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' },
  voteRow: { display: 'flex', gap: '10px' },
  voteBtn: { flex: 1, padding: '12px', borderRadius: '15px', fontWeight: '900', fontSize: '13px', cursor: 'pointer', border: '3px solid #000' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontWeight: '900' }
};