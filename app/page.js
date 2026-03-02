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
  const [history, setHistory] = useState([]); // For the Undo button
  const [allData, setAllData] = useState([]); // For the Search tab
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
    "Every flower blooms in its own time.",
    "Your presence makes this garden beautiful.",
    "Bloom where you are planted.",
    "You are a rare bloom in a field of ordinary."
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

      const { data: votedData } = await supabase.from('caption_votes').select('caption_id').eq('profile_id', session.user.id);
      const votedIds = votedData?.map(v => v.caption_id) || [];

      const { data, error } = await supabase.from('captions').select(`id, content, images!image_id ( url ), caption_votes ( vote_value )`).order('id', { ascending: false });
      if (error) throw error;

      const formatted = data.map(cap => {
        const votes = cap.caption_votes || [];
        const ups = votes.filter(v => v.vote_value === 1).length;
        const downs = votes.filter(v => v.vote_value === -1).length;
        return { ...cap, display_url: cap.images?.url || '', upvotes: ups, downvotes: downs, net: ups - downs, hasVoted: votedIds.includes(cap.id) };
      });

      setAllData(formatted);
      setCaptions(formatted.filter(c => !c.hasVoted));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { if (hasMounted) fetchData(); }, [hasMounted, fetchData]);

  // --- ACTIONS ---
  const handleVote = async (value) => {
    if (captions.length === 0) return;
    const currentCard = captions[0];
    setSwipeDir(value === 1 ? 'right' : 'left');
    
    try {
      await supabase.from('caption_votes').upsert({ caption_id: currentCard.id, profile_id: user.id, vote_value: value }, { onConflict: 'caption_id, profile_id' });
      setTimeout(() => {
        setHistory(prev => [currentCard, ...prev]); 
        setCaptions(prev => prev.slice(1)); 
        setSwipeDir('');
      }, 450);
    } catch (err) { setSwipeDir(''); }
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const lastCard = history[0];
    try {
      await supabase.from('caption_votes').delete().match({ caption_id: lastCard.id, profile_id: user.id });
      setHistory(prev => prev.slice(1));
      setCaptions(prev => [lastCard, ...prev]);
    } catch (err) { console.error(err); }
  };

  const handleUploadAndPost = async () => {
    if (!file || !generatedCaption) return alert("Select photo & generate caption!");
    setUploading(true);
    try {
      const fileName = `${Date.now()}.png`;
      await supabase.storage.from('pulse-images').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('pulse-images').getPublicUrl(fileName);
      const { data: imgRec } = await supabase.from('images').insert([{ url: publicUrl, profile_id: user.id }]).select().single();
      await supabase.from('captions').insert([{ content: generatedCaption, image_id: imgRec.id, profile_id: user.id }]);
      setFile(null); setGeneratedCaption(''); setActiveTab('home'); fetchData();
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
  };

  const wallData = useMemo(() => {
    let list = [...allData];
    if (sortMode === 'high') list.sort((a, b) => b.net - a.net);
    if (sortMode === 'low') list.sort((a, b) => a.net - b.net);
    if (searchQuery) list = list.filter(c => c.content?.toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  }, [allData, sortMode, searchQuery]);

  if (!hasMounted) return null;
  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        @keyframes slowRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
        .petal-drift { position: fixed; top: -10%; color: #fbcfe8; font-size: 24px; animation: drift 15s linear infinite; z-index: 0; pointer-events: none; }
        .flower-rotate { animation: slowRotate 50s linear infinite; }
        .swipe-right { animation: swipeRight 0.5s forwards; }
        .swipe-left { animation: swipeLeft 0.5s forwards; }
        @keyframes swipeRight { 100% { transform: translateX(150%) rotate(20deg); opacity: 0; } }
        @keyframes swipeLeft { 100% { transform: translateX(-150%) rotate(-20deg); opacity: 0; } }
      ` }} />

      {[...Array(6)].map((_, i) => (
        <div key={i} className="petal-drift" style={{ left: `${Math.random() * 100}%`, animationDelay: `${i * 2}s` }}>🌸</div>
      ))}

      <nav style={styles.header}><h1 style={styles.logo}>DormPulse.</h1></nav>

      <main style={styles.content}>
        
        {/* HOME: VOTE */}
        {activeTab === 'home' && (
          <div style={styles.centerContainer}>
            {captions.length > 0 ? (
              <>
                <div className={swipeDir==='right'?'swipe-right':swipeDir==='left'?'swipe-left':''} style={styles.pastelCard}>
                  <img src={captions[0].display_url} style={styles.cardImg} alt="Pulse" />
                  <div style={styles.cardBody}>
                    <p style={styles.cardCaption}>“{captions[0].content}”</p>
                    <div style={styles.actionRow}>
                      <button onClick={() => handleVote(-1)} style={styles.trashBtn}>👎</button>
                      <button onClick={() => handleVote(1)} style={styles.fireBtn}>💖</button>
                    </div>
                    <div style={styles.counter}>{captions.length} pulses remaining</div>
                  </div>
                </div>
                <div style={styles.utilityRow}>
                  <button onClick={handleUndo} disabled={history.length===0} style={styles.utilBtn}>↩️ Undo</button>
                  <button onClick={() => setCaptions(prev => [...prev.slice(1), prev[0]])} style={styles.utilBtn}>⏭️ Skip</button>
                </div>
              </>
            ) : <div style={styles.doneBox}><h1>GARDEN CLEAR! 🌸</h1></div>}
          </div>
        )}

        {/* POST: GENERATE */}
        {activeTab === 'post' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <h2 style={{color:'#db2777'}}>Plant Memory</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} />
              <button onClick={() => setGeneratedCaption("Vibes are blooming in the dorm... 🌸")} style={styles.genBtn}>✨ Generate Caption</button>
              <textarea value={generatedCaption} onChange={(e) => setGeneratedCaption(e.target.value)} style={styles.textArea} />
              <button onClick={handleUploadAndPost} disabled={uploading} style={styles.mainBtn}>{uploading ? "Planting..." : "Post Forever"}</button>
            </div>
          </div>
        )}

        {/* GARDEN: SPINNING FLOWER */}
        {activeTab === 'garden' && (
          <div style={styles.centerContainer}>
            <div className="flower-rotate" style={styles.giantFlowerWrapper}>
              {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                <div key={i} style={{...styles.giantPetal, transform: `rotate(${deg}deg) translateY(-140px)`}} onClick={() => setActiveTab('search')}>
                  <div style={{transform: `rotate(-${deg}deg)`, fontSize:'10px', color:'white'}}>View Wall</div>
                </div>
              ))}
              <div style={styles.giantCenter}>Dorm<br/>Pulse</div>
            </div>
          </div>
        )}

        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <div style={styles.searchView}>
            <input placeholder="Search captions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchBar} />
            <div style={{display:'flex', gap:'5px', marginBottom:'15px'}}><button onClick={() => setSortMode('high')} style={styles.miniBtn}>Top Voted</button></div>
            {wallData.map(c => (
              <div key={c.id} style={styles.feedItem}>
                <img src={c.display_url} style={styles.feedImg} />
                <div style={styles.feedPadding}>“{c.content}” <br/> 💖 {c.upvotes}</div>
              </div>
            ))}
          </div>
        )}

        {/* ACCOUNT: ME & ABOUT */}
        {activeTab === 'account' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <div style={styles.avatar}>{user?.email?.charAt(0)}</div>
              <h3>{user?.email?.split('@')[0]}</h3>
              <p>"{affirmation}"</p>
              <div style={styles.aboutBox}>
                <h4>About Nabiha's Project</h4>
                <p>A shared garden of memories, built with love and code. 🌸</p>
              </div>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>Logout</button>
            </div>
          </div>
        )}

      </main>

      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={styles.navBtn}>🏠<br/>Vote</button>
        <button onClick={() => setActiveTab('post')} style={styles.navBtn}>➕<br/>Post</button>
        <button onClick={() => setActiveTab('garden')} style={styles.navBtn}>🌸<br/>Garden</button>
        <button onClick={() => setActiveTab('search')} style={styles.navBtn}>🔍<br/>Search</button>
        <button onClick={() => setActiveTab('account')} style={styles.navBtn}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif", backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-1-3-4-5-7-5-4 0-7 3-7 7 0 3 2 6 5 7-3 1-5 4-5 7 0 4 3 7 7 7 3 0 6-2 7-5 1 3 4 5 7 5 4 0 7-3 7-7 0-3-2-6-5-7 3-1 5-4 5-7 0-4-3-7-7-7-3 0-6 2-7 5z' fill='%23fbcfe8' fill-opacity='0.2'/%3E%3C/svg%3E")` },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  logo: { fontSize: '22px', color: '#db2777', fontWeight: '600' },
  content: { paddingTop: '70px', paddingBottom: '100px' },
  centerContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', minHeight: '75vh' },
  pastelCard: { background: '#fff', borderRadius: '35px', width: '100%', maxWidth: '350px', overflow: 'hidden', border: '4px solid #fbcfe8', boxShadow: '0 15px 30px rgba(0,0,0,0.05)', position: 'relative', zIndex: 2 },
  cardImg: { width: '100%', height: '280px', objectFit: 'cover' },
  cardBody: { padding: '20px', textAlign: 'center' },
  cardCaption: { fontSize: '18px', fontWeight: '600', marginBottom: '15px' },
  actionRow: { display: 'flex', gap: '10px' },
  fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '12px', borderRadius: '15px', border: 'none', fontSize: '18px' },
  trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '12px', borderRadius: '15px', border: 'none', fontSize: '18px' },
  utilityRow: { display:'flex', gap:'20px', marginTop: '15px' },
  utilBtn: { background: '#fff', border: '2px solid #fbcfe8', padding: '8px 15px', borderRadius: '12px', color: '#db2777', fontSize: '13px' },
  counter: { marginTop: '10px', fontSize: '10px', color: '#db2777', opacity: 0.6 },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '80px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3', zIndex: 1000 },
  navBtn: { border: 'none', background: 'none', color: '#db2777', fontSize: '11px', fontWeight: '600' },
  giantFlowerWrapper: { position: 'relative', width: '100px', height: '100px' },
  giantPetal: { position: 'absolute', width: '80px', height: '120px', background: 'linear-gradient(#ff85a2, #db2777)', borderRadius: '40px', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid white' },
  giantCenter: { position: 'absolute', width: '60px', height: '60px', background: '#ffb3c1', borderRadius: '50%', top: '20px', left: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#db2777', textAlign: 'center', border: '3px solid white', zIndex: 10 },
  uploadCard: { background: '#fff', padding: '25px', borderRadius: '30px', border: '3px solid #fbcfe8', width: '90%', maxWidth: '380px', textAlign: 'center' },
  textArea: { width: '100%', height: '80px', borderRadius: '15px', border: '1px solid #fbcfe8', padding: '10px', margin: '10px 0' },
  genBtn: { background: '#f3e8ff', border: '1px solid #d8b4fe', padding: '8px', borderRadius: '10px', color: '#7c3aed', fontSize: '12px', cursor: 'pointer' },
  mainBtn: { width: '100%', padding: '12px', background: '#db2777', color: '#fff', borderRadius: '15px', border: 'none', fontWeight: '600' },
  searchView: { padding: '20px', maxWidth: '450px', margin: '0 auto' },
  searchBar: { width: '100%', padding: '12px', borderRadius: '15px', border: '2px solid #fbcfe8', marginBottom: '10px' },
  feedItem: { background: '#fff', borderRadius: '20px', marginBottom: '15px', overflow: 'hidden' },
  feedImg: { width: '100%', height: '150px', objectFit: 'cover' },
  feedPadding: { padding: '10px', fontSize: '14px' },
  avatar: { width: '50px', height: '50px', background: '#fbcfe8', borderRadius: '50%', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' },
  aboutBox: { marginTop: '20px', padding: '15px', background: '#fff5f7', borderRadius: '15px', fontSize: '12px' },
  logoutBtn: { marginTop: '15px', width: '100%', padding: '10px', border: '1px solid #db2777', borderRadius: '10px', color: '#db2777', background: 'none' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' },
  miniBtn: { background: '#fbcfe8', border: 'none', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', color: '#db2777' },
  doneBox: { textAlign: 'center', color: '#db2777' }
};