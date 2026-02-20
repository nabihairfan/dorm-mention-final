'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ConfessionsBoard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [myStats, setMyStats] = useState({ fire: 0, trash: 0 });
  const router = useRouter();

  const colors = ['#FFEDD5', '#DBEAFE', '#D1FAE5', '#FCE7F3', '#FEF3C7', '#EDE9FE'];
  const floatingEmojis = ['🍕', '🎸', '📚', '🦄', '⚡️', '🎈', '🍦', '👽'];

  const fetchEverything = async () => {
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
    setLoading(false);
  };

  useEffect(() => { fetchEverything(); }, [router]);

  const handleVote = async (captionId, voteValue) => {
    const currentCaption = captions.find(c => c.id === captionId);
    
    // TOGGLE LOGIC: If I click the same button again, DELETE the vote
    if (currentCaption.userVote === voteValue) {
      const { error } = await supabase
        .from('caption_votes')
        .delete()
        .eq('caption_id', captionId)
        .eq('profile_id', user.id);
      
      if (!error) fetchEverything(); // Refresh to show it's gone
      return;
    }

    // UPSERT LOGIC: Otherwise, save/change vote
    const { error } = await supabase
      .from('caption_votes')
      .upsert({ 
        caption_id: captionId, 
        profile_id: user.id, 
        vote_value: voteValue,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });

    if (!error) fetchEverything();
  };

  const resetAllVotes = async () => {
    if (confirm("🚨 BOOM! Delete all your votes and start fresh?")) {
      const { error } = await supabase.from('caption_votes').delete().eq('profile_id', user.id);
      if (!error) fetchEverything();
    }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading Vibes...</div>;

  return (
    <div style={styles.page}>
      {/* 🎈 FLOATING DECOR */}
      {floatingEmojis.map((emoji, i) => (
        <div key={i} style={{...styles.floating, left: `${i * 12}%`, animationDelay: `${i * 0.5}s`}}>{emoji}</div>
      ))}

      {/* 🏆 THE SCOREBOARD & RESET */}
      <div style={styles.controlCenter}>
        <div style={styles.scoreboard}>
          <div style={styles.scoreItem}>🔥 {myStats.fire}</div>
          <div style={styles.scoreItem}>🗑️ {myStats.trash}</div>
        </div>
        <button onClick={resetAllVotes} style={styles.resetBtn}>☢️ RESET VIBES</button>
      </div>

      <nav style={styles.nav}>
        <h1 style={styles.logo}>DormPulse.</h1>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={styles.logout}>Logout</button>
      </nav>

      <header style={styles.header}>
        <h2 style={styles.title}>The Social Wall</h2>
        <p style={styles.subtitle}>Click twice to un-vote. Everything is saved live!</p>
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

      <style jsx>{`
        @keyframes float { 0% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-20px) rotate(10deg); } 100% { transform: translateY(0px) rotate(0deg); } }
        .fun-card { transition: all 0.2s ease; }
        .fun-card:hover { transform: translateY(-10px) rotate(${i % 2 === 0 ? '2' : '-2'}deg); z-index: 10; }
        .fun-card:active { transform: scale(0.95); }
      `}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#FFFAFF', padding: '20px', fontFamily: '"Jua", sans-serif', overflowX: 'hidden', position: 'relative' },
  floating: { position: 'fixed', top: '20%', fontSize: '40px', opacity: 0.15, zIndex: 0, animation: 'float 4s infinite ease-in-out' },
  controlCenter: { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', zIndex: 100 },
  scoreboard: { background: '#000', color: '#fff', padding: '10px 30px', borderRadius: '50px', display: 'flex', gap: '30px', boxShadow: '0 10px 0 #6366f1' },
  resetBtn: { background: '#ff4757', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '10px', boxShadow: '0 4px 0 #8b0000' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 },
  logo: { fontSize: '32px', fontWeight: '900', fontStyle: 'italic', color: '#000' },
  logout: { background: '#000', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer' },
  header: { textAlign: 'center', margin: '40px 0', position: 'relative', zIndex: 10 },
  title: { fontSize: '70px', fontWeight: '900', margin: '0', textShadow: '4px 4px 0px #6366f1' },
  subtitle: { fontSize: '20px', fontWeight: '600' },
  masonryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 10 },
  card: { padding: '30px', borderRadius: '30px', border: '4px solid #000', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '10px 10px 0px #000' },
  cardText: { fontSize: '22px', fontWeight: '900' },
  voteContainer: { display: 'flex', gap: '10px' },
  voteBtn: { flex: 1, padding: '15px', borderRadius: '20px', background: 'white', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', fontWeight: 'bold' }
};