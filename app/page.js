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

  // Brighter, punchier colors for the cards
  const colors = ['#FF9AA2', '#C7CEEA', '#BFFCC6', '#FFFFD1', '#FFDAC1', '#E2F0CB'];

  const fetchEverything = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

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
          return { ...cap, userVote: myVoteEntry ? myVoteEntry.vote_value : null, globalFire, globalTrash };
        });
        setCaptions(formatted);
        setMyStats({
          fire: myVotes?.filter(v => v.vote_value === 1).length || 0,
          trash: myVotes?.filter(v => v.vote_value === -1).length || 0
        });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchEverything(); }, [fetchEverything]);

  const handleVote = async (captionId, voteValue) => {
    if (!user) return;
    const currentCard = captions.find(c => c.id === captionId);
    const isRemoving = currentCard?.userVote === voteValue;

    setCaptions(prev => prev.map(c => {
      if (c.id === captionId) {
        let newFire = c.globalFire;
        let newTrash = c.globalTrash;
        if (isRemoving) {
          voteValue === 1 ? newFire = Math.max(0, newFire - 1) : newTrash = Math.max(0, newTrash - 1);
        } else {
          if (c.userVote === 1) newFire = Math.max(0, newFire - 1);
          if (c.userVote === -1) newTrash = Math.max(0, newTrash - 1);
          voteValue === 1 ? newFire++ : newTrash++;
        }
        return { ...c, userVote: isRemoving ? null : voteValue, globalFire: newFire, globalTrash: newTrash };
      }
      return c;
    }));

    if (isRemoving) {
      await supabase.from('caption_votes').delete().eq('caption_id', captionId).eq('profile_id', user.id);
    } else {
      setVibeEffect(voteValue === 1 ? 'fire' : 'trash');
      setTimeout(() => setVibeEffect(null), 800);
      await supabase.from('caption_votes').upsert({ 
        caption_id: captionId, profile_id: user.id, vote_value: voteValue, created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });
    }
  };

  if (loading) return <div style={styles.loader}>🌈 Brewing the tea...</div>;

  return (
    <div style={styles.page}>
      {/* Import Fun Font */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Poppins:wght@400;900&display=swap');
      `}} />

      {vibeEffect === 'fire' && <div style={styles.effectOverlay}>🎉✨🎊</div>}
      {vibeEffect === 'trash' && <div style={styles.effectOverlay}>☹️😭💔</div>}

      <div style={styles.controlCenter}>
        <div style={styles.scoreboard}>
          <div style={styles.scoreItem}>🔥 {myStats.fire}</div>
          <div style={styles.scoreItem}>🗑️ {myStats.trash}</div>
        </div>
        <button onClick={() => window.confirm("Nuke everything?") && supabase.from('caption_votes').delete().eq('profile_id', user.id).then(fetchEverything)} style={styles.resetBtn}>RESTART VIBES</button>
      </div>

      <nav style={styles.nav}>
        <h1 style={styles.logo}>DormPulse.</h1>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={styles.logout}>BYE BYE 👋</button>
      </nav>

      <header style={styles.header}>
        <h2 style={styles.title}>The Social Wall</h2>
        <p style={styles.subtitle}>Spill the tea, rate the memes, and don't get caught! ☕️💅</p>
      </header>

      <div style={styles.grid}>
        {captions.map((cap, i) => (
          <div key={cap.id} style={{...styles.card, backgroundColor: colors[i % colors.length]}}>
            <p style={styles.cardText}>“{cap.content}”</p>
            
            <div style={styles.statsArea}>
              <button onClick={() => setShowStats(p => ({...p, [cap.id]: !p[cap.id]}))} style={styles.statsToggle}>
                {showStats[cap.id] ? '🙈 HIDE TEA' : '📊 PEEK AT STATS'}
              </button>
              {showStats[cap.id] && (
                <div style={styles.statsRow}>
                  <span style={styles.statChip}>🔥 {cap.globalFire}</span>
                  <span style={styles.statChip}>🗑️ {cap.globalTrash}</span>
                </div>
              )}
            </div>

            <div style={styles.voteRow}>
              <button onClick={() => handleVote(cap.id, 1)} style={{...styles.voteBtn, backgroundColor: cap.userVote === 1 ? '#4ade80' : '#FFF'}}>
                {cap.userVote === 1 ? '🔥 SLAY' : '🔥 FIRE'}
              </button>
              <button onClick={() => handleVote(cap.id, -1)} style={{...styles.voteBtn, backgroundColor: cap.userVote === -1 ? '#ff4757' : '#FFF'}}>
                {cap.userVote === -1 ? '🗑️ EW' : '🗑️ TRASH'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { 
    minHeight: '100vh', 
    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', 
    padding: '20px', 
    fontFamily: "'Poppins', sans-serif" 
  },
  effectOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '100px', pointerEvents: 'none', zIndex: 1000 },
  controlCenter: { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', zIndex: 100 },
  scoreboard: { background: '#000', color: '#fff', padding: '12px 35px', borderRadius: '50px', display: 'flex', gap: '30px', border: '4px solid #FF00E4', boxShadow: '0 0 15px #FF00E4' },
  scoreItem: { fontSize: '28px', fontFamily: "'Luckiest Guy', cursive" },
  resetBtn: { background: '#000', color: '#fff', border: '2px solid #fff', padding: '5px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: '40px', fontFamily: "'Luckiest Guy', cursive", color: '#000', textShadow: '2px 2px #FF00E4' },
  logout: { background: '#000', color: '#fff', padding: '10px 20px', borderRadius: '50px', fontWeight: '900', border: '2px solid #000', cursor: 'pointer' },
  header: { textAlign: 'center', margin: '40px 0' },
  title: { fontSize: 'clamp(40px, 10vw, 80px)', fontFamily: "'Luckiest Guy', cursive", color: '#000', WebkitTextStroke: '2px #fff', textShadow: '5px 5px 0px #FF00E4' },
  subtitle: { fontSize: '22px', fontWeight: '900', color: '#333', fontStyle: 'italic' },
  grid: { display: 'flex', flexWrap: 'wrap', gap: '25px', justifyContent: 'center', paddingBottom: '150px' },
  card: { width: '320px', padding: '30px', borderRadius: '40px', border: '5px solid #000', minHeight: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '12px 12px 0px #000' },
  cardText: { fontSize: '24px', fontWeight: '900', color: '#000', lineHeight: '1.1' },
  statsArea: { margin: '15px 0' },
  statsToggle: { background: '#000', color: '#fff', border: 'none', borderRadius: '10px', padding: '5px 10px', fontWeight: '900', cursor: 'pointer', fontSize: '12px' },
  statsRow: { marginTop: '10px', display: 'flex', gap: '10px' },
  statChip: { background: '#FFF', border: '3px solid #000', padding: '5px 12px', borderRadius: '15px', fontSize: '14px', fontWeight: '900' },
  voteRow: { display: 'flex', gap: '10px' },
  voteBtn: { flex: 1, padding: '15px', borderRadius: '25px', fontWeight: '900', fontSize: '16px', border: '4px solid #000', cursor: 'pointer', fontFamily: "'Luckiest Guy', cursive" },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', fontFamily: "'Luckiest Guy', cursive" }
};