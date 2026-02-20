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

  useEffect(() => {
    const fetchEverything = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // 1. Fetch All Captions
      const { data: captionsData } = await supabase.from('captions').select('id, content').limit(20);
      
      // 2. Fetch Global Vote Counts (Summed up for everyone)
      const { data: allVotes } = await supabase.from('caption_votes').select('caption_id, vote_value');

      // 3. Fetch My Votes (To highlight buttons)
      const { data: myVotes } = await supabase
        .from('caption_votes')
        .select('caption_id, vote_value')
        .eq('profile_id', session.user.id);

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
        
        // Update the Scoreboard
        setMyStats({
          fire: myVotes?.filter(v => v.vote_value === 1).length || 0,
          trash: myVotes?.filter(v => v.vote_value === -1).length || 0
        });
      }
      setLoading(false);
    };
    fetchEverything();
  }, [router]);

  const handleVote = async (captionId, voteValue) => {
    if (!user) return;

    const { error } = await supabase
      .from('caption_votes')
      .upsert({ 
        caption_id: captionId, 
        profile_id: user.id, 
        vote_value: voteValue,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });

    if (!error) {
      // Update UI state immediately
      setCaptions(prev => prev.map(c => {
        if (c.id === captionId) {
          // If user is switching votes, adjust global counts
          const oldVote = c.userVote;
          return { 
            ...c, 
            userVote: voteValue,
            globalFire: voteValue === 1 && oldVote !== 1 ? c.globalFire + 1 : (oldVote === 1 && voteValue !== 1 ? c.globalFire - 1 : c.globalFire),
            globalTrash: voteValue === -1 && oldVote !== -1 ? c.globalTrash + 1 : (oldVote === -1 && voteValue !== -1 ? c.globalTrash - 1 : c.globalTrash)
          };
        }
        return c;
      }));

      // Recalculate personal scoreboard
      const { data: myNewVotes } = await supabase.from('caption_votes').select('vote_value').eq('profile_id', user.id);
      setMyStats({
        fire: myNewVotes?.filter(v => v.vote_value === 1).length || 0,
        trash: myNewVotes?.filter(v => v.vote_value === -1).length || 0
      });
    }
  };

  if (loading) return <div style={styles.loader}>🌈 Prepping the Vibe...</div>;

  return (
    <div style={styles.page}>
      {/* 🏆 THE SCOREBOARD */}
      <div style={styles.scoreboard}>
        <div style={styles.scoreItem}>🔥 {myStats.fire} <span style={styles.scoreLabel}>GEMS</span></div>
        <div style={styles.scoreItem}>🗑️ {myStats.trash} <span style={styles.scoreLabel}>TRASHED</span></div>
      </div>

      <nav style={styles.nav}>
        <h1 style={styles.logo}>DormPulse ✨</h1>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={styles.logout}>Bye!</button>
      </nav>

      <header style={styles.header}>
        <h2 style={styles.title}>Campus Tea ☕</h2>
        <p style={styles.subtitle}>Wobble the cards, vote the vibes. What's the campus thinking?</p>
      </header>

      <div style={styles.masonryGrid}>
        {captions.map((cap, i) => (
          <div key={cap.id} className="wiggle-card" style={{...styles.card, backgroundColor: colors[i % colors.length]}}>
            <p style={styles.cardText}>“{cap.content}”</p>
            
            <div style={styles.voteContainer}>
              <div style={styles.voteBox}>
                <button onClick={() => handleVote(cap.id, 1)} style={{...styles.voteBtn, backgroundColor: cap.userVote === 1 ? '#4ade80' : 'white'}}>🔥</button>
                <span style={styles.globalCount}>{cap.globalFire}</span>
              </div>
              
              <div style={styles.voteBox}>
                <button onClick={() => handleVote(cap.id, -1)} style={{...styles.voteBtn, backgroundColor: cap.userVote === -1 ? '#f87171' : 'white'}}>🗑️</button>
                <span style={styles.globalCount}>{cap.globalTrash}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .wiggle-card { transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .wiggle-card:hover { transform: scale(1.03) rotate(${Math.random() > 0.5 ? '2' : '-2'}deg); cursor: pointer; box-shadow: 0 20px 30px rgba(0,0,0,0.1); }
      `}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#fff', padding: '0 20px 100px 20px', fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif' },
  scoreboard: { position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: 'white', padding: '15px 30px', borderRadius: '50px', display: 'flex', gap: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', zIndex: 1000, border: '3px solid #6366f1' },
  scoreItem: { fontSize: '20px', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  scoreLabel: { fontSize: '10px', opacity: 0.7 },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0' },
  logo: { fontSize: '28px', fontWeight: '900', color: '#6366f1' },
  logout: { padding: '10px 20px', borderRadius: '50px', border: '2px solid #000', background: 'white', fontWeight: 'bold', cursor: 'pointer' },
  header: { textAlign: 'center', margin: '40px 0' },
  title: { fontSize: '60px', fontWeight: '900', margin: '0', letterSpacing: '-3px' },
  subtitle: { color: '#64748b', fontSize: '20px' },
  masonryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '30px', maxWidth: '1200px', margin: '0 auto' },
  card: { padding: '30px', borderRadius: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '220px', border: '3px solid #000' },
  cardText: { fontSize: '22px', fontWeight: '900', color: '#000', lineHeight: '1.2' },
  voteContainer: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginTop: '20px' },
  voteBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' },
  voteBtn: { width: '60px', height: '60px', borderRadius: '50%', border: '3px solid #000', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' },
  globalCount: { fontWeight: '900', fontSize: '16px', color: '#000' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontWeight: '900' }
};