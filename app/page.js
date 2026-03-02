'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormPulseGarden() {
  // Core States
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [activeTab, setActiveTab] = useState('home'); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const [swipeDir, setSwipeDir] = useState(''); 
  const [hasMounted, setHasMounted] = useState(false);
  
  // Pipeline States
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  const router = useRouter();

  // 1. Prevent Hydration Errors
  useEffect(() => {
    setHasMounted(true);
    const welcomeTimer = setTimeout(() => setShowWelcome(false), 2000);
    return () => clearTimeout(welcomeTimer);
  }, []);

  // 2. Optimized Data Fetching
  const fetchData = useCallback(async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        router.push('/login');
        return;
      }
      
      setUser(session.user);

      // Fetch captions with counts
      const { data, error } = await supabase
        .from('captions')
        .select(`
          id, content, image_id,
          images!image_id ( url ),
          caption_votes ( vote_value )
        `)
        .order('id', { ascending: false });

      if (error) throw error;

      if (data) {
        const formatted = data.map(cap => {
          const votes = cap.caption_votes || [];
          return {
            ...cap,
            display_url: cap.images?.url || 'https://via.placeholder.com/400?text=Bloom',
            upvotes: votes.filter(v => v.vote_value === 1).length,
            downvotes: votes.filter(v => v.vote_value === -1).length
          };
        });
        setCaptions(formatted);
      }
    } catch (err) {
      console.error("Critical Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (hasMounted) {
      fetchData();
    }
  }, [hasMounted, fetchData]);

  // 3. Search Logic
  const filteredCaptions = useMemo(() => {
    if (!searchQuery) return captions;
    return captions.filter(c => 
      c.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [captions, searchQuery]);

  // 4. Voting Logic
  const handleVote = async (captionId, value) => {
    if (!user) return;
    setSwipeDir(value === 1 ? 'right' : 'left');

    try {
      const { error } = await supabase.from('caption_votes').upsert({
        caption_id: captionId,
        profile_id: user.id,
        vote_value: value,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });

      if (error) throw error;
      
      // Animation delay before moving to next card
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setSwipeDir('');
        fetchData(); // Refresh vote counts
      }, 400);
    } catch (err) { 
      console.error("Vote Error:", err);
      setSwipeDir('');
    }
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
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false }) 
      });
      const { imageId } = await r3.json();
      
      const r4 = await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ imageId }) 
      });
      const gen = await r4.json();
      
      setPreviewData({ url: cdnUrl, caption: gen[0]?.content });
      fetchData();
    } catch (err) { 
      alert("Upload error. Check your connection."); 
    } finally { 
      setUploading(false); 
    }
  };

  // 5. HYDRATION GUARD
  if (!hasMounted) return null;
  if (loading) return <div style={styles.loader}>🌸 Watering the garden...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        @keyframes rotateFlower { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes swipeRight { 100% { transform: translateX(150%) rotate(20deg); opacity: 0; box-shadow: 0 0 40px #4ade80; } }
        @keyframes swipeLeft { 100% { transform: translateX(-150%) rotate(-20deg); opacity: 0; box-shadow: 0 0 40px #f87171; } }
        .flower-rotate { animation: rotateFlower 30s linear infinite; }
        .swipe-right { animation: swipeRight 0.5s forwards; }
        .swipe-left { animation: swipeLeft 0.5s forwards; }
      ` }} />

      {showWelcome && (
        <div style={styles.welcomeOverlay}>
          <h1 style={styles.logo}>DormPulse. 🌸</h1>
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
                      <button onClick={() => handleVote(captions[currentIndex].id, -1)} style={styles.trashBtn}>👎 Trash</button>
                      <button onClick={() => handleVote(captions[currentIndex].id, 1)} style={styles.fireBtn}>💖 Fire</button>
                    </div>
                  </div>
                </div>
                <p style={styles.counter}>{captions.length - currentIndex} memes remaining ✨</p>
              </>
            ) : (
              <div style={styles.doneBox}>
                <h1 style={{fontSize: '60px', margin:0}}>DONE!</h1>
                <p style={{fontSize: '20px', color: '#db2777'}}>Garden fully bloomed 🌸</p>
                <button onClick={() => setCurrentIndex(0)} style={styles.resetBtn}>Reset Stack</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'wall' && (
          <div style={styles.flowerContainer}>
             <div className="flower-rotate" style={styles.megaFlower}>
                {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                  <div key={i} style={{...styles.petal, transform: `rotate(${deg}deg) translateY(-85px)`}} onClick={() => setActiveTab('search')}>
                    <span style={{transform: `rotate(-${deg}deg)`, fontSize:'22px'}}>🔍</span>
                  </div>
                ))}
                <div style={styles.flowerCenter}>Pulse</div>
             </div>
             <p style={{textAlign:'center', marginTop:'60px', color:'#db2777', fontWeight:'600'}}>Petals lead to the Search Garden</p>
          </div>
        )}

        {activeTab === 'search' && (
          <div style={styles.view}>
            <input style={styles.searchBar} placeholder="Search words..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <div style={styles.wallGrid}>
              {filteredCaptions.length > 0 ? filteredCaptions.map(c => (
                <div key={c.id} style={styles.wallItem}>
                  <img src={c.display_url} style={styles.wallImg} alt="meme" />
                  <div style={styles.wallPadding}>
                    <p style={styles.wallText}>{c.content}</p>
                    <div style={styles.voteDisplay}>
                      <span style={{color:'#10b981'}}>👍 {c.upvotes} Up</span>
                      <span style={{color:'#ef4444'}}>👎 {c.downvotes} Down</span>
                    </div>
                  </div>
                </div>
              )) : <p style={{textAlign:'center', color:'#db2777'}}>No flowers found with that word.</p>}
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div style={styles.view}>
             {!previewData ? (
              <div style={styles.uploadCard}>
                <h2 style={styles.tabTitle}>New Growth ➕</h2>
                <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
                <button onClick={handlePipelineUpload} disabled={uploading} style={styles.genBtn}>
                  {uploading ? 'Processing...' : 'Bloom Post'}
                </button>
              </div>
            ) : (
              <div style={{textAlign:'center'}}>
                <div style={styles.pastelCard}>
                  <img src={previewData.url} style={styles.cardImg} alt="preview" />
                  <div style={styles.cardBody}><p style={styles.cardCaption}>“{previewData.caption}”</p></div>
                </div>
                <button onClick={() => setPreviewData(null)} style={styles.resetBtn}>Post Another Seed 🌸</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'account' && (
          <div style={styles.view}>
            <div style={styles.uploadCard}>
              <div style={styles.avatar}>{user?.email?.charAt(0).toUpperCase()}</div>
              <h2 style={styles.tabTitle}>Bloom on, {user?.email?.split('@')[0]}!</h2>
              <p style={styles.affirmation}>"Every flower must grow through dirt. Your journey is beautiful today." 🌸</p>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>Logout</button>
            </div>
          </div>
        )}
      </main>

      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={styles.navBtn}>🏠<br/>Vote</button>
        <button onClick={() => setActiveTab('wall')} style={styles.navBtn}>🌸<br/>Garden</button>
        <button onClick={() => setActiveTab('search')} style={styles.navBtn}>🔍<br/>Search</button>
        <button onClick={() => setActiveTab('upload')} style={styles.navBtn}>➕<br/>Post</button>
        <button onClick={() => setActiveTab('account')} style={styles.navBtn}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#fdf2f8', backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-1-3-4-5-7-5-4 0-7 3-7 7 0 3 2 6 5 7-3 1-5 4-5 7 0 4 3 7 7 7 3 0 6-2 7-5 1 3 4 5 7 5 4 0 7-3 7-7 0-3-2-6-5-7 3-1 5-4 5-7 0-4-3-7-7-7-3 0-6 2-7 5z' fill='%23fbcfe8' fill-opacity='0.4'/%3E%3C/svg%3E")`, minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  header: { position: 'fixed', top: 0, width: '100%', height: '70px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '2px solid #fce7f3', zIndex: 1000 },
  logo: { fontSize: '24px', color: '#db2777', fontWeight: '600' },
  content: { paddingTop: '100px', paddingBottom: '120px', maxWidth: '400px', margin: '0 auto', padding: '0 20px' },
  flowerContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' },
  megaFlower: { position: 'relative', width: '120px', height: '120px' },
  petal: { position: 'absolute', width: '70px', height: '90px', background: '#fbcfe8', borderRadius: '50% 50% 50% 50% / 80% 80% 20% 20%', border: '2px solid #db2777', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', left: '25px' },
  flowerCenter: { position: 'absolute', top: '35px', left: '35px', width: '50px', height: '50px', background: '#db2777', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', zIndex: 10 },
  searchBar: { width: '100%', padding: '16px', borderRadius: '25px', border: '3px solid #fbcfe8', marginBottom: '25px', outline: 'none' },
  wallGrid: { display: 'flex', flexDirection: 'column', gap: '20px' },
  wallItem: { background: '#fff', borderRadius: '30px', border: '2px solid #fce7f3', overflow: 'hidden' },
  wallImg: { width: '100%', display: 'block' },
  wallPadding: { padding: '20px' },
  wallText: { fontWeight: '600', fontSize: '16px', color: '#333' },
  voteDisplay: { marginTop: '12px', display: 'flex', gap: '20px', fontWeight: '600', fontSize: '14px' },
  pastelCard: { background: '#fff', borderRadius: '40px', border: '4px solid #fbcfe8', overflow: 'hidden', boxShadow: '0 20px 40px rgba(219,39,119,0.1)' },
  cardImg: { width: '100%', maxHeight: '45vh', objectFit: 'cover' },
  cardBody: { padding: '30px', textAlign: 'center' },
  cardCaption: { fontSize: '22px', fontWeight: '600', color: '#333' },
  actionRow: { display: 'flex', gap: '20px', marginTop: '20px' },
  fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '15px', borderRadius: '25px', border: 'none', fontWeight: '600' },
  trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '15px', borderRadius: '25px', border: 'none', fontWeight: '600' },
  counter: { textAlign: 'center', marginTop: '25px', color: '#db2777', fontWeight: '600' },
  doneBox: { textAlign: 'center', color: '#db2777', marginTop: '50px' },
  resetBtn: { marginTop: '20px', background: 'none', border: 'none', color: '#db2777', textDecoration: 'underline', fontWeight: '600', cursor: 'pointer' },
  uploadCard: { background: '#fff', padding: '40px 30px', borderRadius: '40px', border: '4px solid #fbcfe8', textAlign: 'center' },
  avatar: { width: '80px', height: '80px', background: '#fbcfe8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px', color: '#db2777' },
  affirmation: { fontStyle: 'italic', color: '#db2777', margin: '20px 0', fontSize: '18px' },
  logoutBtn: { width: '100%', background: '#fff', border: '2px solid #db2777', color: '#db2777', padding: '14px', borderRadius: '20px', fontWeight: '600' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '90px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '2px solid #fce7f3', zIndex: 1000 },
  navBtn: { border: 'none', background: 'none', textAlign: 'center', color: '#db2777', fontWeight: '600', fontSize: '11px' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777', fontSize: '20px' },
  welcomeOverlay: { position: 'fixed', inset: 0, background: '#fff', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }
};