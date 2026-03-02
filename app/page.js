'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormPulseGarden() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]); 
  const [activeTab, setActiveTab] = useState('home'); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data: userVotes } = await supabase.from('caption_votes')
        .select('caption_id, vote_value')
        .eq('profile_id', session.user.id);
      const userVoteMap = Object.fromEntries(userVotes?.map(v => [v.caption_id, v.vote_value]) || []);

      // Direct fetch that we know works and doesn't return a blank screen
      const { data, error } = await supabase
        .from('captions')
        .select(`id, content, image_id, profile_id, images!image_id(url), profiles:profile_id(email)`)
        .order('id', { ascending: false });

      if (error) throw error;

      const formatted = data
        .filter(c => c.content && c.content.trim() !== "") // Requirement: Filter out empty strings
        .map(c => ({
          ...c,
          display_url: c.images?.url || '',
          userVote: userVoteMap[c.id] || 0,
          uploader: c.profiles?.email?.split('@')[0] || 'Gardener'
        }));

      setAllData(formatted);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVote = async (id, val) => {
    await supabase.from('caption_votes').upsert({
      caption_id: id, profile_id: user.id, vote_value: val
    }, { onConflict: 'caption_id, profile_id' });
    fetchData();
  };

  const handleUpload = async () => {
    if (!file || !generatedCaption) return alert("Select a photo and caption! 🌸");
    setUploading(true);
    try {
      const name = `${Date.now()}-${file.name}`;
      await supabase.storage.from('pulse-images').upload(name, file);
      const { data: { publicUrl } } = supabase.storage.from('pulse-images').getPublicUrl(name);
      const { data: img } = await supabase.from('images').insert([{ url: publicUrl, profile_id: user.id }]).select().single();
      await supabase.from('captions').insert([{ content: generatedCaption, image_id: img.id, profile_id: user.id }]);
      setFile(null); setGeneratedCaption(''); setActiveTab('account'); fetchData();
    } catch (e) { alert("Upload error"); }
    setUploading(false);
  };

  // Requirement: Find Users Tab Data
  const userGroups = useMemo(() => {
    return allData.reduce((acc, curr) => {
      (acc[curr.uploader] = acc[curr.uploader] || []).push(curr);
      return acc;
    }, {});
  }, [allData]);

  const wallData = useMemo(() => {
    return allData.filter(c => c.content.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allData, searchQuery]);

  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  const currentQueue = allData.filter(c => c.userVote === 0);

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        .petal { position: fixed; top: -10%; color: #fbcfe8; animation: drift 15s linear infinite; z-index: -1; pointer-events: none; }
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
        .active-v { background: #db2777 !important; color: white !important; }
      ` }} />

      {/* BACKGROUND (Locked at -2) */}
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
            <button onClick={() => {setActiveTab('home'); setSidebarOpen(false);}} style={styles.sideBtn}>VOTE QUEUE</button>
            <button onClick={() => {setActiveTab('post'); setSidebarOpen(false);}} style={styles.sideBtn}>NEW POST</button>
            <button onClick={() => {setActiveTab('wall'); setSidebarOpen(false);}} style={styles.sideBtn}>GARDEN WALL</button>
            <button onClick={() => {setActiveTab('users'); setSidebarOpen(false);}} style={styles.sideBtn}>FIND USERS</button>
            <button onClick={() => {setActiveTab('account'); setSidebarOpen(false);}} style={styles.sideBtn}>MY PROFILE</button>
          </div>
        </div>
      )}

      <main style={styles.content}>
        
        {/* TAB: VOTE */}
        {activeTab === 'home' && (
          <div style={styles.center}>
            {currentQueue.length > 0 ? (
              <div style={styles.card}>
                <img src={currentQueue[0].display_url} style={styles.cardImg} />
                <div style={styles.cardBody}>
                  <p style={styles.caption}>“{currentQueue[0].content}”</p>
                  <div style={styles.voteRow}>
                    <button onClick={() => handleVote(currentQueue[0].id, -1)} style={styles.vBtn}>👎</button>
                    <button onClick={() => handleVote(currentQueue[0].id, 1)} style={styles.vBtnP}>💖</button>
                  </div>
                </div>
              </div>
            ) : <h2>Garden Clear! 🌸</h2>}
          </div>
        )}

        {/* TAB: POST */}
        {activeTab === 'post' && (
          <div style={styles.center}>
            <div style={styles.formCard}>
              <h2>New Bloom</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{margin: '15px 0'}} />
              <button onClick={() => setGeneratedCaption("Vibing in the dorms... 🌸")} style={styles.genBtn}>✨ Generate</button>
              <textarea value={generatedCaption} onChange={(e) => setGeneratedCaption(e.target.value)} style={styles.txt} placeholder="Caption..." />
              <button onClick={handleUpload} disabled={uploading} style={styles.postBtn}>{uploading ? "..." : "Post"}</button>
            </div>
          </div>
        )}

        {/* TAB: WALL (Requirement: Fixed narrow images) */}
        {activeTab === 'wall' && (
          <div style={styles.wallWrap}>
            <input placeholder="Search captions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchBar} />
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

        {/* TAB: FIND USERS (Requirement: New Tab) */}
        {activeTab === 'users' && (
          <div style={styles.wallWrap}>
            {Object.entries(userGroups).map(([name, posts]) => (
              <div key={name} style={{marginBottom: 30}}>
                <h3 style={styles.userTitle}>{name}'s Garden</h3>
                <div style={styles.grid}>
                  {posts.map(p => <img key={p.id} src={p.display_url} style={styles.gridImg} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: ACCOUNT */}
        {activeTab === 'account' && (
          <div style={styles.center}>
            <div style={styles.formCard}>
              <div style={styles.avatar}>{user?.email?.charAt(0).toUpperCase()}</div>
              <h3>{user?.email?.split('@')[0]}</h3>
              <div style={styles.grid}>
                {allData.filter(d => d.profile_id === user.id).map(p => <img key={p.id} src={p.display_url} style={styles.gridImg} />)}
              </div>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logout}>Logout</button>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
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
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 100, borderBottom: '1px solid #fce7f3' },
  menuIcon: { border: 'none', background: 'none', fontSize: '24px', color: '#db2777' },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { paddingTop: '80px', paddingBottom: '100px', position: 'relative', zIndex: 10 },
  center: { display: 'flex', justifyContent: 'center', padding: '20px' },
  card: { background: 'white', borderRadius: '30px', width: '100%', maxWidth: '380px', border: '4px solid #fbcfe8', overflow: 'hidden' },
  cardImg: { width: '100%', height: '350px', objectFit: 'cover' },
  cardBody: { padding: '20px', textAlign: 'center' },
  caption: { fontSize: '20px', fontWeight: '600', marginBottom: '15px' },
  voteRow: { display: 'flex', gap: '15px' },
  vBtn: { flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: '#f3f4f6', fontSize: '20px' },
  vBtnP: { flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: '#fbcfe8', color: '#db2777', fontSize: '20px' },
  footer: { position: 'fixed', bottom: 0, width: '100%', height: '70px', background: 'white', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3', zIndex: 100 },
  footBtn: { border: 'none', background: 'none', fontSize: '22px' },
  wallWrap: { padding: '0 20px', maxWidth: '600px', margin: '0 auto' },
  wallItem: { background: 'white', borderRadius: '25px', overflow: 'hidden', border: '1px solid #fce7f3', marginBottom: '20px' },
  wallImg: { width: '100%', height: 'auto', display: 'block' },
  searchBar: { width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #fbcfe8', marginBottom: '20px' },
  miniVoteRow: { display: 'flex', gap: '10px', marginTop: '10px' },
  miniBtn: { flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #fbcfe8', background: 'white' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '10px' },
  gridImg: { width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '10px' },
  userTitle: { color: '#db2777', borderBottom: '2px solid #fbcfe8', paddingBottom: '5px' },
  formCard: { background: 'white', padding: '30px', borderRadius: '30px', border: '3px solid #fbcfe8', width: '100%', maxWidth: '400px', textAlign: 'center' },
  txt: { width: '100%', height: '100px', borderRadius: '15px', border: '1px solid #fbcfe8', padding: '10px', margin: '15px 0' },
  postBtn: { width: '100%', padding: '12px', background: '#db2777', color: 'white', borderRadius: '15px', border: 'none', fontWeight: 600 },
  genBtn: { width: '100%', background: '#f3e8ff', color: '#7c3aed', padding: '8px', borderRadius: '10px', border: '1px solid #d8b4fe', fontSize: '12px' },
  avatar: { width: '60px', height: '60px', background: '#fbcfe8', borderRadius: '50%', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#db2777' },
  logout: { marginTop: '20px', padding: '10px', width: '100%', borderRadius: '10px', border: '1px solid #db2777', color: '#db2777', background: 'none' },
  sidebar: { position: 'fixed', top: 0, left: 0, width: '260px', height: '100%', background: 'white', zIndex: 200, padding: '20px', boxShadow: '5px 0 15px rgba(0,0,0,0.1)' },
  sideLinks: { display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' },
  sideBtn: { border: 'none', background: 'none', textAlign: 'left', fontWeight: 'bold', color: '#db2777' },
  closeBtn: { border: 'none', background: 'none', fontSize: '20px', position: 'absolute', top: 20, right: 20 },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' }
};