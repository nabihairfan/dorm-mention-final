'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormPulseGarden() {
  const router = useRouter();
  
  // States
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

  useEffect(() => { setHasMounted(true); }, []);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data: userVotes } = await supabase.from('caption_votes').select('caption_id, vote_value').eq('profile_id', session.user.id);
      const userVoteMap = Object.fromEntries(userVotes?.map(v => [v.caption_id, v.vote_value]) || []);

      const { data, error } = await supabase.from('captions').select(`id, content, profile_id, images!image_id ( url ), caption_votes ( vote_value ), profiles:profile_id ( email )`).order('id', { ascending: false });
      if (error) throw error;

      // Filter empty captions & format
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

      // Grouping for "Find Users"
      const grouped = formatted.reduce((acc, curr) => {
        (acc[curr.uploader] = acc[curr.uploader] || []).push(curr);
        return acc;
      }, {});

      setAllData(formatted);
      setUserUploads(grouped);
      setCaptions(formatted.filter(c => !userVoteMap[c.id]));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { if (hasMounted) fetchData(); }, [hasMounted, fetchData]);

  const handleVote = async (captionId, value) => {
    try {
      await supabase.from('caption_votes').upsert({ caption_id: captionId, profile_id: user.id, vote_value: value }, { onConflict: 'caption_id, profile_id' });
      fetchData(); 
    } catch (err) { console.error("Vote failed", err); }
  };

  const handleUploadAndPost = async () => {
    if (!file || !generatedCaption) return alert("Select photo & generate caption!");
    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { error: storageErr } = await supabase.storage.from('pulse-images').upload(fileName, file);
      if (storageErr) throw storageErr;

      const { data: { publicUrl } } = supabase.storage.from('pulse-images').getPublicUrl(fileName);
      const { data: imgRec } = await supabase.from('images').insert([{ url: publicUrl, profile_id: user.id }]).select().single();
      await supabase.from('captions').insert([{ content: generatedCaption, image_id: imgRec.id, profile_id: user.id }]);

      setFile(null); setGeneratedCaption(''); 
      setActiveTab('account'); // Move to account to see the new upload!
      fetchData();
    } catch (err) { console.error(err); alert("Upload failed."); }
    finally { setUploading(false); }
  };

  const wallData = useMemo(() => {
    let list = [...allData];
    if (sortMode === 'high') list.sort((a, b) => b.net - a.net);
    if (sortMode === 'low') list.sort((a, b) => a.net - b.net);
    if (searchQuery) list = list.filter(c => c.content.toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  }, [allData, sortMode, searchQuery]);

  if (!hasMounted) return null;
  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        .petal { position: fixed; top: -10%; color: #fbcfe8; font-size: 24px; animation: drift 12s linear infinite; z-index: -1; pointer-events: none; }
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
        .rotate { animation: rotate 40s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .active-vote { background: #db2777 !important; color: white !important; }
      ` }} />

      {/* FIXED BACKGROUND */}
      <div style={styles.bgOverlay} />
      {[...Array(8)].map((_, i) => (
        <div key={i} className="petal" style={{ left: `${Math.random() * 100}%`, animationDelay: `${i * 1.5}s` }}>🌸</div>
      ))}

      {/* HEADER */}
      <nav style={styles.header}>
        <button onClick={() => setSidebarOpen(true)} style={styles.menuIcon}>☰</button>
        <h1 style={styles.logo}>DormPulse.</h1>
        <div style={{width: 30}}></div>
      </nav>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={styles.sidebar}>
          <button onClick={() => setSidebarOpen(false)} style={styles.closeBtn}>✕</button>
          <div style={styles.sideLinks}>
            <button onClick={() => {setActiveTab('home'); setSidebarOpen(false);}} style={styles.sideBtn}>VOTE QUEUE</button>
            <button onClick={() => {setActiveTab('post'); setSidebarOpen(false);}} style={styles.sideBtn}>PLANT MEMORY</button>
            <button onClick={() => {setActiveTab('garden'); setSidebarOpen(false);}} style={styles.sideBtn}>THE GARDEN</button>
            <button onClick={() => {setActiveTab('users'); setSidebarOpen(false);}} style={styles.sideBtn}>FIND USERS</button>
            <button onClick={() => {setActiveTab('account'); setSidebarOpen(false);}} style={styles.sideBtn}>MY PROFILE</button>
          </div>
        </div>
      )}

      <main style={styles.content}>
        
        {/* TAB 1: QUICK VOTE */}
        {activeTab === 'home' && (
          <div style={styles.centerWrap}>
            {captions.length > 0 ? (
              <div style={styles.voteCard}>
                <img src={captions[0].display_url} style={styles.mainImg} alt="Pulse" />
                <div style={styles.voteBody}>
                  <p style={styles.voteText}>“{captions[0].content}”</p>
                  <div style={styles.btnRow}>
                    <button onClick={() => handleVote(captions[0].id, -1)} style={styles.voteBad}>👎</button>
                    <button onClick={() => handleVote(captions[0].id, 1)} style={styles.voteGood}>💖</button>
                  </div>
                  <small style={{color:'#db2777', fontWeight:600}}>{captions.length} left</small>
                </div>
              </div>
            ) : <div style={styles.doneBox}><h1>GARDEN CLEAR! 🌸</h1></div>}
          </div>
        )}

        {/* TAB 2: POST */}
        {activeTab === 'post' && (
          <div style={styles.centerWrap}>
            <div style={styles.formCard}>
              <h2 style={{color: '#db2777'}}>New Bloom</h2>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} style={{margin:'15px 0'}} />
              <button onClick={() => setGeneratedCaption("Dorm light hitting just right... 🌸")} style={styles.genBtn}>✨ Generate Caption</button>
              <textarea value={generatedCaption} onChange={(e) => setGeneratedCaption(e.target.value)} style={styles.formText} />
              <button onClick={handleUploadAndPost} disabled={uploading} style={styles.postBtn}>
                {uploading ? "Planting..." : "Post Forever 🌸"}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: GARDEN MENU */}
        {activeTab === 'garden' && (
          <div style={styles.centerWrap}>
            <div className="rotate" style={styles.flowerMenu}>
              {[{deg:0,l:'All',m:'all'},{deg:90,l:'Top',m:'high'},{deg:180,l:'Low',m:'low'},{deg:270,l:'Wall',m:'all'}].map((p, i) => (
                <div key={i} style={{...styles.petalBtn, transform: `rotate(${p.deg}deg) translateY(-120px)`}} onClick={() => { setSortMode(p.m); setActiveTab('search'); }}>
                  <div style={{transform: `rotate(-${p.deg}deg)`, color:'white', fontSize:'12px'}}>{p.l}</div>
                </div>
              ))}
              <div style={styles.flowerCenter}>🌸</div>
            </div>
          </div>
        )}

        {/* TAB 4: THE WALL (SEARCH) */}
        {activeTab === 'search' && (
          <div style={styles.wallWrap}>
            <input placeholder="Search captions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchBar} />
            {wallData.map(c => (
              <div key={c.id} style={styles.wallItem}>
                <img src={c.display_url} style={styles.wallImg} />
                <div style={{padding: '15px'}}>
                  <p style={{fontSize: '18px', fontWeight: '600'}}>“{c.content}”</p>
                  <div style={styles.miniBtnRow}>
                    <button onClick={() => handleVote(c.id, 1)} style={{...styles.miniBtn, ...(c.userVote === 1 ? styles.activeVote : {})}}>💖 {c.upvotes}</button>
                    <button onClick={() => handleVote(c.id, -1)} style={{...styles.miniBtn, ...(c.userVote === -1 ? styles.activeVote : {})}}>👎 {c.downvotes}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: FIND USERS */}
        {activeTab === 'users' && (
          <div style={styles.wallWrap}>
            {Object.entries(userUploads).map(([name, posts]) => (
              <div key={name} style={{marginBottom: '30px'}}>
                <h3 style={styles.userTitle}>{name}'s Garden</h3>
                <div style={styles.grid}>
                  {posts.map(p => <img key={p.id} src={p.display_url} style={styles.gridImg} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 6: MY PROFILE */}
        {activeTab === 'account' && (
          <div style={styles.centerWrap}>
            <div style={styles.formCard}>
              <div style={styles.avatar}>{user?.email?.charAt(0).toUpperCase()}</div>
              <h3>{user?.email?.split('@')[0]}</h3>
              <h4 style={{marginTop: '20px', color: '#db2777'}}>My Uploads</h4>
              <div style={styles.grid}>
                {allData.filter(d => d.profile_id === user.id).map(p => <img key={p.id} src={p.display_url} style={styles.gridImg} />)}
              </div>
              <p style={{fontSize: '12px', marginTop:'20px'}}>DormPulse by Nabiha Irfan</p>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logout}>Logout</button>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER NAV */}
      <nav style={styles.footer}>
        <button onClick={() => setActiveTab('home')} style={styles.footBtn}>🏠<br/>Vote</button>
        <button onClick={() => setActiveTab('post')} style={styles.footBtn}>➕<br/>Post</button>
        <button onClick={() => setActiveTab('garden')} style={styles.footBtn}>🌸<br/>Garden</button>
        <button onClick={() => setActiveTab('users')} style={styles.footBtn}>👥<br/>Users</button>
        <button onClick={() => setActiveTab('account')} style={styles.footBtn}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  bgOverlay: { position: 'fixed', inset: 0, zIndex: -2, backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-1-3-4-5-7-5-4 0-7 3-7 7 0 3 2 6 5 7-3 1-5 4-5 7 0 4 3 7 7 7 3 0 6-2 7-5 1 3 4 5 7 5 4 0 7-3 7-7 0-3-2-6-5-7 3-1 5-4 5-7 0-4-3-7-7-7-3 0-6 2-7 5z' fill='%23fbcfe8' fill-opacity='0.4'/%3E%3C/svg%3E")` },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 1000, borderBottom: '1px solid #fce7f3' },
  menuIcon: { fontSize: '24px', border: 'none', background: 'none', color: '#db2777', cursor: 'pointer' },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  sidebar: { position: 'fixed', top: 0, left: 0, width: '250px', height: '100vh', background: 'white', zIndex: 2000, boxShadow: '5px 0 15px rgba(0,0,0,0.1)', padding: '20px' },
  sideLinks: { display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' },
  sideBtn: { background: 'none', border: 'none', textAlign: 'left', fontSize: '18px', color: '#db2777', fontWeight: '600', cursor: 'pointer' },
  closeBtn: { position: 'absolute', top: 20, right: 20, border: 'none', background: 'none', fontSize: '22px', cursor: 'pointer' },
  content: { paddingTop: '80px', paddingBottom: '100px', position: 'relative', zIndex: 10 },
  centerWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', minHeight: '65vh' },
  voteCard: { background: 'white', borderRadius: '30px', width: '100%', maxWidth: '380px', border: '4px solid #fbcfe8', overflow: 'hidden' },
  mainImg: { width: '100%', height: '350px', objectFit: 'cover' },
  voteBody: { padding: '20px', textAlign: 'center' },
  voteText: { fontSize: '20px', fontWeight: '600', marginBottom: '15px' },
  btnRow: { display: 'flex', gap: '15px', marginBottom: '10px' },
  voteGood: { flex: 1, padding: '15px', borderRadius: '20px', background: '#fbcfe8', color: '#db2777', border: 'none', fontSize: '24px', cursor: 'pointer' },
  voteBad: { flex: 1, padding: '15px', borderRadius: '20px', background: '#f3f4f6', color: '#6b7280', border: 'none', fontSize: '24px', cursor: 'pointer' },
  footer: { position: 'fixed', bottom: 0, width: '100%', height: '80px', background: 'white', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3', zIndex: 1000 },
  footBtn: { border: 'none', background: 'none', color: '#db2777', fontSize: '11px', fontWeight: '600', cursor: 'pointer' },
  wallWrap: { padding: '0 20px', maxWidth: '600px', margin: '0 auto' },
  searchBar: { width: '100%', padding: '15px', borderRadius: '20px', border: '2px solid #fbcfe8', marginBottom: '20px' },
  wallItem: { background: 'white', borderRadius: '25px', overflow: 'hidden', border: '1px solid #fce7f3', marginBottom: '20px' },
  wallImg: { width: '100%', height: '300px', objectFit: 'cover', display: 'block' },
  miniBtnRow: { display: 'flex', gap: '10px', marginTop: '10px' },
  miniBtn: { flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #fbcfe8', background: 'white', color: '#db2777', fontWeight: 600, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
  gridImg: { width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '12px' },
  userTitle: { color: '#db2777', borderBottom: '2px solid #fbcfe8', paddingBottom: '5px', marginBottom: '10px' },
  formCard: { background: 'white', padding: '30px', borderRadius: '30px', border: '3px solid #fbcfe8', width: '100%', maxWidth: '400px', textAlign: 'center' },
  formText: { width: '100%', height: '100px', borderRadius: '15px', border: '1px solid #fbcfe8', padding: '10px', margin: '15px 0' },
  genBtn: { background: '#f3e8ff', border: '1px solid #d8b4fe', padding: '10px', borderRadius: '12px', color: '#7c3aed', width: '100%', cursor: 'pointer' },
  postBtn: { background: '#db2777', color: 'white', width: '100%', padding: '15px', borderRadius: '15px', border: 'none', fontWeight: 600, cursor: 'pointer' },
  avatar: { width: '60px', height: '60px', background: '#fbcfe8', borderRadius: '50%', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#db2777' },
  logout: { marginTop: '20px', width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #db2777', color: '#db2777', background: 'none', cursor: 'pointer' },
  flowerMenu: { position: 'relative', width: '100px', height: '100px' },
  petalBtn: { position: 'absolute', width: '80px', height: '120px', background: 'linear-gradient(#ff85a2, #db2777)', borderRadius: '40px', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  flowerCenter: { position: 'absolute', top: 20, left: 20, width: '60px', height: '60px', background: '#ffb3c1', borderRadius: '50%', border: '3px solid white', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' },
  doneBox: { textAlign: 'center', color: '#db2777' }
};