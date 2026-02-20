'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ConfessionsBoard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [myStats, setMyStats] = useState({ fire: 0, trash: 0 });
  const [vibeEffect, setVibeEffect] = useState(null); // 'fire' or 'trash'
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
          return { ...cap, userVote: myVoteEntry ? myVoteEntry.vote_value : null, globalFire, globalTrash };
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

  const triggerEffect = (type) => {
    setVibeEffect(type);
    setTimeout(() => setVibeEffect(null), 2000); // Effect lasts 2 seconds
  };

  const handleVote = async (captionId, voteValue) => {
    if (!user) return;
    const currentCaption = captions.find(c => c.id === captionId);
    
    // Toggle off
    if (currentCaption?.userVote === voteValue) {
      await supabase.from('caption_votes').delete().eq('caption_id', captionId).eq('profile_id', user.id);
      fetchEverything();
      return;
    }

    // Trigger Fun Effects
    triggerEffect(voteValue === 1 ? 'fire' : 'trash');

    const { error } = await supabase.from('caption_votes').upsert({ 
      caption_id: captionId, 
      profile_id: user.id, 
      vote_value: voteValue,
      created_datetime_utc: new Date().toISOString()
    }, { onConflict: 'caption_id, profile_id' });

    if (!error) fetchEverything();
  };

  const resetAllVotes = async () => {
    if (confirm("🚨 Wipe your vibe history?")) {
      await supabase.from('caption_votes').delete().eq('profile_id', user.id);
      fetchEverything();
    }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading Vibes...</div>;

  return (
    <div style={styles.page}>
      {/* 🎉 CONFETTI / SAD RAIN LAYER */}
      {vibeEffect === 'fire' && <div className="effect-layer">🎉✨🎊🔥🥳✨🎊</div>}
      {vibeEffect === 'trash' && <div className="effect-layer">☹️😭💔🌧️📉☹️</div>}

      <div style={styles.controlCenter}>
        <div style={styles.scoreboard}>
          <div style={styles.scoreItem}>🔥 {myStats.fire} <span style={styles.subText}>GEMS</span></div>
          <div style={styles.scoreItem}>🗑️ {myStats.trash} <span style={styles.subText}>TRASH</span></div>
        </div>
        <button onClick={resetAllVotes} style={styles.resetBtn}>RESET MY VIBES</button>
      </div>

      <nav style={styles.nav}>
        <h1 style={styles.logo}>DormPulse.</h1>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={styles.logout}>Logout</button>
      </nav>

      <header style={styles.header}>
        <h2 style={styles.title}>The Social Wall</h2>
        <p style={styles.subtitle}>Fire the gems, trash the rest. Double click to undo! ⚡️</p>
      </header>

      <div style={styles.masonryGrid}>
        {captions.map((cap, i) => (
          <div key={cap.id} className="fun-card" style={{...styles.card, backgroundColor: colors[i % colors.length]}}>
            <p style={styles.cardText}>“{cap.content}”</p>
            <div style={styles.voteContainer}>
              <button onClick={() => handleVote(cap.id, 1)} style={{...styles.voteBtn, border: cap.userVote === 1 ? '5px solid #4ade80' : '3px solid #000'}}>🔥 {cap.globalFire}</button>
              <button onClick={() => handleVote(cap.id, -1)} style={{...styles.voteBtn, border: cap.userVote === -1 ? '5px solid #f87171' : '3px solid #000'}}>🗑️ {cap.globalTrash}</button>
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes rain {
          0% { transform: translateY(-100vh); opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        .effect-layer {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          display: flex; justify-content: space-around; font-size: 50px;
          pointer-events: none; z-index: 9999; animation: rain 2s linear;
        }
        .fun-card { transition: transform 0.2s ease; cursor: pointer; }
        .fun-card:hover { transform: translateY(-8px); box-shadow: 12px 12px 0px #000 !important; }
        .fun-card:active { transform: scale(0.9); }
      `}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#FFF', padding: '20px', fontFamily: 'sans-serif', overflowX: 'hidden' },
  controlCenter: { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', zIndex: 100 },
  scoreboard: { background: '#000', color: '#fff', padding: '12px 35px', borderRadius: '50px', display: 'flex', gap: '30px', boxShadow: '0 8px 0 #6366f1', border: '2px solid white' },
  scoreItem: { fontSize: '22px', fontWeight: '900', textAlign: 'center' },
  subText: { fontSize: '10px', display: 'block', opacity: 0.7 },
  resetBtn: { background: '#ff4757', color: 'white', border: '2px solid #000', padding: '5px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '10px' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: '32px', fontWeight: '900', color: '#000', letterSpacing: '-2px' },
  logout: { background: '#000', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' },
  header: { textAlign: 'center', margin: '40px 0' },
  title: { fontSize: 'clamp(45px, 10vw, 80px)', fontWeight: '900', margin: '0', letterSpacing: '-4px', textShadow: '4px 4px 0px #6366f1' },
  subtitle: { fontSize: '20px', fontWeight: 'bold', color: '#666' },
  masonryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px', maxWidth: '1200px', margin: '0 auto' },
  card: { padding: '30px', borderRadius: '35px', border: '4px solid #000', minHeight: '210px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '10px 10px 0px #000' },
  cardText: { fontSize: '22px', fontWeight: '900', color: '#000' },
  voteContainer: { display: 'flex', gap: '10px', marginTop: '15px' },
  voteBtn: { flex: 1, padding: '15px', borderRadius: '20px', background: 'white', fontWeight: '900', fontSize: '18px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', transition: '0.1s' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '900' }
};