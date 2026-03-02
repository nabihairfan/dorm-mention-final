'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormPulseGarden() {
  const router = useRouter();
  
  // App States
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]); 
  const [activeTab, setActiveTab] = useState('home'); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Upload States
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState('');

  // 1. DATA LOADING (Direct & Reliable)
  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // Get user's votes
      const { data: userVotes } = await supabase.from('caption_votes')
        .select('caption_id, vote_value')
        .eq('profile_id', session.user.id);
      const userVoteMap = Object.fromEntries(userVotes?.map(v => [v.caption_id, v.vote_value]) || []);

      // Get Captions + Images + Profiles (Directly so it doesn't break)
      const { data, error } = await supabase
        .from('captions')
        .select(`id, content, image_id, profile_id, created_at, images!image_id(url), profiles:profile_id(email)`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = data
        .filter(c => c.content && c.content.trim() !== "") // Requirement: No empty captions
        .map(c => ({
          ...c,
          display_url: c.images?.url || '',
          userVote: userVoteMap[c.id] || 0,
          uploader: c.profiles?.email?.split('@')[0] || 'Gardener'
        }));

      setAllData(formatted);
    } catch (err) {
      console.error("Load Error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 2. VOTING LOGIC
  const handleVote = async (id, val) => {
    try {
      await supabase.from('caption_votes').upsert({
        caption_id: id, profile_id: user.id, vote_value: val
      }, { onConflict: 'caption_id, profile_id' });
      fetchData(); // Refresh list
    } catch (e) { console.error(e); }
  };

  // 3. UPLOAD LOGIC
  const handleUpload = async () => {
    if (!file || !generatedCaption) return alert("Add a photo and caption! 🌸");
    setUploading(true);
    try {
      const name = `${Date.now()}-${file.name}`;
      await supabase.storage.from('pulse-images').upload(name, file);
      const { data: { publicUrl } } = supabase.storage.from('pulse-images').getPublicUrl(name);
      
      const { data: img } = await supabase.from('images').insert([{ url: publicUrl, profile_id: user.id }]).select().single();
      await supabase.from('captions').insert([{ content: generatedCaption, image_id: img.id, profile_id: user.id }]);
      
      setFile(null); setGeneratedCaption(''); setActiveTab('account'); fetchData();
    } catch (e) { alert("Upload failed"); }
    finally { setUploading(false); }
  };

  // 4. GROUPING FOR "FIND USERS"
  const userGroups = useMemo(() => {
    return allData.reduce((acc, curr) => {
      (acc[curr.uploader] = acc[curr.uploader] || []).push(curr);
      return acc;
    }, {});
  }, [allData]);

  // Filters for the Wall
  const wallData = useMemo(() => {
    if (!searchQuery) return allData;
    return allData.filter(c => c.content.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allData, searchQuery]);

  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        .petal { position: fixed; top: -10%; color: #fbcfe8; animation: drift 15s linear infinite; z-index: -1; pointer-events: none; }
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
        .active-v { background: #db2777 !important; color: white !important; }
      ` }} />

      {/* BACKGROUND LAYER */}
      <div style={styles.bgOverlay} />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="petal" style={{ left: `${i * 18}%`, animationDelay: `${i * 2}s` }}>🌸</div>
      ))}

      {/* HEADER */}
      <nav style={styles.header}>
        <button onClick={() => setSidebarOpen(true)} style={styles.menuIcon}>☰</button>
        <h1 style={styles.logo}>DormPulse.</h1>
        <div style={{width: 30}} />
      </nav>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={styles.sidebar}>
          <button onClick={() => setSidebarOpen(false)} style={styles.closeBtn}>✕</button>
          <div style={styles.sideLinks}>
            {['home', 'post', 'wall', 'users', 'account'].map(t => (
              <button key={t} onClick={() => {setActiveTab(t); setSidebarOpen(false);}} style={styles.sideBtn}>{t.toUpperCase()}</button>
            ))}
          </div>
        </div>
      )}

      <main style={styles.content}>
        
        {/* VOTE QUEUE */}
        {activeTab === 'home' && (
          <div style={styles.centerWrap}>
            {allData.filter(c => c.userVote === 0).length > 0 ? (
              <div style={styles.card}>
                <img src={allData.find(c => c.userVote === 0).display_url} style={styles.cardImg} />
                <div style={styles.cardPadding}>
                  <p style={styles.captionMain}>“{allData.find(c => c.userVote === 0).content}”</p>
                  <div style={styles.voteRow}>
                    <button onClick={() => handleVote(allData.find(c => c.userVote === 0).id, -1)} style={styles.vBtn}>👎</button>
                    <button onClick={() => handleVote(allData.find(c => c.userVote === 0).id, 1)} style={styles.vBtnPink}>💖</button>
                  </div>
                </div>
              </div>
            ) : <div style={{textAlign:'center'}}><h2>Garden Clear! 🌸</h2></div>}
          </div>
        )}

        {/* POSTING */}
        {activeTab === 'post' && (
          <div style={styles.centerWrap}>
            <div style={styles.formCard}>
              <h2 style={{color: '#db2777'}}>New Bloom</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{margin: '15px 0'}} />
              <button onClick={() => setGeneratedCaption("Shared memories in the garden... 🌸")} style={styles.genBtn}>✨ Generate Caption</button>
              <textarea value={generatedCaption} onChange={(e) => setGeneratedCaption(e.target.value)} style={styles.textArea} placeholder="What's on your mind?" />
              <button onClick={handleUpload} disabled={uploading} style={styles.submitBtn}>{uploading ? "Planting..." : "Post Forever"}</button>
            </div>
          </div>
        )}

        {/* THE WALL */}
        {activeTab === 'wall' && (
          <div style={styles.listWrap}>
            <input placeholder="Search garden..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchBar} />
            {wallData.map(c => (
              <div key={c.id} style={styles.wallItem}>
                <img src={c.display_url} style={styles.wallImg} />
                <div style={{padding: 15}}>
                  <p style={{fontWeight: 600}}>“{c.content}”</p>
                  <div style={styles.miniVoteRow}>
                    <button onClick={() => handleVote(c.id, 1)} style={{...styles.miniBtn, ...(c.userVote === 1 ? styles.activeV : {})}}>💖</button>
                    <button onClick={() => handleVote(c.id, -1)} style={{...styles.miniBtn, ...(c.userVote === -1 ? styles.activeV : {})}}>👎</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FIND USERS */}
        {activeTab === 'users' && (
          <div style={styles.listWrap}>
            {Object.entries(userGroups).map(([name, posts]) => (
              <div key={name} style={{marginBottom: 30}}>
                <h3 style={styles.userHeading}>{name}'s Garden</h3>
                <div style={styles.grid}>
                  {posts.map(p => <img key={p.id} src={p.display_url} style={styles.gridImg} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MY ACCOUNT */}
        {activeTab === 'account' && (
          <div style={styles.centerWrap}>
            <div style={styles.formCard}>
              <div style={styles.avatar}>{user?.email?.charAt(0).toUpperCase()}</div>
              <h3>{user?.email?.split('@')[0]}</h3>
              <h4 style={{marginTop: 20, color: '#db2777'}}>My Uploads</h4>
              <div style={styles.grid}>
                {allData.filter(d => d.profile_id === user.id).map(p => <img key={p.id} src={p.display_url} style={styles.gridImg} />)}
              </div>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>Logout</button>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER NAV */}
      <nav style={styles.footer}>
        <button onClick={() => setActiveTab('home')} style={styles.footBtn}>🏠</button>
        <button onClick={() => setActiveTab('post')} style={styles.footBtn}>➕</button>
        <button onClick={() => setActiveTab('wall')} style={styles.footBtn}>🖼️</button>
        <button onClick={() => setActiveTab('users')} style={styles.footBtn}>👥</button>
        <button onClick={() => setActiveTab('account')} style={styles.footBtn}>👤</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  bgOverlay: { position: 'fixed', inset: 0, zIndex: -2, backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-1-3-4-5-7-5-4 0-7 3-7 7 0 3 2 6 5 7-3 1-5 4-5 7 0 4 3 7 7 7 3 0 6-2 7-5 1 3 4 5 7 5 4 0 7-3 7-7 0-3-2-6-5-7 3-1 5-4 5-7 0-4-3-7-7-7-3 0-6 2-7 5z' fill='%23fbcfe8' fill-opacity='0.4'/%3E%3C/svg%3E")` },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 100, borderBottom: '1px solid #fce7f3' },
  menuIcon: { border: 'none', background: 'none', fontSize: '24px', color: '#db2777', cursor: 'pointer' },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { paddingTop: '80px', paddingBottom: '100px', position: 'relative', zIndex: 10 },
  centerWrap: { display: 'flex', justifyContent: 'center', padding: '20px', minHeight: '60vh' },
  card: { background: 'white', borderRadius: '30px', width: '100%', maxWidth: '380px', border: '4px solid #fbcfe8', overflow: 'hidden' },
  cardImg: { width: '100%', height: '350px', objectFit: 'cover' },
  cardPadding: { padding: '20px', textAlign: 'center' },
  captionMain: { fontSize: '20px', fontWeight: '600', marginBottom: '15px' },
  voteRow: { display: 'flex', gap: '15px' },
  vBtn: { flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: '#f3f4f6', fontSize: '20px', cursor: 'pointer' },
  vBtnPink: { flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: '#fbcfe8', color: '#db2777', fontSize: '20px', cursor: 'pointer' },
  footer: { position: 'fixed', bottom: 0, width: '100%', height: '70px', background: 'white', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3', zIndex: 100 },
  footBtn: { border: 'none', background: 'none', fontSize: '22px', cursor: 'pointer' },
  listWrap: { padding: '0 20px', maxWidth: '600px', margin: '0 auto' },
  searchBar: { width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #fbcfe8', marginBottom: '20px' },
  wallItem: { background: 'white', borderRadius: '25px', overflow: 'hidden', border: '1px solid #fce7f3', marginBottom: '20px' },
  wallImg: { width: '100%', height: 'auto', display: 'block' },
  miniVoteRow: { display: 'flex', gap: '10px', marginTop: '10px' },
  miniBtn: { flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #fbcfe8', background: 'white' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  gridImg: { width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '10px' },
  userHeading: { color: '#db2777', borderBottom: '2px solid #fbcfe8', paddingBottom: '5px', marginBottom: '10px' },
  formCard: { background: 'white', padding: '30px', borderRadius: '30px', border: '3px solid #fbcfe8', width: '100%', maxWidth: '400px', textAlign: 'center' },
  textArea: { width: '100%', height: '100px', borderRadius: '15px', border: '1px solid #fbcfe8', padding: '10px', margin: '15px 0' },
  submitBtn: { width: '100%', padding: '12px', background: '#db2777', color: 'white', borderRadius: '15px', border: 'none', fontWeight: 600 },
  genBtn: { width: '100%', background: '#f3e8ff', color: '#7c3aed', padding: '8px', borderRadius: '10px', border: '1px solid #d8b4fe', fontSize: '12px' },
  avatar: { width: '60px', height: '60px', background: '#fbcfe8', borderRadius: '50%', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#db2777' },
  logoutBtn: { marginTop: '20px', padding: '10px', width: '100%', borderRadius: '10px', border: '1px solid #db2777', color: '#db2777', background: 'none' },
  sidebar: { position: 'fixed', top: 0, left: 0, width: '260px', height: '100%', background: 'white', zIndex: 200, padding: '20px', boxShadow: '5px 0 15px rgba(0,0,0,0.1)' },
  sideLinks: { display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' },
  sideBtn: { border: 'none', background: 'none', textAlign: 'left', fontWeight: 'bold', color: '#db2777' },
  closeBtn: { border: 'none', background: 'none', fontSize: '20px', position: 'absolute', top: 20, right: 20 },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' }
};