'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti'; // Run: npm install canvas-confetti

export default function ConfessionsBoard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [activeTab, setActiveTab] = useState('home'); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [swipeDir, setSwipeDir] = useState(''); // 'right' or 'left'
  
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data, error } = await supabase
        .from('captions')
        .select(`id, content, image_id, images!image_id ( url ), caption_votes ( vote_value )`)
        .order('id', { ascending: false });

      if (error) throw error;

      const formatted = data.map(cap => ({
        ...cap,
        display_url: cap.images?.url || 'https://via.placeholder.com/400',
        score: cap.caption_votes?.reduce((acc, v) => acc + v.vote_value, 0) || 0
      }));

      setCaptions(formatted);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { 
    fetchData();
    setTimeout(() => setShowWelcome(false), 2500);
  }, [fetchData]);

  const handleVote = async (captionId, value) => {
    if (!user) return;
    
    // Trigger Animation
    setSwipeDir(value === 1 ? 'right' : 'left');

    try {
      await supabase.from('caption_votes').upsert({
        caption_id: captionId, profile_id: user.id, vote_value: value,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });
      
      // Delay state change until animation finishes
      setTimeout(() => {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= captions.length) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#fbcfe8', '#db2777', '#ffffff'] });
        }
        setCurrentIndex(nextIndex);
        setSwipeDir('');
        fetchData();
      }, 400);
    } catch (err) { console.error(err); }
  };

  const handlePipelineUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session.access_token;
      const r1 = await fetch('https://api.almostcrackd.ai/pipeline/generate-presigned-url', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type }) });
      const { presignedUrl, cdnUrl } = await r1.json();
      await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      const r3 = await fetch('https://api.almostcrackd.ai/pipeline/upload-image-from-url', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false }) });
      const { imageId } = await r3.json();
      const r4 = await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ imageId }) });
      const gen = await r4.json();
      setPreviewData({ url: cdnUrl, caption: gen[0]?.content });
      fetchData();
    } catch (err) { alert("Error"); } finally { setUploading(false); }
  };

  if (loading) return <div style={styles.loader}>🌸 Watering the flowers...</div>;

  const captionsLeft = captions.length - currentIndex;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@300;600&display=swap');
        @keyframes swipeRight { 
          0% { transform: translateX(0) rotate(0); box-shadow: 0 0 0 rgba(74,222,128,0); }
          100% { transform: translateX(200%) rotate(20deg); box-shadow: 0 0 50px rgba(74,222,128,0.8); }
        }
        @keyframes swipeLeft { 
          0% { transform: translateX(0) rotate(0); box-shadow: 0 0 0 rgba(248,113,113,0); }
          100% { transform: translateX(-200%) rotate(-20deg); box-shadow: 0 0 50px rgba(248,113,113,0.8); }
        }
        .swipe-right { animation: swipeRight 0.5s forwards; }
        .swipe-left { animation: swipeLeft 0.5s forwards; }
      ` }} />

      {showWelcome && (
        <div style={styles.welcomeOverlay}>
          <div style={styles.welcomeBox}>
            <h1 style={styles.welcomeText}>🌸 Hi {user?.email?.split('@')[0]}!</h1>
          </div>
        </div>
      )}

      <nav style={styles.header}><h1 style={styles.logo}>DormPulse.</h1></nav>

      <main style={styles.content}>
        {activeTab === 'home' && (
          <div style={styles.view}>
            {currentIndex < captions.length ? (
              <>
                <div className={swipeDir === 'right' ? 'swipe-right' : swipeDir === 'left' ? 'swipe-left' : ''} style={styles.pastelCard}>
                  <img src={captions[currentIndex].display_url} style={styles.cardImg} alt="meme" />
                  <div style={styles.cardBody}>
                    <p style={styles.cardCaption}>“{captions[currentIndex].content}”</p>
                    <div style={styles.actionRow}>
                      <button onClick={() => handleVote(captions[currentIndex].id, -1)} style={styles.trashBtn}>👎</button>
                      <button onClick={() => handleVote(captions[currentIndex].id, 1)} style={styles.fireBtn}>💖</button>
                    </div>
                  </div>
                </div>
                <div style={styles.counter}>{captionsLeft} memes left in the stack ✨</div>
              </>
            ) : (
              <div style={styles.doneBox}>
                <h2 style={{fontSize:'40px', margin:0}}>DONE! 🎉</h2>
                <p>You've cleared the vibe check.</p>
                <button onClick={() => setCurrentIndex(0)} style={styles.resetBtn}>Rewatch Stack</button>
              </div>
            )}
          </div>
        )}

        {/* ... Wall, Post, and Account tabs remain consistent with logic ... */}
        {activeTab === 'wall' && (
          <div style={styles.wallGrid}>
            <h2 style={styles.tabTitle}>Campus Wall 🧱</h2>
            {captions.map(c => (
              <div key={c.id} style={styles.wallItem}>
                <img src={c.display_url} style={styles.wallImg} alt="meme" />
                <div style={styles.wallPadding}>
                  <p style={styles.wallText}>{c.content}</p>
                  <div style={styles.scoreTag}>✨ Score: {c.score}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'upload' && (
          <div style={styles.view}>
             {!previewData ? (
              <div style={styles.uploadCard}>
                <h2 style={styles.tabTitle}>Post a Vibe ➕</h2>
                <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
                <button onClick={handlePipelineUpload} disabled={uploading} style={styles.genBtn}>
                  {uploading ? 'Processing...' : 'Upload & Bloom'}
                </button>
              </div>
            ) : (
              <div style={{textAlign:'center'}}>
                <div style={styles.pastelCard}>
                  <img src={previewData.url} style={styles.cardImg} alt="preview" />
                  <div style={styles.cardBody}><p style={styles.cardCaption}>“{previewData.caption}”</p></div>
                </div>
                <button onClick={() => setPreviewData(null)} style={styles.resetBtn}>Post Another 🌸</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'account' && (
          <div style={styles.view}>
            <div style={styles.uploadCard}>
              <div style={styles.avatar}>{user?.email?.charAt(0).toUpperCase()}</div>
              <h2 style={styles.tabTitle}>Hi, {user?.email?.split('@')[0]}!</h2>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>Logout</button>
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

const styles = {
  page: { 
    background: '#fdf2f8', 
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-1-3-4-5-7-5-4 0-7 3-7 7 0 3 2 6 5 7-3 1-5 4-5 7 0 4 3 7 7 7 3 0 6-2 7-5 1 3 4 5 7 5 4 0 7-3 7-7 0-3-2-6-5-7 3-1 5-4 5-7 0-4-3-7-7-7-3 0-6 2-7 5z' fill='%23fbcfe8' fill-opacity='0.4'/%3E%3C/svg%3E")`,
    minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Fredoka', sans-serif" 
  },
  welcomeOverlay: { position: 'fixed', inset: 0, background: '#fff', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  welcomeBox: { textAlign: 'center' },
  welcomeText: { color: '#db2777', fontSize: '32px' },
  header: { position: 'fixed', top: 0, width: '100%', height: '70px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '2px solid #fce7f3', zIndex: 1000 },
  logo: { fontSize: '24px', color: '#db2777' },
  content: { paddingTop: '90px', paddingBottom: '120px', maxWidth: '400px', width: '100%', margin: '0 auto', paddingLeft: '20px', paddingRight: '20px', flex: 1, display: 'flex', alignItems: 'center' },
  view: { width: '100%' },
  pastelCard: { background: '#fff', borderRadius: '35px', border: '4px solid #fbcfe8', overflow: 'hidden', boxShadow: '0 15px 35px rgba(219,39,119,0.1)', transition: 'all 0.3s' },
  cardImg: { width: '100%', maxHeight: '45vh', objectFit: 'cover' },
  cardBody: { padding: '25px', textAlign: 'center' },
  cardCaption: { fontSize: '22px', fontWeight: '600', color: '#444' },
  actionRow: { display: 'flex', gap: '20px', marginTop: '10px' },
  fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '15px', borderRadius: '25px', border: 'none', fontSize: '24px', cursor: 'pointer' },
  trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '15px', borderRadius: '25px', border: 'none', fontSize: '24px', cursor: 'pointer' },
  counter: { textAlign: 'center', marginTop: '25px', color: '#db2777', fontWeight: '600', fontSize: '14px' },
  doneBox: { textAlign: 'center', width: '100%', color: '#db2777' },
  tabTitle: { textAlign: 'center', color: '#be185d', marginBottom: '20px' },
  wallGrid: { display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' },
  wallItem: { background: '#fff', borderRadius: '25px', border: '2px solid #fce7f3', overflow: 'hidden' },
  wallImg: { width: '100%' },
  wallPadding: { padding: '15px' },
  wallText: { fontWeight: '600', fontSize: '16px' },
  scoreTag: { marginTop: '5px', fontSize: '12px', color: '#db2777' },
  uploadCard: { background: '#fff', padding: '30px', borderRadius: '35px', border: '4px solid #fbcfe8', textAlign: 'center' },
  fileInput: { marginBottom: '20px', width: '100%' },
  genBtn: { width: '100%', padding: '18px', background: '#db2777', color: '#fff', borderRadius: '25px', border: 'none', fontWeight: '600', fontSize: '18px' },
  avatar: { width: '70px', height: '70px', background: '#fbcfe8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', fontSize: '28px', color: '#db2777' },
  logoutBtn: { width: '100%', background: '#fff', border: '2px solid #db2777', color: '#db2777', padding: '12px', borderRadius: '15px', fontWeight: '600' },
  resetBtn: { marginTop: '20px', background: 'none', border: 'none', color: '#db2777', textDecoration: 'underline', fontWeight: '600', cursor: 'pointer' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '85px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '2px solid #fce7f3', zIndex: 1000 },
  navBtn: { border: 'none', background: 'none', textAlign: 'center', color: '#db2777', fontWeight: '600', fontSize: '12px' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777', fontSize: '20px' }
};