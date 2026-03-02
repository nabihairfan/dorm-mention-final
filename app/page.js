'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormPulseGarden() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [activeTab, setActiveTab] = useState('home'); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState([]); 
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('all'); 
  const [hasMounted, setHasMounted] = useState(false);
  const [swipeDir, setSwipeDir] = useState(''); 

  // Post Tab States
  const [uploading, setUploading] = useState(false);
  const [postCaption, setPostCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const router = useRouter();

  useEffect(() => { setHasMounted(true); }, []);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // Fetch captions AND the votes for the current user
      const { data, error } = await supabase
        .from('captions')
        .select(`id, content, profile_id, images!image_id ( url ), caption_votes ( vote_value, profile_id )`)
        .order('id', { ascending: false });

      if (error) throw error;

      const formatted = data.map(cap => {
        const votes = cap.caption_votes || [];
        const ups = votes.filter(v => v.vote_value === 1).length;
        const downs = votes.filter(v => v.vote_value === -1).length;
        // Check if THIS specific user has already voted on this caption
        const hasVoted = votes.some(v => v.profile_id === session.user.id);
        
        return {
          ...cap,
          content: cap.content || "No caption provided",
          display_url: cap.images?.url || 'https://via.placeholder.com/400',
          upvotes: ups, downvotes: downs, net: ups - downs,
          userHasVoted: hasVoted
        };
      });

      setCaptions(formatted);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { if (hasMounted) fetchData(); }, [hasMounted, fetchData]);

  // Logic: Filter out captions the user has already voted on for the "Vote" tab
  const unvotedCaptions = useMemo(() => {
    return captions.filter(c => !c.userHasVoted);
  }, [captions]);

  const handleVote = async (captionId, value) => {
    setSwipeDir(value === 1 ? 'right' : 'left');
    setHistory(prev => [...prev, currentIndex]);
    try {
      await supabase.from('caption_votes').upsert({
        caption_id: captionId, profile_id: user.id, vote_value: value,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });
      
      setTimeout(() => {
        // We don't necessarily need to increment index if we re-fetch and filter
        setSwipeDir('');
        fetchData(); 
      }, 450);
    } catch (err) { setSwipeDir(''); }
  };

const handleUploadAndPost = async () => {
    if (!selectedFile) return alert("Please pick a photo first!");
    setUploading(true);

    try {
      // 0. Get your JWT Access Token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      // --- STEP 1: Generate Presigned URL ---
      const step1Res = await fetch('https://api.almostcrackd.ai/pipeline/generate-presigned-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contentType: selectedFile.type })
      });
      const { presignedUrl, cdnUrl } = await step1Res.json();

      // --- STEP 2: Upload Image Bytes directly to S3 ---
      await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile
      });

      // --- STEP 3: Register Image URL with the pipeline ---
      const step3Res = await fetch('https://api.almostcrackd.ai/pipeline/upload-image-from-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false })
      });
      const { imageId } = await step3Res.json();

      // --- STEP 4: Generate Captions ---
      const step4Res = await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageId: imageId })
      });
      
      const generatedCaptions = await step4Res.json();
      
      // The API returns an array of captions. We take the first one and save it to your Supabase DB.
      // This ensures the caption shows up in your "Garden" forever.
      if (generatedCaptions && generatedCaptions.length > 0) {
        const topCaption = generatedCaptions[0].content;
        
        // 5. Save the result to your Supabase 'captions' table so it persists in YOUR app
        const { data: imgRow } = await supabase.from('images').insert([{ url: cdnUrl }]).select().single();
        await supabase.from('captions').insert([{ 
          content: topCaption, 
          image_id: imgRow.id, 
          profile_id: user.id 
        }]);
      }

      alert("AI Caption Generated & Planted! 🌸");
      setPostCaption(''); 
      setSelectedFile(null);
      await fetchData(); // Refresh feed
      setActiveTab('seeUploads');
      
    } catch (err) {
      console.error("Pipeline Error:", err);
      alert("Failed to grow the caption. Check console.");
    } finally {
      setUploading(false);
    }
  };

  const groupedUploads = useMemo(() => {
    const groups = {};
    captions.forEach(c => {
      const pid = c.profile_id;
      if (!groups[pid]) groups[pid] = [];
      groups[pid].push(c);
    });
    return Object.entries(groups).sort(([pidA]) => pidA === user?.id ? -1 : 1);
  }, [captions, user]);

  const filteredCaptions = useMemo(() => {
    let list = [...captions];
    if (sortMode === 'high') list.sort((a, b) => b.net - a.net);
    if (sortMode === 'low') list.sort((a, b) => a.net - b.net);
    return list;
  }, [captions, sortMode]);

  const affirmations = [
    "You are blooming at your own pace.",
    "Your garden is beautiful because you are in it.",
    "Every small pulse is a sign of growth.",
    "You are a rare and wonderful flower.",
    "Keep growing, the world needs your light."
  ];

  if (!hasMounted) return null;
  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Gardener";

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); } 100% { transform: translateY(110vh) rotate(360deg); } }
        .petal-drift { position: fixed; top: -10%; color: #fbcfe8; animation: drift 8s linear infinite; z-index: 0; pointer-events: none; }
        .flower-rotate { animation: slowRotate 50s linear infinite; }
        @keyframes slowRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .swipe-right { animation: swipeRight 0.5s forwards; }
        .swipe-left { animation: swipeLeft 0.5s forwards; }
        @keyframes swipeRight { 100% { transform: translateX(150%) rotate(20deg); opacity: 0; } }
        @keyframes swipeLeft { 100% { transform: translateX(-150%) rotate(-20deg); opacity: 0; } }
      ` }} />

      {[...Array(10)].map((_, i) => (
        <div key={i} className="petal-drift" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 5}s` }}>🌸</div>
      ))}

      <nav style={styles.header}><h1 style={styles.logo}>DormPulse.</h1></nav>

      <main style={styles.content}>
        {/* TAB: VOTE (HOME) */}
        {activeTab === 'home' && (
          <div style={styles.centerContainer}>
            <div style={styles.counterBadge}>{unvotedCaptions.length} New Pulses to Rate 🌷</div>
            {unvotedCaptions.length > 0 ? (
              <div style={{width: '100%', maxWidth: '360px'}}>
                <div className={swipeDir === 'right' ? 'swipe-right' : swipeDir === 'left' ? 'swipe-left' : ''} style={styles.pastelCard}>
                  <img src={unvotedCaptions[0].display_url} style={styles.cardImg} />
                  <div style={styles.cardBody}>
                    <p style={styles.cardCaption}>“{unvotedCaptions[0].content}”</p>
                    <div style={styles.actionRow}>
                      <button onClick={() => handleVote(unvotedCaptions[0].id, -1)} style={styles.trashBtn}>👎</button>
                      <button onClick={() => handleVote(unvotedCaptions[0].id, 1)} style={styles.fireBtn}>💖</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : <div style={styles.doneBox}><h1>ALL WATERED! 🌸</h1><p>You've voted on everything in the garden.</p></div>}
          </div>
        )}

        {/* TAB: GARDEN (BIG FLOWER) */}
        {activeTab === 'wall' && (
          <div style={styles.centerContainer}>
            <div className="flower-rotate" style={styles.giantFlowerWrapper}>
              {[
                { deg: 0, lab: 'All Seeds', mode: 'all' },
                { deg: 120, lab: 'Top Voted', mode: 'high' },
                { deg: 240, lab: 'Lowest Voted', mode: 'low' },
              ].map((petal, i) => (
                <div key={i} style={{...styles.giantPetal, transform: `rotate(${petal.deg}deg) translateY(-140px)`}} 
                     onClick={() => { setSortMode(petal.mode); setActiveTab('search'); }}>
                  <div style={{transform: `rotate(-${petal.deg}deg)`, fontSize: '11px', fontWeight:'600', color:'#fff', textAlign:'center'}}>{petal.lab}</div>
                </div>
              ))}
              <div style={styles.giantCenter}>Dorm<br/>Pulse</div>
            </div>
          </div>
        )}

        {/* TAB: SEARCH FEED */}
        {activeTab === 'search' && (
          <div style={styles.searchView}>
            <h2 style={{color: '#db2777', textAlign: 'center'}}>{sortMode === 'low' ? 'Underdog Seeds' : 'Garden Feed'}</h2>
            {filteredCaptions.map(c => (
              <div key={c.id} style={styles.feedItem}>
                <img src={c.display_url} style={styles.feedImg} />
                <div style={styles.feedPadding}>
                  <p style={styles.feedText}>“{c.content}”</p>
                  <div style={styles.voteDisplay}><span>💖 {c.upvotes}</span><span>👎 {c.downvotes}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: POST */}
        {activeTab === 'post' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <h2 style={{color: '#db2777'}}>Plant a Memory</h2>
              <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} style={styles.fileInput} />
              <textarea style={styles.searchBar} placeholder="Leave blank for AI generation..." value={postCaption} onChange={(e) => setPostCaption(e.target.value)} />
              <button onClick={handleUploadAndPost} disabled={uploading} style={styles.aboutBtn}>
                {uploading ? "Blooming..." : "✨ Generate & Plant"}
              </button>
            </div>
          </div>
        )}

        {/* TAB: ME (With Affirmations) */}
        {activeTab === 'account' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <div style={styles.avatar}>{userName.charAt(0).toUpperCase()}</div>
              <h3>Hi, {userName}!</h3>
              <div style={styles.affirmationBox}>
                <p style={{fontStyle: 'italic', color: '#db2777'}}>"{affirmations[Math.floor(Math.random() * affirmations.length)]}"</p>
              </div>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>Logout</button>
            </div>
          </div>
        )}
      </main>

      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={styles.navBtn}>🏠<br/>Vote</button>
        <button onClick={() => setActiveTab('wall')} style={styles.navBtn}>🌸<br/>Garden</button>
        <button onClick={() => setActiveTab('post')} style={styles.navBtn}>✨<br/>Post</button>
        <button onClick={() => setActiveTab('seeUploads')} style={styles.navBtn}>📸<br/>Uploads</button>
        <button onClick={() => setActiveTab('account')} style={styles.navBtn}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
  // ... including existing styles from previous response ...
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif", overflowX: 'hidden' },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #fce7f3', zIndex: 1000 },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 },
  centerContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px 100px' },
  counterBadge: { background: '#fbcfe8', padding: '10px 20px', borderRadius: '20px', color: '#db2777', fontWeight: '600', marginBottom: '20px' },
  pastelCard: { background: '#fff', borderRadius: '35px', width: '100%', overflow: 'hidden', border: '4px solid #fbcfe8', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
  cardImg: { width: '100%', maxHeight: '45vh', objectFit: 'cover' },
  cardBody: { padding: '25px', textAlign: 'center' },
  cardCaption: { fontSize: '20px', fontWeight: '600', color: '#333' },
  actionRow: { display: 'flex', gap: '15px', marginTop: '15px' },
  fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '16px', borderRadius: '20px', border: 'none', cursor: 'pointer' },
  trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '16px', borderRadius: '20px', border: 'none', cursor: 'pointer' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '85px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3', zIndex: 1000 },
  navBtn: { border: 'none', background: 'none', color: '#db2777', fontWeight: '600', fontSize: '11px', cursor: 'pointer' },
  uploadCard: { background: '#fff', padding: '30px', borderRadius: '30px', textAlign: 'center', border: '3px solid #fbcfe8', width: '100%', maxWidth: '400px' },
  fileInput: { margin: '20px 0', fontSize: '14px' },
  searchBar: { width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #fbcfe8', marginBottom: '15px', outline: 'none', resize: 'none' },
  aboutBtn: { width: '100%', padding: '15px', borderRadius: '15px', background: '#db2777', color: '#fff', border: 'none', fontWeight: '600', cursor: 'pointer' },
  affirmationBox: { padding: '15px', background: '#fff5f7', borderRadius: '15px', margin: '15px 0' },
  logoutBtn: { width: '100%', padding: '12px', borderRadius: '15px', border: '2px solid #db2777', background: 'none', color: '#db2777', fontWeight: '600', cursor: 'pointer' },
  avatar: { width: '80px', height: '80px', background: '#fbcfe8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#db2777', fontSize: '30px', fontWeight: '600' },
  searchView: { paddingTop: '80px', paddingBottom: '100px', width: '100%', maxWidth: '500px', margin: '0 auto' },
  feedItem: { background: '#fff', borderRadius: '25px', marginBottom: '20px', overflow: 'hidden', border: '2px solid #fce7f3' },
  feedImg: { width: '100%', height: 'auto' },
  feedPadding: { padding: '15px' },
  feedText: { fontWeight: '600', fontSize: '16px' },
  voteDisplay: { display: 'flex', gap: '15px', marginTop: '10px', color: '#db2777', fontWeight: '600' },
  giantFlowerWrapper: { position: 'relative', width: '150px', height: '150px' },
  giantPetal: { position: 'absolute', width: '110px', height: '160px', background: 'linear-gradient(to bottom, #ff85a2, #db2777)', borderRadius: '50% 50% 50% 50% / 80% 80% 20% 20%', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', left: '20px' },
  giantCenter: { position: 'absolute', top: '25px', left: '25px', width: '100px', height: '100px', background: '#ffb3c1', borderRadius: '50%', border: '5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '600', color: '#db2777', textAlign:'center', zIndex: 10 },
  doneBox: { textAlign: 'center', color: '#db2777' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' }
};