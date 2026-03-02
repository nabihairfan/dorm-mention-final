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

      const { data, error } = await supabase
        .from('captions')
        .select(`id, content, profile_id, images!image_id ( url ), caption_votes ( vote_value )`)
        .order('id', { ascending: false });

      if (error) throw error;

      const formatted = data.map(cap => {
        const votes = cap.caption_votes || [];
        const ups = votes.filter(v => v.vote_value === 1).length;
        const downs = votes.filter(v => v.vote_value === -1).length;
        return {
          ...cap,
          content: cap.content || "No caption provided", // Fixes the null error
          display_url: cap.images?.url || 'https://via.placeholder.com/400',
          upvotes: ups, downvotes: downs, net: ups - downs
        };
      });
      setCaptions(formatted);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { if (hasMounted) fetchData(); }, [hasMounted, fetchData]);

  const handleVote = async (captionId, value) => {
    setSwipeDir(value === 1 ? 'right' : 'left');
    setHistory(prev => [...prev, currentIndex]);
    try {
      await supabase.from('caption_votes').upsert({
        caption_id: captionId, profile_id: user.id, vote_value: value,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });
      
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setSwipeDir('');
        fetchData();
      }, 450);
    } catch (err) { setSwipeDir(''); }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastIndex = history[history.length - 1];
    setCurrentIndex(lastIndex);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleUploadAndPost = async () => {
    if (!selectedFile) return alert("Please pick a photo first!");
    setUploading(true);
    try {
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('garden-photos').upload(fileName, selectedFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('garden-photos').getPublicUrl(fileName);

      const aiCaptions = ["Blooming vibes in the dorm!", "Fresh pulse, fresh start.", "Garden magic ✨"];
      const finalCaption = postCaption || aiCaptions[Math.floor(Math.random() * aiCaptions.length)];

      const { data: imgRow } = await supabase.from('images').insert([{ url: publicUrl }]).select().single();
      await supabase.from('captions').insert([{ 
        content: finalCaption, 
        image_id: imgRow.id, 
        profile_id: user.id 
      }]);

      alert("Planted successfully!");
      setPostCaption(''); setSelectedFile(null);
      await fetchData();
      setActiveTab('seeUploads');
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
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
    if (searchQuery.trim()) {
      list = list.filter(c => c.content?.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [captions, sortMode, searchQuery]);

  if (!hasMounted) return null;
  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Gardener";

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        @keyframes slowRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); } 100% { transform: translateY(110vh) rotate(360deg); } }
        .petal-drift { position: fixed; top: -10%; color: #fbcfe8; animation: drift 8s linear infinite; z-index: 0; pointer-events: none; }
        .flower-rotate { animation: slowRotate 50s linear infinite; }
        .swipe-right { animation: swipeRight 0.5s forwards; }
        .swipe-left { animation: swipeLeft 0.5s forwards; }
        @keyframes swipeRight { 100% { transform: translateX(150%) rotate(20deg); opacity: 0; } }
        @keyframes swipeLeft { 100% { transform: translateX(-150%) rotate(-20deg); opacity: 0; } }
      ` }} />

      {[...Array(12)].map((_, i) => (
        <div key={i} className="petal-drift" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 5}s` }}>🌸</div>
      ))}

      <nav style={styles.header}><h1 style={styles.logo}>DormPulse.</h1></nav>

      <main style={styles.content}>
        {/* TAB: VOTE (HOME) */}
        {activeTab === 'home' && (
          <div style={styles.centerContainer}>
            <div style={styles.counterBadge}>{captions.length - currentIndex} Pulses Left 🌷</div>
            {currentIndex < captions.length ? (
              <div style={{width: '100%', maxWidth: '360px'}}>
                <div className={swipeDir === 'right' ? 'swipe-right' : swipeDir === 'left' ? 'swipe-left' : ''} style={styles.pastelCard}>
                  <img src={captions[currentIndex].display_url} style={styles.cardImg} />
                  <div style={styles.cardBody}>
                    <p style={styles.cardCaption}>“{captions[currentIndex].content}”</p>
                    <div style={styles.actionRow}>
                      <button onClick={() => handleVote(captions[currentIndex].id, -1)} style={styles.trashBtn}>👎</button>
                      <button onClick={() => handleVote(captions[currentIndex].id, 1)} style={styles.fireBtn}>💖</button>
                    </div>
                  </div>
                </div>
                {history.length > 0 && <button onClick={handleUndo} style={styles.undoBtn}>↩️ Oops, undo last vote</button>}
              </div>
            ) : <div style={styles.doneBox}><h1>FINITO! 🌸</h1><button onClick={() => {setCurrentIndex(0); setHistory([]);}} style={styles.resetBtn}>Restart Garden</button></div>}
          </div>
        )}

        {/* TAB: BIG FLOWER GARDEN (RESTORED) */}
        {activeTab === 'wall' && (
          <div style={styles.centerContainer}>
            <div className="flower-rotate" style={styles.giantFlowerWrapper}>
              {[
                { deg: 0, lab: 'All Seeds', mode: 'all' },
                { deg: 60, lab: 'Top Voted', mode: 'high' },
                { deg: 120, lab: 'Fresh Seeds', mode: 'low' },
                { deg: 180, lab: 'All Seeds', mode: 'all' },
                { deg: 240, lab: 'Top Voted', mode: 'high' },
                { deg: 300, lab: 'Fresh Seeds', mode: 'low' }
              ].map((petal, i) => (
                <div key={i} style={{...styles.giantPetal, transform: `rotate(${petal.deg}deg) translateY(-140px)`}} 
                     onClick={() => { setSortMode(petal.mode); setActiveTab('search'); }}>
                  <div style={{transform: `rotate(-${petal.deg}deg)`, fontSize: '11px', fontWeight:'600', color:'#fff', textAlign:'center'}}>
                    {petal.lab}
                  </div>
                </div>
              ))}
              <div style={styles.giantCenter}>Dorm<br/>Pulse</div>
            </div>
          </div>
        )}

        {/* TAB: SEARCH FEED */}
        {activeTab === 'search' && (
          <div style={styles.searchView}>
            <input style={styles.searchBar} placeholder="Search the garden..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {filteredCaptions.map(c => (
              <div key={c.id} style={styles.feedItem}>
                <img src={c.display_url} style={styles.feedImg} />
                <div style={styles.feedPadding}>
                  <p style={styles.feedText}>“{c.content}”</p>
                  <div style={styles.voteDisplay}><span>👍 {c.upvotes}</span><span>👎 {c.downvotes}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: POST (AI GENERATION) */}
        {activeTab === 'post' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <h2 style={{color: '#db2777'}}>Plant a Memory</h2>
              <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} style={styles.fileInput} />
              <textarea style={styles.searchBar} placeholder="Write a caption or leave blank for AI magic..." value={postCaption} onChange={(e) => setPostCaption(e.target.value)} />
              <button onClick={handleUploadAndPost} disabled={uploading} style={styles.aboutBtn}>
                {uploading ? "Blooming..." : "✨ Generate & Plant"}
              </button>
            </div>
          </div>
        )}

        {/* TAB: SEE UPLOADS (GROUPED) */}
        {activeTab === 'seeUploads' && (
          <div style={styles.searchView}>
            <h2 style={{color:'#db2777', textAlign:'center', marginBottom: '20px'}}>The Collective Garden</h2>
            {groupedUploads.map(([profileId, userPosts]) => (
              <div key={profileId} style={styles.userSection}>
                <h3 style={styles.userHeading}>{profileId === user?.id ? "✨ My Uploads" : `Gardener ${profileId.substring(0, 5)}`}</h3>
                <div style={styles.horizontalScroll}>
                  {userPosts.map(p => (
                    <div key={p.id} style={styles.miniCard}>
                      <img src={p.display_url} style={styles.miniImg} />
                      <p style={styles.miniText}>{p.content?.substring(0, 20)}...</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: ME */}
        {activeTab === 'account' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <div style={styles.avatar}>{userName.charAt(0).toUpperCase()}</div>
              <h3>Hi, {userName}!</h3>
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
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif", overflowX: 'hidden' },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #fce7f3', zIndex: 1000 },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 },
  centerContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px 100px' },
  counterBadge: { background: '#fbcfe8', padding: '10px 20px', borderRadius: '20px', color: '#db2777', fontWeight: '600', marginBottom: '20px' },
  undoBtn: { background: 'none', border: 'none', color: '#666', textDecoration: 'underline', marginTop: '15px', width: '100%', cursor: 'pointer' },
  pastelCard: { background: '#fff', borderRadius: '35px', width: '100%', overflow: 'hidden', border: '4px solid #fbcfe8', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
  cardImg: { width: '100%', maxHeight: '45vh', objectFit: 'cover' },
  cardBody: { padding: '25px', textAlign: 'center' },
  cardCaption: { fontSize: '20px', fontWeight: '600', color: '#333' },
  actionRow: { display: 'flex', gap: '15px', marginTop: '15px' },
  fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '18px' },
  trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '18px' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '85px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3', zIndex: 1000 },
  navBtn: { border: 'none', background: 'none', color: '#db2777', fontWeight: '600', fontSize: '11px', cursor: 'pointer' },
  uploadCard: { background: '#fff', padding: '30px', borderRadius: '30px', textAlign: 'center', border: '3px solid #fbcfe8', width: '100%', maxWidth: '400px' },
  fileInput: { margin: '20px 0', fontSize: '14px' },
  searchBar: { width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #fbcfe8', marginBottom: '15px', outline: 'none', resize: 'none' },
  aboutBtn: { width: '100%', padding: '15px', borderRadius: '15px', background: '#db2777', color: '#fff', border: 'none', fontWeight: '600', cursor: 'pointer' },
  userSection: { marginBottom: '30px' },
  userHeading: { fontSize: '14px', color: '#db2777', paddingLeft: '15px', marginBottom: '10px', fontWeight: '600' },
  horizontalScroll: { display: 'flex', gap: '15px', overflowX: 'auto', padding: '10px 15px', scrollbarWidth: 'none' },
  miniCard: { minWidth: '120px', background: '#fff', borderRadius: '15px', overflow: 'hidden', border: '1px solid #fce7f3' },
  miniImg: { width: '120px', height: '120px', objectFit: 'cover' },
  miniText: { fontSize: '10px', padding: '5px', textAlign: 'center', color: '#666' },
  searchView: { paddingTop: '80px', paddingBottom: '100px', width: '100%', maxWidth: '500px', margin: '0 auto' },
  feedItem: { background: '#fff', borderRadius: '25px', marginBottom: '20px', overflow: 'hidden', border: '2px solid #fce7f3' },
  feedImg: { width: '100%', height: 'auto' },
  feedPadding: { padding: '15px' },
  feedText: { fontWeight: '600', fontSize: '16px' },
  voteDisplay: { display: 'flex', gap: '15px', marginTop: '10px', color: '#db2777', fontWeight: '600' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777', background: '#fff5f7' },
  doneBox: { textAlign: 'center' },
  resetBtn: { marginTop: '20px', color: '#db2777', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' },
  logoutBtn: { width: '100%', padding: '12px', borderRadius: '15px', border: '2px solid #db2777', background: 'none', color: '#db2777', fontWeight: '600', cursor: 'pointer' },
  avatar: { width: '80px', height: '80px', background: '#fbcfe8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#db2777', fontSize: '30px', fontWeight: '600' },
  giantFlowerWrapper: { position: 'relative', width: '150px', height: '150px' },
  giantPetal: { position: 'absolute', width: '110px', height: '160px', background: 'linear-gradient(to bottom, #ff85a2, #db2777)', borderRadius: '50% 50% 50% 50% / 80% 80% 20% 20%', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', left: '20px', boxShadow: '0 8px 20px rgba(219,39,119,0.3)' },
  giantCenter: { position: 'absolute', top: '25px', left: '25px', width: '100px', height: '100px', background: '#ffb3c1', borderRadius: '50%', border: '5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '600', color: '#db2777', textAlign:'center', zIndex: 10 }
};