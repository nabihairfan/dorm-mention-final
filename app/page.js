'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormPulseGarden() {
  const router = useRouter();
  
  // App Core States
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]); 
  const [history, setHistory] = useState([]); 
  const [activeTab, setActiveTab] = useState('home'); 
  const [hasMounted, setHasMounted] = useState(false);
  const [swipeDir, setSwipeDir] = useState(''); 
  const [affirmation, setAffirmation] = useState('');

  // Search/Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('all'); 

  // Upload/Post States
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState('');

  const phrases = useMemo(() => [
    "Every flower blooms in its own time. You are doing great.",
    "Your presence makes this garden more beautiful.",
    "Bloom where you are planted, and keep reaching for the sun.",
    "Like a seedling, you are stronger than you know.",
    "Take a deep breath. Even the garden rests sometimes."
  ], []);

  useEffect(() => {
    setHasMounted(true);
    setAffirmation(phrases[Math.floor(Math.random() * phrases.length)]);
  }, [phrases]);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // 1. Get user's existing votes to prevent "Refresh Reset"
      const { data: votedData } = await supabase
        .from('caption_votes')
        .select('caption_id')
        .eq('profile_id', session.user.id);
      
      const votedIds = votedData?.map(v => v.caption_id) || [];

      // 2. Get all captions + vote counts
      const { data, error } = await supabase
        .from('captions')
        .select(`id, content, images!image_id ( url ), caption_votes ( vote_value )`)
        .order('id', { ascending: false });

      if (error) throw error;

      const formatted = data.map(cap => {
        const votes = cap.caption_votes || [];
        const ups = votes.filter(v => v.vote_value === 1).length;
        const downs = votes.filter(v => v.vote_value === -1).length;
        return {
          ...cap,
          display_url: cap.images?.url || 'https://via.placeholder.com/400',
          upvotes: ups,
          downvotes: downs,
          net: ups - downs,
          hasVoted: votedIds.includes(cap.id)
        };
      });

      // Update the voting queue (unvoted items only)
      setCaptions(formatted.filter(c => !c.hasVoted));
      // Save all for the Search/Wall tab
      setHistory(formatted); 

    } catch (err) { console.error("Fetch error:", err); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { if (hasMounted) fetchData(); }, [hasMounted, fetchData]);

  // --- ACTIONS ---

  const handleVote = async (value) => {
    if (captions.length === 0) return;
    const currentCard = captions[0];
    setSwipeDir(value === 1 ? 'right' : 'left');
    
    try {
      await supabase.from('caption_votes').upsert({
        caption_id: currentCard.id, profile_id: user.id, vote_value: value,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });
      
      setTimeout(() => {
        setCaptions(prev => prev.slice(1)); 
        setSwipeDir('');
      }, 450);
    } catch (err) { setSwipeDir(''); }
  };

  const handleSkip = () => {
    if (captions.length <= 1) return;
    setCaptions(prev => {
      const [first, ...rest] = prev;
      return [...rest, first];
    });
  };

  const handleUploadAndPost = async () => {
    if (!file || !generatedCaption) return alert("Please select a photo and enter a caption!");
    setUploading(true);
    try {
      const fileName = `${user.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: storageError } = await supabase.storage.from('pulse-images').upload(fileName, file);
      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage.from('pulse-images').getPublicUrl(fileName);

      const { data: imgRec } = await supabase.from('images').insert([{ url: publicUrl, profile_id: user.id }]).select().single();
      await supabase.from('captions').insert([{ content: generatedCaption, image_id: imgRec.id, profile_id: user.id }]);

      setFile(null); setGeneratedCaption(''); setActiveTab('home');
      fetchData();
    } catch (err) { alert("Upload failed!"); }
    finally { setUploading(false); }
  };

  // --- FILTERED DATA FOR WALL ---
  const wallData = useMemo(() => {
    let list = [...history];
    if (sortMode === 'high') list.sort((a, b) => b.net - a.net);
    if (sortMode === 'low') list.sort((a, b) => a.net - b.net);
    if (searchQuery.trim()) {
      list = list.filter(c => c.content?.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [history, sortMode, searchQuery]);

  if (!hasMounted) return null;
  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        .swipe-right { animation: swipeRight 0.5s forwards; }
        .swipe-left { animation: swipeLeft 0.5s forwards; }
        @keyframes swipeRight { 100% { transform: translateX(150%) rotate(20deg); opacity: 0; } }
        @keyframes swipeLeft { 100% { transform: translateX(-150%) rotate(-20deg); opacity: 0; } }
      ` }} />

      <nav style={styles.header}><h1 style={styles.logo}>DormPulse.</h1></nav>

      <main style={styles.content}>
        
        {/* HOME: VOTING QUEUE */}
        {activeTab === 'home' && (
          <div style={styles.centerContainer}>
            {captions.length > 0 ? (
              <>
                <div className={swipeDir === 'right' ? 'swipe-right' : swipeDir === 'left' ? 'swipe-left' : ''} style={styles.pastelCard}>
                  <img src={captions[0].display_url} style={styles.cardImg} alt="Pulse" />
                  <div style={styles.cardBody}>
                    <p style={styles.cardCaption}>“{captions[0].content}”</p>
                    <div style={styles.actionRow}>
                      <button onClick={() => handleVote(-1)} style={styles.trashBtn}>👎</button>
                      <button onClick={() => handleVote(1)} style={styles.fireBtn}>💖</button>
                    </div>
                    <div style={styles.counter}>{captions.length} pulses left</div>
                  </div>
                </div>
                <button onClick={handleSkip} style={styles.skipBtn}>⏭️ Skip for now</button>
              </>
            ) : (
              <div style={styles.doneBox}><h1>GARDEN CLEAR! 🌸</h1><button onClick={fetchData} style={styles.resetBtn}>Check for New Blooms</button></div>
            )}
          </div>
        )}

        {/* POST: UPLOAD NEW PULSE */}
        {activeTab === 'post' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <h2 style={{color: '#db2777'}}>New Memory</h2>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
              <textarea placeholder="Write a caption..." value={generatedCaption} onChange={(e) => setGeneratedCaption(e.target.value)} style={styles.textArea} />
              <button onClick={handleUploadAndPost} disabled={uploading} style={styles.mainBtn}>
                {uploading ? "Planting..." : "Post to Garden 🌸"}
              </button>
            </div>
          </div>
        )}

        {/* WALL: SEARCH & SORT */}
        {activeTab === 'wall' && (
          <div style={styles.searchView}>
            <input placeholder="Search memories..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchBar} />
            <div style={{display:'flex', gap:'10px', marginBottom:'20px', justifyContent:'center'}}>
              <button onClick={() => setSortMode('all')} style={styles.miniBtn}>All</button>
              <button onClick={() => setSortMode('high')} style={styles.miniBtn}>Top</button>
            </div>
            {wallData.map(c => (
              <div key={c.id} style={styles.feedItem}>
                <img src={c.display_url} style={styles.feedImg} alt="Memory" />
                <div style={styles.feedPadding}>
                  <p>“{c.content}”</p>
                  <div style={{color:'#db2777', fontWeight:'600'}}>💖 {c.upvotes} | 👎 {c.downvotes}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ACCOUNT: ME & ABOUT */}
        {activeTab === 'account' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <div style={styles.avatar}>{user?.email?.charAt(0).toUpperCase()}</div>
              <h3>Hi, {user?.email?.split('@')[0]}!</h3>
              <p style={styles.affirmationStyle}>"{affirmation}"</p>
              <hr style={{border:'0.5px solid #fce7f3', margin:'20px 0'}} />
              <p style={{fontSize:'12px', color:'#666'}}>DormPulse by <strong>Nabiha Irfan</strong></p>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>Logout</button>
            </div>
          </div>
        )}

      </main>

      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={{...styles.navBtn, color: activeTab==='home'?'#db2777':'#9ca3af'}}>🏠<br/>Vote</button>
        <button onClick={() => setActiveTab('post')} style={{...styles.navBtn, color: activeTab==='post'?'#db2777':'#9ca3af'}}>➕<br/>Post</button>
        <button onClick={() => setActiveTab('wall')} style={{...styles.navBtn, color: activeTab==='wall'?'#db2777':'#9ca3af'}}>🔍<br/>Wall</button>
        <button onClick={() => setActiveTab('account')} style={{...styles.navBtn, color: activeTab==='account'?'#db2777':'#9ca3af'}}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #fce7f3', zIndex: 1000 },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { paddingTop: '80px', paddingBottom: '100px' },
  centerContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', minHeight: '70vh' },
  pastelCard: { background: '#fff', borderRadius: '35px', width: '100%', maxWidth: '360px', overflow: 'hidden', border: '4px solid #fbcfe8', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
  cardImg: { width: '100%', height: '300px', objectFit: 'cover' },
  cardBody: { padding: '25px', textAlign: 'center' },
  cardCaption: { fontSize: '20px', fontWeight: '600', marginBottom: '15px' },
  actionRow: { display: 'flex', gap: '15px' },
  fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '15px', borderRadius: '20px', border: 'none', fontSize: '20px', cursor: 'pointer' },
  trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '15px', borderRadius: '20px', border: 'none', fontSize: '20px', cursor: 'pointer' },
  counter: { marginTop: '15px', fontSize: '11px', color: '#db2777', opacity: 0.6, fontWeight: '600' },
  skipBtn: { marginTop: '20px', background: '#f3e8ff', border: 'none', padding: '10px 20px', borderRadius: '15px', color: '#7c3aed', fontWeight: '600', cursor: 'pointer' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '80px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3' },
  navBtn: { border: 'none', background: 'none', fontWeight: '600', fontSize: '11px', cursor: 'pointer' },
  uploadCard: { background: '#fff', padding: '30px', borderRadius: '30px', border: '3px solid #fbcfe8', width: '90%', maxWidth: '400px', textAlign: 'center' },
  fileInput: { marginBottom: '15px', width: '100%' },
  textArea: { width: '100%', height: '100px', borderRadius: '15px', border: '2px solid #fbcfe8', padding: '10px', marginBottom: '15px', outline: 'none' },
  mainBtn: { width: '100%', padding: '12px', borderRadius: '15px', background: '#db2777', color: 'white', border: 'none', fontWeight: '600', cursor: 'pointer' },
  searchView: { padding: '20px', maxWidth: '500px', margin: '0 auto' },
  searchBar: { width: '100%', padding: '12px', borderRadius: '15px', border: '2px solid #fbcfe8', marginBottom: '15px', outline: 'none' },
  miniBtn: { background: '#fff', border: '1px solid #fbcfe8', padding: '5px 15px', borderRadius: '10px', fontSize: '12px', color: '#db2777' },
  feedItem: { background: '#fff', borderRadius: '20px', marginBottom: '20px', overflow: 'hidden', border: '1px solid #fce7f3' },
  feedImg: { width: '100%', height: '200px', objectFit: 'cover' },
  feedPadding: { padding: '15px' },
  avatar: { width: '60px', height: '60px', background: '#fbcfe8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', fontSize: '24px', color: '#db2777' },
  affirmationStyle: { fontStyle: 'italic', color: '#db2777', fontSize: '14px' },
  logoutBtn: { marginTop: '20px', width: '100%', padding: '10px', borderRadius: '15px', border: '2px solid #db2777', color: '#db2777', background: 'none', fontWeight: '600' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777', fontWeight: '600' },
  doneBox: { textAlign: 'center' },
  resetBtn: { color: '#db2777', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }
};