'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormPulseGarden() {
  const router = useRouter();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]); 
  const [history, setHistory] = useState([]); 
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

  const phrases = useMemo(() => ["Every flower blooms in its own time.", "Your presence makes this garden beautiful.", "Bloom where you are planted."], []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data: userVotes } = await supabase.from('caption_votes').select('caption_id, vote_value').eq('profile_id', session.user.id);
      const userVoteMap = Object.fromEntries(userVotes?.map(v => [v.caption_id, v.vote_value]) || []);

      const { data, error } = await supabase.from('captions').select(`id, content, images!image_id ( url ), caption_votes ( vote_value ), profiles:profile_id ( email )`).order('id', { ascending: false });
      if (error) throw error;

      const formatted = data.filter(cap => cap.content && cap.content.trim() !== "").map(cap => {
        const votes = cap.caption_votes || [];
        const ups = votes.filter(v => v.vote_value === 1).length;
        const downs = votes.filter(v => v.vote_value === -1).length;
        return { 
          ...cap, 
          display_url: cap.images?.url || '', 
          upvotes: ups, 
          downvotes: downs, 
          net: ups - downs, 
          userVote: userVoteMap[cap.id] || 0,
          uploader: cap.profiles?.email?.split('@')[0] || 'Gardener'
        };
      });

      const grouped = formatted.reduce((acc, curr) => {
        (acc[curr.uploader] = acc[curr.uploader] || []).push(curr);
        return acc;
      }, {});

      setAllData(formatted);
      setUserUploads(grouped);
      setCaptions(formatted.filter(c => !userVoteMap[c.id]));
      setHistory(formatted.filter(c => userVoteMap[c.id]));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { if (hasMounted) fetchData(); }, [hasMounted, fetchData]);

  const handleVote = async (captionId, value) => {
    try {
      await supabase.from('caption_votes').upsert({ caption_id: captionId, profile_id: user.id, vote_value: value }, { onConflict: 'caption_id, profile_id' });
      fetchData(); 
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
    let list = sortMode === 'recent' ? [...history] : [...allData];
    if (sortMode === 'high') list.sort((a, b) => b.net - a.net);
    if (sortMode === 'low') list.sort((a, b) => a.net - b.net);
    if (searchQuery) list = list.filter(c => c.content?.toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  }, [allData, history, sortMode, searchQuery]);

  if (!hasMounted) return null;
  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); opacity: 0.8; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
        .petal-drift { position: fixed; top: -10%; color: #fbcfe8; font-size: 24px; animation: drift 15s linear infinite; z-index: -1; pointer-events: none; }
        .flower-rotate { animation: rotate 50s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .active-vote { background: #db2777 !important; color: white !important; }
      ` }} />

      {/* BACKGROUND ELEMENTS: Layers -1 and -2 */}
      <div style={styles.backgroundLayer} />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="petal-drift" style={{ left: `${Math.random() * 100}%`, animationDelay: `${i * 2}s` }}>🌸</div>
      ))}

      {/* HEADER */}
      <nav style={styles.header}>
        <button onClick={() => setSidebarOpen(true)} style={styles.menuBtn}>☰</button>
        <h1 style={styles.logo}>DormPulse.</h1>
        <div style={{width: 40}}></div>
      </nav>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={styles.sidebar}>
          <button onClick={() => setSidebarOpen(false)} style={styles.closeBtn}>✕</button>
          <div style={styles.sideLinks}>
            {['home', 'post', 'garden', 'uploads', 'account'].map(t => (
              <button key={t} onClick={() => { setActiveTab(t); setSidebarOpen(false); }} style={styles.sideBtn}>{t.toUpperCase()}</button>
            ))}
          </div>
        </div>
      )}

      {/* MAIN CONTENT: Layer 10 */}
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
                  <div style={styles.counter}>{captions.length} pulses remaining</div>
                </div>
              </div>
            ) : <div style={styles.doneBox}><h1>GARDEN CLEAR! 🌸</h1></div>}
          </div>
        )}

        {activeTab === 'post' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <h2 style={{color:'#db2777'}}>New Bloom</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{marginBottom: 10}} />
              <button onClick={() => setGeneratedCaption("Late night study vibes... 🌸")} style={styles.genBtn}>✨ Generate Caption</button>
              <textarea value={generatedCaption} onChange={(e) => setGeneratedCaption(e.target.value)} style={styles.textArea} />
              <button onClick={handleUploadAndPost} disabled={uploading} style={styles.mainBtn}>{uploading ? "Planting..." : "Post Forever"}</button>
            </div>
          </div>
        )}

        {activeTab === 'garden' && (
          <div style={styles.centerContainer}>
            <div className="flower-rotate" style={styles.giantFlowerWrapper}>
              {[{deg:0,l:'All',m:'all'},{deg:90,l:'Top',m:'high'},{deg:180,l:'Low',m:'low'},{deg:270,l:'Recent',m:'recent'}].map((p, i) => (
                <div key={i} style={{...styles.giantPetal, transform: `rotate(${p.deg}deg) translateY(-130px)`}} onClick={() => { setSortMode(p.m); setActiveTab('search'); }}>
                  <div style={{transform: `rotate(-${p.deg}deg)`, color:'white', fontSize:'12px'}}>{p.l}</div>
                </div>
              ))}
              <div style={styles.giantCenter}>Dorm<br/>Pulse</div>
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div style={styles.searchView}>
            <input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchBar} />
            {wallData.map(c => (
              <div key={c.id} style={styles.feedItem}>
                <img src={c.display_url} style={styles.feedImg} />
                <div style={styles.feedPadding}>
                  <p style={{fontWeight:'600'}}>“{c.content}”</p>
                  <div style={styles.actionRowSmall}>
                    <button onClick={() => handleVote(c.id, 1)} style={{...styles.miniVoteBtn, ...(c.userVote === 1 ? styles.activeVote : {})}}>💖 {c.upvotes}</button>
                    <button onClick={() => handleVote(c.id, -1)} style={{...styles.miniVoteBtn, ...(c.userVote === -1 ? styles.activeVote : {})}}>👎 {c.downvotes}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'uploads' && (
          <div style={styles.searchView}>
            {Object.entries(userUploads).map(([name, posts]) => (
              <div key={name} style={{marginBottom: 30}}>
                <h3 style={styles.userHeading}>{name}'s Blooms</h3>
                <div style={styles.uploadGrid}>
                  {posts.map(p => <img key={p.id} src={p.display_url} style={styles.gridImg} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'account' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <div style={styles.avatar}>{user?.email?.charAt(0)}</div>
              <h3>{user?.email?.split('@')[0]}</h3>
              <h4 style={{marginTop: 20}}>My Blooms</h4>
              <div style={styles.uploadGrid}>
                {allData.filter(d => d.profile_id === user.id).map(p => <img key={p.id} src={p.display_url} style={styles.gridImg} />)}
              </div>
              <div style={styles.aboutBox}>
                <p><strong>Nabiha Irfan</strong> Project 2024. Forever Memories. 🌸</p>
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
        <button onClick={() => setActiveTab('search')} style={styles.navBtn}>🔍<br/>Wall</button>
        <button onClick={() => setActiveTab('account')} style={styles.navBtn}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', fontFamily: "'Fredoka', sans-serif", position: 'relative' },
  backgroundLayer: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -2, background: '#fff5f7', backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-1-3-4-5-7-5-4 0-7 3-7 7 0 3 2 6 5 7-3 1-5 4-5 7 0 4 3 7 7 7 3 0 6-2 7-5 1 3 4 5 7 5 4 0 7-3 7-7 0-3-2-6-5-7 3-1 5-4 5-7 0-4-3-7-7-7-3 0-6 2-7 5z' fill='%23fbcfe8' fill-opacity='0.4'/%3E%3C/svg%3E")` },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 1000, borderBottom: '1px solid #fce7f3' },
  menuBtn: { fontSize: '24px', background: 'none', border: 'none', color: '#db2777', cursor: 'pointer' },
  sidebar: { position: 'fixed', top: 0, left: 0, width: '250px', height: '100vh', background: 'white', zIndex: 2000, boxShadow: '5px 0 15px rgba(0,0,0,0.1)', padding: '20px' },
  sideLinks: { display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' },
  sideBtn: { background: 'none', border: 'none', textAlign: 'left', fontSize: '18px', color: '#db2777', fontWeight: '600', cursor: 'pointer' },
  closeBtn: { position: 'absolute', top: 20, right: 20, border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { paddingTop: '80px', paddingBottom: '100px', position: 'relative', zIndex: 10 },
  centerContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', minHeight: '70vh' },
  pastelCard: { background: '#fff', borderRadius: '35px', width: '100%', maxWidth: '380px', border: '4px solid #fbcfe8', overflow: 'hidden' },
  cardImg: { width: '100%', height: '350px', objectFit: 'cover' },
  cardBody: { padding: '20px', textAlign: 'center' },
  cardCaption: { fontSize: '18px', fontWeight: '600', marginBottom: '15px' },
  actionRow: { display: 'flex', gap: '15px' },
  fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '12px', borderRadius: '15px', border: 'none', fontSize: '20px', cursor: 'pointer' },
  trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '12px', borderRadius: '15px', border: 'none', fontSize: '20px', cursor: 'pointer' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '80px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3', zIndex: 1000 },
  navBtn: { border: 'none', background: 'none', color: '#db2777', fontSize: '11px', fontWeight: '600', cursor: 'pointer' },
  giantFlowerWrapper: { position: 'relative', width: '120px', height: '120px', zIndex: 100 },
  giantPetal: { position: 'absolute', width: '85px', height: '125px', background: 'linear-gradient(#ff85a2, #db2777)', borderRadius: '40px', display:'flex', alignItems:'center', justifyContent:'center', border:'3px solid white', cursor:'pointer' },
  giantCenter: { position: 'absolute', width: '70px', height: '70px', background: '#ffb3c1', borderRadius: '50%', top: '25px', left: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#db2777', textAlign: 'center', border: '3px solid white', zIndex: 10 },
  searchView: { padding: '0 20px', maxWidth: '600px', margin: '0 auto' },
  searchBar: { width: '100%', padding: '12px', borderRadius: '15px', border: '2px solid #fbcfe8', marginBottom: '15px' },
  feedItem: { background: '#fff', borderRadius: '25px', marginBottom: '20px', overflow: 'hidden', border: '1px solid #fce7f3' },
  feedImg: { width: '100%', height: '250px', objectFit: 'cover' },
  feedPadding: { padding: '15px' },
  actionRowSmall: { display: 'flex', gap: '10px', marginTop: '10px' },
  miniVoteBtn: { flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #fbcfe8', background: 'white', color: '#db2777', fontWeight: '600', cursor: 'pointer' },
  uploadGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '10px' },
  gridImg: { width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '10px' },
  uploadCard: { background: '#fff', padding: '25px', borderRadius: '30px', border: '3px solid #fbcfe8', width: '100%', maxWidth: '380px', textAlign: 'center' },
  textArea: { width: '100%', height: '100px', borderRadius: '15px', border: '1px solid #fbcfe8', padding: '10px', margin: '15px 0' },
  genBtn: { background: '#f3e8ff', border: '1px solid #d8b4fe', padding: '8px', borderRadius: '10px', color: '#7c3aed', fontSize: '11px', width: '100%', cursor: 'pointer' },
  mainBtn: { width: '100%', padding: '12px', background: '#db2777', color: 'white', borderRadius: '12px', border: 'none', fontWeight: '600', cursor: 'pointer' },
  avatar: { width: '60px', height: '60px', background: '#fbcfe8', borderRadius: '50%', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#db2777' },
  aboutBox: { marginTop: '20px', padding: '15px', background: '#fff5f7', borderRadius: '15px', fontSize: '12px' },
  logoutBtn: { marginTop: '15px', width: '100%', padding: '10px', border: '1px solid #db2777', borderRadius: '10px', color: '#db2777', background: 'none', cursor: 'pointer' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' },
  counter: { marginTop: '10px', fontSize: '10px', color: '#db2777', fontWeight: '600' },
  doneBox: { textAlign: 'center', color: '#db2777' },
  userHeading: { color: '#db2777', borderBottom: '2px solid #fbcfe8', paddingBottom: '5px' }
};