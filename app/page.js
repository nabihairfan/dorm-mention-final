'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormPulseGarden() {
  const router = useRouter();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]); 
  const [allData, setAllData] = useState([]); 
  const [userUploads, setUserUploads] = useState({});
  const [activeTab, setActiveTab] = useState('home'); 
  const [hasMounted, setHasMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('all');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState('');
// Add this new state at the top with your other states
const [sessionVotes, setSessionVotes] = useState(new Set());

const fetchData = useCallback(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');
    setUser(session.user);

    // 1. Get official votes from DB
    const { data: userVotes } = await supabase
      .from('caption_votes')
      .select('caption_id, vote_value')
      .eq('profile_id', session.user.id);
    
    const userVoteMap = Object.fromEntries(userVotes?.map(v => [v.caption_id, v.vote_value]) || []);

    // 2. Fetch all data
    const { data, error } = await supabase
      .from('captions')
      .select(`
        id, content, image_id, profile_id, 
        images!image_id ( url ), 
        caption_votes ( vote_value ), 
        profiles:profile_id ( email )
      `)
      .order('id', { ascending: false });

    if (error) throw error;

    const formatted = data
      .filter(cap => cap.content?.trim())
      .map(cap => {
        const votes = cap.caption_votes || [];
        const ups = votes.filter(v => v.vote_value === 1).length;
        const downs = votes.filter(v => v.vote_value === -1).length;
        return { 
          ...cap, 
          display_url: cap.images?.url || '', 
          upvotes: ups, 
          downvotes: downs, 
          net: ups - downs, 
          userVote: userVoteMap[cap.id] !== undefined ? userVoteMap[cap.id] : null,
          uploader: cap.profiles?.email?.split('@')[0] || 'Gardener'
        };
      });

    setAllData(formatted);

    // 3. THE FIX: Filter out items in the official DB AND items we just clicked in this session
    setCaptions(formatted.filter(c => 
      c.userVote === null && !sessionVotes.has(c.id)
    ));

  } catch (err) { console.error(err); } 
  finally { setLoading(false); }
}, [router, sessionVotes]); // Added sessionVotes to dependency

const handleVote = async (captionId, value) => {
  // 1. Instantly add to our "ignore list" for this session
  setSessionVotes(prev => new Set(prev).add(captionId));
  
  // 2. Instantly remove from the current view
  setCaptions(prev => prev.filter(c => c.id !== captionId));

  try {
    const { error } = await supabase.from('caption_votes').upsert({ 
      caption_id: captionId, 
      profile_id: user.id, 
      vote_value: value 
    }, { onConflict: 'caption_id, profile_id' });
    
    if (error) throw error;
    
    // We don't even need to call fetchData() immediately here 
    // because the UI is already updated. Let's wait a beat.
    setTimeout(() => fetchData(), 500); 

  } catch (err) { 
    console.error("Vote Error:", err); 
    // If it actually fails, we could remove it from sessionVotes to let them try again
  }
};

  const handleUploadAndPost = async () => {
    if (!file || !generatedCaption) return alert("Select photo & generate caption!");
    setUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}.png`;
      await supabase.storage.from('pulse-images').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('pulse-images').getPublicUrl(fileName);
      const { data: imgRec } = await supabase.from('images').insert([{ url: publicUrl, profile_id: user.id }]).select().single();
      await supabase.from('captions').insert([{ content: generatedCaption, image_id: imgRec.id, profile_id: user.id }]);
      setFile(null); setGeneratedCaption(''); setActiveTab('home'); fetchData();
    } catch (err) { alert("Upload failed"); }
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
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
        .petal-drift { position: fixed; top: -10%; color: #fbcfe8; font-size: 24px; animation: drift 15s linear infinite; z-index: 0; pointer-events: none; }
        .flower-rotate { animation: rotate 50s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        button { cursor: pointer; transition: transform 0.1s active; }
        button:active { transform: scale(0.95); }
      ` }} />

      {/* FIXED: added pointer-events: none to petals */}
      {[...Array(6)].map((_, i) => (
        <div key={i} className="petal-drift" style={{ left: `${(i * 20) % 100}%`, animationDelay: `${i * 2}s`, pointerEvents: 'none' }}>🌸</div>
      ))}

      <nav style={styles.header}>
        <button onClick={() => setSidebarOpen(true)} style={styles.menuBtn}>☰</button>
        <h1 style={styles.logo}>DormPulse.</h1>
        <div style={{width: 40}}></div>
      </nav>

      {sidebarOpen && (
        <div style={styles.sidebar}>
          <button onClick={() => setSidebarOpen(false)} style={styles.closeBtn}>✕</button>
          <div style={styles.sideLinks}>
            {['home', 'post', 'garden', 'search', 'account'].map(t => (
              <button key={t} onClick={() => { setActiveTab(t); setSidebarOpen(false); }} style={styles.sideBtn}>{t.toUpperCase()}</button>
            ))}
          </div>
        </div>
      )}

      <main style={styles.content}>
        {activeTab === 'home' && (
          <div style={styles.centerContainer}>
            {captions.length > 0 ? (
              <div style={styles.pastelCard}>
                <img src={captions[0].display_url} style={styles.cardImg} alt="Pulse" />
                <div style={styles.cardBody}>
                  <p style={styles.cardCaption}>“{captions[0].content}”</p>
                  <div style={styles.actionRow}>
                    <button onClick={() => handleVote(captions[0].id, -1)} style={styles.trashBtn}>👎</button>
                    <button onClick={() => handleVote(captions[0].id, 1)} style={styles.fireBtn}>💖</button>
                  </div>
                </div>
              </div>
            ) : <div style={{textAlign:'center', color:'#db2777'}}><h1>GARDEN CLEAR! 🏁</h1><button onClick={fetchData} style={styles.refreshBtn}>Refresh</button></div>}
          </div>
        )}

        {/* ... Rest of your tabs (Garden, Search, Post, Account) remain same as previous version ... */}
        {activeTab === 'garden' && (
          <div style={styles.centerContainer}>
            <div className="flower-rotate" style={styles.giantFlowerWrapper}>
              {[{deg:0,l:'All',m:'all'},{deg:90,l:'High',m:'high'},{deg:180,l:'Low',m:'low'},{deg:270,l:'Recent',m:'recent'}].map((p, i) => (
                <div key={i} style={{...styles.giantPetal, transform: `rotate(${p.deg}deg) translateY(-140px)`}} onClick={() => { setSortMode(p.m); setActiveTab('search'); }}>
                  <div style={{transform: `rotate(-${p.deg}deg)`, color:'white'}}>{p.l}</div>
                </div>
              ))}
              <div style={styles.giantCenter}>Dorm<br/>Pulse</div>
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div style={styles.searchView}>
            <input placeholder="Search..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} style={styles.searchBar} />
            <div style={styles.wallFeed}>
              {wallData.map(c => (
                <div key={c.id} style={styles.feedItem}>
                  <img src={c.display_url} style={styles.feedImg} />
                  <div style={styles.feedPadding}>
                    <p>“{c.content}”</p>
                    <div style={styles.actionRowSmall}>
                       <button onClick={() => handleVote(c.id, 1)} style={styles.miniVoteBtn}>💖 {c.upvotes}</button>
                       <button onClick={() => handleVote(c.id, -1)} style={styles.miniVoteBtn}>👎 {c.downvotes}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={styles.navBtn}>🏠</button>
        <button onClick={() => setActiveTab('post')} style={styles.navBtn}>➕</button>
        <button onClick={() => setActiveTab('garden')} style={styles.navBtn}>🌸</button>
        <button onClick={() => setActiveTab('search')} style={styles.navBtn}>🔍</button>
        <button onClick={() => setActiveTab('account')} style={styles.navBtn}>👤</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 1000, borderBottom: '1px solid #fce7f3' },
  menuBtn: { fontSize: '24px', background: 'none', border: 'none', color: '#db2777' },
  sidebar: { position: 'fixed', top: 0, left: 0, width: '250px', height: '100vh', background: 'white', zIndex: 2000, padding: '20px', boxShadow: '5px 0 15px rgba(0,0,0,0.1)' },
  sideLinks: { display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' },
  sideBtn: { background: 'none', border: 'none', textAlign: 'left', fontSize: '18px', color: '#db2777', fontWeight: '600' },
  closeBtn: { position: 'absolute', top: 20, right: 20, border: 'none', background: 'none', fontSize: '20px' },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { paddingTop: '80px', paddingBottom: '100px', position: 'relative', zIndex: 10 },
  centerContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' },
  pastelCard: { background: '#fff', borderRadius: '35px', width: '90%', maxWidth: '380px', border: '4px solid #fbcfe8', overflow: 'hidden', zIndex: 50 },
  cardImg: { width: '100%', height: '350px', objectFit: 'cover' },
  cardBody: { padding: '25px', textAlign: 'center' },
  cardCaption: { fontSize: '20px', fontWeight: '600', marginBottom: '15px' },
  actionRow: { display: 'flex', gap: '15px', position: 'relative', zIndex: 100 },
  fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '15px', borderRadius: '20px', border: 'none', fontSize: '22px' },
  trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '15px', borderRadius: '20px', border: 'none', fontSize: '22px' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '70px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3', zIndex: 1000 },
  navBtn: { border: 'none', background: 'none', fontSize: '24px' },
  giantFlowerWrapper: { position: 'relative', width: '120px', height: '120px' },
  giantPetal: { position: 'absolute', width: '90px', height: '130px', background: 'linear-gradient(#ff85a2, #db2777)', borderRadius: '45px', display:'flex', alignItems:'center', justifyContent:'center', border:'3px solid white' },
  giantCenter: { position: 'absolute', width: '80px', height: '80px', background: '#ffb3c1', borderRadius: '50%', top: '20px', left: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#db2777', textAlign: 'center', border: '3px solid white', zIndex: 10 },
  searchView: { padding: '0 20px', maxWidth: '600px', margin: '0 auto' },
  searchBar: { width: '100%', padding: '15px', borderRadius: '20px', border: '2px solid #fbcfe8', marginBottom: '20px' },
  wallFeed: { display: 'flex', flexDirection: 'column', gap: '20px' },
  feedItem: { background: '#fff', borderRadius: '25px', overflow: 'hidden', border: '1px solid #fce7f3' },
  feedImg: { width: '100%', height: '250px', objectFit: 'cover' },
  feedPadding: { padding: '20px' },
  actionRowSmall: { display: 'flex', gap: '10px' },
  miniVoteBtn: { flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #fbcfe8', background: 'white' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' },
  refreshBtn: { marginTop: '15px', padding: '10px 20px', borderRadius: '20px', border: 'none', background: '#fbcfe8', color: '#db2777', fontWeight: 'bold' }
};