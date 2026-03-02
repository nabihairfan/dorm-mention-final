'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ConfessionsBoard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [activeTab, setActiveTab] = useState('home'); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  
  // Pipeline & Upload
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [newCaptions, setNewCaptions] = useState([]); 

  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // Fetch captions, images, AND the sum of votes for each caption
      const { data, error } = await supabase
        .from('captions')
        .select(`
          id, content, image_id,
          images!image_id ( url ),
          caption_votes ( vote_value )
        `)
        .order('id', { ascending: false });

      if (error) throw error;

      const formatted = data.map(cap => {
        const imgObj = Array.isArray(cap.images) ? cap.images[0] : cap.images;
        // Calculate total community score
        const score = cap.caption_votes?.reduce((acc, v) => acc + v.vote_value, 0) || 0;
        
        return { 
          ...cap, 
          display_url: imgObj?.url || 'https://via.placeholder.com/400?text=Pastel+Vibes',
          score: score
        };
      });

      setCaptions(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { 
    fetchData();
    // Auto-hide welcome message after 3 seconds
    const timer = setTimeout(() => setShowWelcome(false), 3500);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleVote = async (captionId, value) => {
    if (!user) return;
    try {
      await supabase.from('caption_votes').upsert({
        caption_id: captionId,
        profile_id: user.id,
        vote_value: value,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });
      
      fetchData(); // Refresh scores
      setCurrentIndex(prev => (prev + 1) % captions.length);
    } catch (err) { console.error(err); }
  };

  const handlePipelineUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session.access_token;
      
      const r1 = await fetch('https://api.almostcrackd.ai/pipeline/generate-presigned-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type })
      });
      const { presignedUrl, cdnUrl } = await r1.json();
      await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      const r3 = await fetch('https://api.almostcrackd.ai/pipeline/upload-image-from-url', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false })
      });
      const { imageId } = await r3.json();
      const r4 = await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId })
      });
      const generated = await r4.json();
      setNewCaptions(generated);
      fetchData();
    } catch (err) { alert("Pipeline error"); }
    finally { setUploading(false); }
  };

  // Helper for Creativity: Emoji based on score
  const getVibeEmoji = (score) => {
    if (score > 5) return '👑';
    if (score > 0) return '✨';
    if (score < 0) return '💀';
    return '🧊';
  };

  if (loading) return <div style={styles.loader}>🌸 Softening the vibes...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@300;600&display=swap');` }} />

      {/* WELCOME OVERLAY */}
      {showWelcome && (
        <div style={styles.welcomeOverlay}>
          <div style={styles.welcomeBox}>
            <h1 style={styles.welcomeText}>Welcome to DormPulse, {user?.email?.split('@')[0]}! ✨</h1>
            <p>Get ready for the best campus memes.</p>
          </div>
        </div>
      )}

      <nav style={styles.header}>
        <h1 style={styles.logo}>DormPulse.</h1>
      </nav>

      <main style={styles.content}>
        {/* TAB: VOTE */}
        {activeTab === 'home' && (
          <div style={styles.view}>
            {captions[currentIndex] ? (
              <div key={captions[currentIndex].id} style={styles.pastelCard}>
                <img src={captions[currentIndex].display_url} style={styles.cardImg} alt="meme" />
                <div style={styles.cardBody}>
                  <p style={styles.cardCaption}>“{captions[currentIndex].content}”</p>
                  <div style={styles.actionRow}>
                    <button onClick={() => handleVote(captions[currentIndex].id, -1)} style={styles.trashBtn}>👎 Trash</button>
                    <button onClick={() => handleVote(captions[currentIndex].id, 1)} style={styles.fireBtn}>💖 Love</button>
                  </div>
                </div>
              </div>
            ) : <p>Loading cards...</p>}
          </div>
        )}

        {/* TAB: THE WALL (With Community Votes) */}
        {activeTab === 'wall' && (
          <div style={styles.wallGrid}>
            <h2 style={styles.tabTitle}>Campus Wall</h2>
            {captions.map(c => (
              <div key={c.id} style={styles.wallItem}>
                <img src={c.display_url} style={styles.wallImg} alt="meme" />
                <div style={styles.wallPadding}>
                  <p style={styles.wallText}>{c.content}</p>
                  <div style={styles.scoreTag}>
                    {getVibeEmoji(c.score)} Community Score: {c.score}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: POST */}
        {activeTab === 'upload' && (
          <div style={styles.view}>
            <div style={styles.uploadCard}>
              <h2 style={styles.tabTitle}>Post a Vibe</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
              <button onClick={handlePipelineUpload} disabled={uploading} style={styles.genBtn}>
                {uploading ? 'Generating...' : 'Magic Upload'}
              </button>
            </div>
            {newCaptions.length > 0 && (
              <div style={styles.resultsBox}>
                <h4 style={{margin:0}}>Generated! ✨</h4>
                {newCaptions.map((nc, i) => <p key={i} style={{fontSize:'14px'}}>✅ {nc.content}</p>)}
              </div>
            )}
          </div>
        )}

        {/* TAB: ACCOUNT (Requirement: Display Name & Logout) */}
        {activeTab === 'account' && (
          <div style={styles.view}>
            <div style={styles.uploadCard}>
              <div style={styles.avatar}>{user?.email?.charAt(0).toUpperCase()}</div>
              <h2 style={styles.tabTitle}>Hi, {user?.email?.split('@')[0]}!</h2>
              <p style={{color: '#888'}}>{user?.email}</p>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>
                Logout
              </button>
            </div>
          </div>
        )}
      </main>

      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={styles.navBtn}>🏠<br/>Vote</button>
        <button onClick={() => setActiveTab('wall')} style={styles.navBtn}>🧱<br/>Wall</button>
        <button onClick={() => setActiveTab('upload')} style={styles.navBtn}>➕<br/>Post</button>
        <button onClick={() => setActiveTab('account')} style={styles.navBtn}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

// PASTEL THEME & LAYOUT FIXES
const styles = {
  page: { background: '#fdf2f8', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Fredoka', sans-serif" },
  welcomeOverlay: { position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeOut 0.5s forwards 3s' },
  welcomeBox: { textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '30px', border: '5px solid #fbcfe8' },
  welcomeText: { color: '#db2777', margin: 0 },
  header: { position: 'fixed', top: 0, width: '100%', height: '70px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '2px solid #fce7f3', zIndex: 1000 },
  logo: { fontSize: '24px', color: '#db2777', fontWeight: '600' },
  content: { paddingTop: '90px', paddingBottom: '100px', maxWidth: '450px', width: '100%', margin: '0 auto', paddingLeft: '15px', paddingRight: '15px' },
  view: { width: '100%' },
  tabTitle: { textAlign: 'center', color: '#be185d', margin: '0 0 20px 0' },
  pastelCard: { background: '#fff', borderRadius: '30px', border: '3px solid #fbcfe8', overflow: 'hidden', boxShadow: '0 10px 25px rgba(219,39,119,0.1)' },
  cardImg: { width: '100%', maxHeight: '50vh', objectFit: 'cover' },
  cardBody: { padding: '25px', textAlign: 'center' },
  cardCaption: { fontSize: '20px', fontWeight: '600', color: '#444' },
  actionRow: { display: 'flex', gap: '15px', marginTop: '10px' },
  fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '15px', borderRadius: '20px', border: 'none', fontWeight: '600', cursor: 'pointer' },
  trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '15px', borderRadius: '20px', border: 'none', fontWeight: '600', cursor: 'pointer' },
  wallGrid: { display: 'flex', flexDirection: 'column', gap: '20px' },
  wallItem: { background: '#fff', borderRadius: '25px', border: '2px solid #fce7f3', overflow: 'hidden' },
  wallImg: { width: '100%', borderBottom: '1px solid #fce7f3' },
  wallPadding: { padding: '15px' },
  wallText: { fontWeight: '600', color: '#333' },
  scoreTag: { marginTop: '8px', fontSize: '12px', background: '#fdf2f8', color: '#db2777', padding: '5px 12px', borderRadius: '50px', display: 'inline-block' },
  uploadCard: { background: '#fff', padding: '30px', borderRadius: '30px', border: '3px solid #fbcfe8', textAlign: 'center' },
  fileInput: { marginBottom: '20px', width: '100%' },
  genBtn: { width: '100%', padding: '15px', background: '#db2777', color: '#fff', borderRadius: '20px', border: 'none', fontWeight: '600', fontSize: '18px' },
  resultsBox: { marginTop: '20px', padding: '15px', background: '#f0fdf4', borderRadius: '20px', border: '2px dashed #4ade80' },
  avatar: { width: '60px', height: '60px', background: '#fbcfe8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', fontSize: '24px', color: '#db2777', fontWeight: '600' },
  logoutBtn: { marginTop: '20px', background: '#fff', border: '2px solid #db2777', color: '#db2777', padding: '10px 25px', borderRadius: '15px', fontWeight: '600', cursor: 'pointer' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '80px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '2px solid #fce7f3', zIndex: 1000 },
  navBtn: { border: 'none', background: 'none', textAlign: 'center', color: '#db2777', fontWeight: '600', fontSize: '12px', cursor: 'pointer' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777', fontSize: '20px' }
};