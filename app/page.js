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
  const [allData, setAllData] = useState([]); 
  const [activeTab, setActiveTab] = useState('home'); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('all'); 

  // Upload States
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState('');

  // 1. FETCH DATA FROM YOUR API
  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // Fetch from your specific API route
      const res = await fetch('/api/public-feed?limit=1000');
      const json = await res.json();
      
      if (!json.captions) throw new Error("API failed");

      // Get user's current votes to manage the queue persistence
      const { data: userVotes } = await supabase.from('caption_votes')
        .select('caption_id, vote_value')
        .eq('profile_id', session.user.id);
      
      const userVoteMap = Object.fromEntries(userVotes?.map(v => [v.caption_id, v.vote_value]) || []);

      // Map the API data to our UI
      const formatted = json.captions.map(cap => {
        const imgUrl = json.images[cap.image_id] || cap.url;
        return {
          ...cap,
          display_url: imgUrl,
          userVote: userVoteMap[cap.id] || 0,
          uploader: cap.uploader_name || 'Gardener'
        };
      }).filter(c => c.content && c.display_url); // Filter empty captions

      setAllData(formatted);
      // The Queue: Only items NOT voted on yet
      setCaptions(formatted.filter(c => !userVoteMap[c.id]));
      
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 2. VOTE ACTION
  const handleVote = async (captionId, value) => {
    try {
      const { error } = await supabase.from('caption_votes').upsert({
        caption_id: captionId,
        profile_id: user.id,
        vote_value: value
      }, { onConflict: 'caption_id, profile_id' });
      
      if (error) throw error;
      fetchData(); // Refresh to update the wall and remove from queue
    } catch (err) {
      console.error("Vote failed:", err);
    }
  };

  // 3. UPLOAD ACTION
  const handleUploadAndPost = async () => {
    if (!file || !generatedCaption) return alert("Select photo & generate caption!");
    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      await supabase.storage.from('pulse-images').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('pulse-images').getPublicUrl(fileName);
      
      const { data: imgRec } = await supabase.from('images').insert([
        { url: publicUrl, profile_id: user.id }
      ]).select().single();

      await supabase.from('captions').insert([
        { content: generatedCaption, image_id: imgRec.id, profile_id: user.id }
      ]);

      setFile(null); setGeneratedCaption(''); setActiveTab('account'); fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  // 4. FILTERING & FIND USERS LOGIC
  const wallData = useMemo(() => {
    let list = [...allData];
    if (searchQuery) list = list.filter(c => c.content.toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  }, [allData, searchQuery]);

  const userGroups = useMemo(() => {
    return allData.reduce((acc, curr) => {
      (acc[curr.uploader] = acc[curr.uploader] || []).push(curr);
      return acc;
    }, {});
  }, [allData]);

  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        .petal { position: fixed; top: -10%; color: #fbcfe8; animation: drift 15s linear infinite; z-index: -1; pointer-events: none; }
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
        .rotate { animation: rot 60s linear infinite; }
        @keyframes rot { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .active-vote { background: #db2777 !important; color: white !important; }
      ` }} />

      {/* Flower Background Layer */}
      <div style={styles.bg} />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="petal" style={{ left: `${Math.random() * 100}%`, animationDelay: `${i*2}s` }}>🌸</div>
      ))}

      {/* Sidebar Menu */}
      {sidebarOpen && (
        <div style={styles.sidebar}>
          <button onClick={() => setSidebarOpen(false)} style={styles.closeBtn}>✕</button>
          <div style={styles.sideLinks}>
            {['home', 'post', 'garden', 'users', 'account'].map(t => (
              <button key={t} onClick={() => { setActiveTab(t); setSidebarOpen(false); }} style={styles.sideBtn}>{t.toUpperCase()}</button>
            ))}
          </div>
        </div>
      )}

      <nav style={styles.header}>
        <button onClick={() => setSidebarOpen(true)} style={styles.menuIcon}>☰</button>
        <h1 style={styles.logo}>DormPulse.</h1>
        <div style={{width: 30}}></div>
      </nav>

      <main style={styles.content}>
        
        {/* QUICK VOTE */}
        {activeTab === 'home' && (
          <div style={styles.centerContainer}>
            {captions.length > 0 ? (
              <div style={styles.voteCard}>
                <img src={captions[0].display_url} style={styles.mainImg} />
                <div style={styles.cardPadding}>
                  <p style={styles.captionText}>“{captions[0].content}”</p>
                  <div style={styles.voteRow}>
                    <button onClick={() => handleVote(captions[0].id, -1)} style={styles.voteBtn}>👎</button>
                    <button onClick={() => handleVote(captions[0].id, 1)} style={styles.voteBtnPink}>💖</button>
                  </div>
                </div>
              </div>
            ) : <div style={{textAlign:'center', color:'#db2777'}}><h1>Garden Clear! 🌸</h1></div>}
          </div>
        )}

        {/* POST TAB */}
        {activeTab === 'post' && (
          <div style={styles.centerContainer}>
            <div style={styles.formCard}>
              <h2 style={{color:'#db2777'}}>Plant Memory</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} />
              <button onClick={() => setGeneratedCaption("Shared memories in Bloom... 🌸")} style={styles.genBtn}>✨ Generate Caption</button>
              <textarea value={generatedCaption} onChange={(e) => setGeneratedCaption(e.target.value)} style={styles.textArea} />
              <button onClick={handleUploadAndPost} disabled={uploading} style={styles.submitBtn}>{uploading ? "Planting..." : "Post"}</button>
            </div>
          </div>
        )}

        {/* SEARCH WALL */}
        {activeTab === 'search' && (
          <div style={styles.wallPadding}>
            <input placeholder="Search garden..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchBar} />
            {wallData.map(c => (
              <div key={c.id} style={styles.wallItem}>
                <img src={c.display_url} style={styles.wallImg} />
                <div style={styles.wallContent}>
                  <p style={{fontWeight:'600'}}>“{c.content}”</p>
                  <div style={styles.miniVoteRow}>
                    <button onClick={() => handleVote(c.id, 1)} style={{...styles.miniBtn, ...(c.userVote === 1 ? styles.activeVote : {})}}>💖</button>
                    <button onClick={() => handleVote(c.id, -1)} style={{...styles.miniBtn, ...(c.userVote === -1 ? styles.activeVote : {})}}>👎</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FIND USERS */}
        {activeTab === 'users' && (
          <div style={styles.wallPadding}>
            {Object.entries(userGroups).map(([name, posts]) => (
              <div key={name} style={{marginBottom: 30}}>
                <h3 style={{color:'#db2777'}}>{name}'s Garden</h3>
                <div style={styles.grid}>
                  {posts.map(p => <img key={p.id} src={p.display_url} style={styles.gridImg} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ACCOUNT */}
        {activeTab === 'account' && (
          <div style={styles.centerContainer}>
            <div style={styles.formCard}>
              <div style={styles.avatar}>{user?.email?.charAt(0).toUpperCase()}</div>
              <h3>{user?.email?.split('@')[0]}</h3>
              <div style={{marginTop: 20}}>
                <h4>My Blooms</h4>
                <div style={styles.grid}>
                  {allData.filter(d => d.profile_id === user.id).map(p => <img key={p.id} src={p.display_url} style={styles.gridImg} />)}
                </div>
              </div>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>Logout</button>
            </div>
          </div>
        )}

        {/* GARDEN MENU (SPINNING) */}
        {activeTab === 'garden' && (
           <div style={styles.centerContainer}>
              <div className="rotate" style={styles.spinContainer}>
                {[0, 120, 240].map((deg, i) => (
                  <div key={i} style={{...styles.petalMenu, transform: `rotate(${deg}deg) translateY(-110px)`}} onClick={() => setActiveTab('search')}>
                    <div style={{transform: `rotate(-${deg}deg)`, color:'white'}}>WALL</div>
                  </div>
                ))}
                <div style={styles.spinCenter}>🌸</div>
              </div>
           </div>
        )}
      </main>

      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={styles.navBtn}>🏠</button>
        <button onClick={() => setActiveTab('post')} style={styles.navBtn}>➕</button>
        <button onClick={() => setActiveTab('garden')} style={styles.navBtn}>🌸</button>
        <button onClick={() => setActiveTab('users')} style={styles.navBtn}>👥</button>
        <button onClick={() => setActiveTab('account')} style={styles.navBtn}>👤</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  bg: { position: 'fixed', inset: 0, zIndex: -2, backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-1-3-4-5-7-5-4 0-7 3-7 7 0 3 2 6 5 7-3 1-5 4-5 7 0 4 3 7 7 7 3 0 6-2 7-5 1 3 4 5 7 5 4 0 7-3 7-7 0-3-2-6-5-7 3-1 5-4 5-7 0-4-3-7-7-7-3 0-6 2-7 5z' fill='%23fbcfe8' fill-opacity='0.4'/%3E%3C/svg%3E")` },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 100, borderBottom: '1px solid #fce7f3' },
  menuIcon: { border: 'none', background: 'none', fontSize: '24px', color: '#db2777' },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { paddingTop: '80px', paddingBottom: '100px', position: 'relative', zIndex: 10 },
  centerContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '20px' },
  voteCard: { background: 'white', borderRadius: '30px', width: '100%', maxWidth: '380px', border: '4px solid #fbcfe8', overflow: 'hidden' },
  mainImg: { width: '100%', height: '350px', objectFit: 'cover' },
  cardPadding: { padding: '20px', textAlign: 'center' },
  captionText: { fontSize: '20px', fontWeight: '600', marginBottom: '20px' },
  voteRow: { display: 'flex', gap: '15px' },
  voteBtn: { flex: 1, padding: '15px', borderRadius: '20px', border: 'none', background: '#f3f4f6', fontSize: '24px' },
  voteBtnPink: { flex: 1, padding: '15px', borderRadius: '20px', border: 'none', background: '#fbcfe8', color: '#db2777', fontSize: '24px' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '70px', background: 'white', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3', zIndex: 100 },
  navBtn: { border: 'none', background: 'none', fontSize: '20px' },
  wallPadding: { padding: '0 20px', maxWidth: '600px', margin: '0 auto' },
  wallItem: { background: 'white', borderRadius: '25px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #fce7f3' },
  wallImg: { width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'cover', display: 'block' },
  wallContent: { padding: '15px' },
  searchBar: { width: '100%', padding: '15px', borderRadius: '20px', border: '2px solid #fbcfe8', marginBottom: '20px' },
  miniVoteRow: { display: 'flex', gap: '10px', marginTop: '10px' },
  miniBtn: { flex: 1, padding: '8px', borderRadius: '10px', border: '1px solid #fbcfe8', background: 'white' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  gridImg: { width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '10px' },
  sidebar: { position: 'fixed', top: 0, left: 0, width: '250px', height: '100%', background: 'white', zIndex: 200, padding: '20px', boxShadow: '5px 0 15px rgba(0,0,0,0.1)' },
  sideLinks: { display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' },
  sideBtn: { border: 'none', background: 'none', textAlign: 'left', fontWeight: '600', color: '#db2777' },
  closeBtn: { position: 'absolute', top: 20, right: 20, border: 'none', background: 'none', fontSize: '20px' },
  formCard: { background: 'white', padding: '25px', borderRadius: '30px', border: '3px solid #fbcfe8', width: '100%', maxWidth: '380px', textAlign: 'center' },
  textArea: { width: '100%', height: '100px', borderRadius: '15px', margin: '15px 0', padding: '10px', border: '1px solid #fbcfe8' },
  submitBtn: { width: '100%', padding: '12px', background: '#db2777', color: 'white', borderRadius: '15px', border: 'none', fontWeight: '600' },
  genBtn: { background: '#f3e8ff', border: '1px solid #d8b4fe', padding: '8px', borderRadius: '10px', width: '100%', color: '#7c3aed', fontSize: '11px' },
  avatar: { width: '60px', height: '60px', background: '#fbcfe8', borderRadius: '50%', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#db2777' },
  logoutBtn: { marginTop: '20px', width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #db2777', color: '#db2777', background: 'none' },
  spinContainer: { position: 'relative', width: '100px', height: '100px' },
  petalMenu: { position: 'absolute', width: '70px', height: '100px', background: '#db2777', borderRadius: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' },
  spinCenter: { position: 'absolute', top: 20, left: 20, width: '60px', height: '60px', background: '#ffb3c1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', border: '2px solid white', zIndex: 10 },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' }
};