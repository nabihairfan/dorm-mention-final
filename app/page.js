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
  
  // New State for Upload Pipeline
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const router = useRouter();
  const colors = ['#FFEDD5', '#DBEAFE', '#D1FAE5', '#FCE7F3', '#FEF3C7', '#EDE9FE'];

  const fetchEverything = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data: captionsData } = await supabase.from('captions').select('id, content').order('id', { ascending: false });
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

  // --- NEW: THE 4-STEP IMAGE PIPELINE ---
  const handleImageUpload = async () => {
    if (!file || !user) return alert("Select an image first!");
    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session.access_token;

      // STEP 1: Generate Presigned URL
      const res1 = await fetch('https://api.almostcrackd.ai/pipeline/generate-presigned-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type })
      });
      const { presignedUrl, cdnUrl } = await res1.json();

      // STEP 2: Upload Image Bytes to S3
      await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });

      // STEP 3: Register Image URL
      const res3 = await fetch('https://api.almostcrackd.ai/pipeline/upload-image-from-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false })
      });
      const { imageId } = await res3.json();

      // STEP 4: Generate Captions
      await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: imageId })
      });

      alert("🎉 Captions generated successfully!");
      setFile(null);
      fetchEverything(); // Refresh to see new content
    } catch (err) {
      console.error(err);
      alert("Pipeline error. Check console.");
    } finally {
      setUploading(false);
    }
  };

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

    setMyStats(prev => {
      let f = prev.fire; let t = prev.trash;
      if (isRemoving) { voteValue === 1 ? f-- : t--; } 
      else {
        if (currentCard?.userVote === 1) { f--; t++; }
        else if (currentCard?.userVote === -1) { t--; f++; }
        else { voteValue === 1 ? f++ : t++; }
      }
      return { fire: Math.max(0, f), trash: Math.max(0, t) };
    });

    if (isRemoving) {
      await supabase.from('caption_votes').delete().eq('caption_id', captionId).eq('profile_id', user.id);
    } else {
      setVibeEffect(voteValue === 1 ? 'fire' : 'trash');
      setTimeout(() => setVibeEffect(null), 800);
      await supabase.from('caption_votes').upsert({ caption_id: captionId, profile_id: user.id, vote_value: voteValue, created_datetime_utc: new Date().toISOString() }, { onConflict: 'caption_id, profile_id' });
    }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Poppins:wght@400;700;900&display=swap');`}} />

      {vibeEffect === 'fire' && <div style={styles.effectOverlay}>🎉✨🎊</div>}
      {vibeEffect === 'trash' && <div style={styles.effectOverlay}>☹️😭💔</div>}

      <div style={styles.controlCenter}>
        <div style={styles.scoreboard}>
          <div style={styles.scoreItem}>🔥 {myStats.fire}</div>
          <div style={styles.scoreItem}>🗑️ {myStats.trash}</div>
        </div>
        <button onClick={() => window.confirm("Reset?") && supabase.from('caption_votes').delete().eq('profile_id', user.id).then(fetchEverything)} style={styles.resetBtn}>RESET ALL VOTES</button>
      </div>

      <nav style={styles.nav}>
        <h1 style={styles.logo}>DormPulse.</h1>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={styles.logout}>Logout</button>
      </nav>

      <header style={styles.header}>
        <h2 style={styles.title}>The Social Wall</h2>
        <p style={styles.subtitle}>Upload a meme and let the AI spill the tea! ☕️💅</p>
      </header>

      {/* UPLOAD SECTION */}
      <div style={styles.uploadBox}>
        <h3 style={{fontFamily: "'Luckiest Guy', cursive", marginBottom: '10px'}}>Meme Uploader</h3>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
        <button onClick={handleImageUpload} disabled={uploading} style={styles.uploadBtn}>
          {uploading ? 'WORKING...' : 'GENERATE CAPTIONS'}
        </button>
      </div>

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
                  <span style={styles.statChip}>Total 🔥: {cap.globalFire}</span>
                  <span style={styles.statChip}>Total 🗑️: {cap.globalTrash}</span>
                </div>
              )}
            </div>
            <div style={styles.voteRow}>
              <button onClick={() => handleVote(cap.id, 1)} style={{...styles.voteBtn, backgroundColor: cap.userVote === 1 ? '#4ade80' : '#FFF', color: cap.userVote === 1 ? '#FFF' : '#000'}}>
                {cap.userVote === 1 ? '🔥 FIRE | +1' : '🔥 FIRE'}
              </button>
              <button onClick={() => handleVote(cap.id, -1)} style={{...styles.voteBtn, backgroundColor: cap.userVote === -1 ? '#f87171' : '#FFF', color: cap.userVote === -1 ? '#FFF' : '#000'}}>
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
  page: { minHeight: '100vh', background: '#FFF', padding: '20px', fontFamily: "'Poppins', sans-serif" },
  effectOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '100px', pointerEvents: 'none', zIndex: 1000 },
  controlCenter: { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', zIndex: 100 },
  scoreboard: { background: '#000', color: '#fff', padding: '12px 35px', borderRadius: '50px', display: 'flex', gap: '30px', border: '3px solid #6366f1' },
  scoreItem: { fontSize: '24px', fontFamily: "'Luckiest Guy', cursive" },
  resetBtn: { background: '#ff4757', color: 'white', border: '2px solid #000', padding: '6px 15px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: '32px', fontFamily: "'Luckiest Guy', cursive" },
  logout: { background: '#000', color: '#fff', padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
  header: { textAlign: 'center', margin: '40px 0 20px 0' },
  title: { fontSize: 'clamp(32px, 8vw, 60px)', fontFamily: "'Luckiest Guy', cursive" },
  subtitle: { fontSize: '18px', fontWeight: 'bold', color: '#555' },
  uploadBox: { background: '#f9f9f9', border: '4px solid #000', borderRadius: '25px', padding: '20px', margin: '0 auto 40px auto', maxWidth: '400px', textAlign: 'center', boxShadow: '8px 8px 0px #000' },
  fileInput: { marginBottom: '15px', display: 'block', width: '100%' },
  uploadBtn: { background: '#6366f1', color: '#fff', border: '3px solid #000', padding: '12px', borderRadius: '15px', fontFamily: "'Luckiest Guy', cursive", cursor: 'pointer', width: '100%' },
  grid: { display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', maxWidth: '1200px', margin: '0 auto', paddingBottom: '140px' },
  card: { width: '320px', padding: '25px', borderRadius: '25px', border: '4px solid #000', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '8px 8px 0px #000' },
  cardText: { fontSize: '20px', fontWeight: '900' },
  statsArea: { margin: '15px 0' },
  statsToggle: { background: 'none', border: 'none', textDecoration: 'underline', fontWeight: '700', cursor: 'pointer', fontSize: '12px' },
  statsRow: { marginTop: '10px', display: 'flex', gap: '8px' },
  statChip: { background: '#FFF', border: '2px solid #000', padding: '3px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' },
  voteRow: { display: 'flex', gap: '10px' },
  voteBtn: { flex: 1, padding: '12px', borderRadius: '15px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', border: '3px solid #000', fontFamily: "'Luckiest Guy', cursive" },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontFamily: "'Luckiest Guy', cursive" }
};