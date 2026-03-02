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
  const [activeTab, setActiveTab] = useState('grid'); // Default to Gallery
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Upload States
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');

  // 1. Fetch Data (Directly from your Supabase)
  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // Get user's existing votes so we can color the buttons
      const { data: userVotes } = await supabase.from('caption_votes')
        .select('caption_id, vote_value')
        .eq('profile_id', session.user.id);
      const userVoteMap = Object.fromEntries(userVotes?.map(v => [v.caption_id, v.vote_value]) || []);

      // Fetch Captions joined with Images and Profiles
      const { data, error } = await supabase
        .from('captions')
        .select(`
          id, 
          content, 
          image_id, 
          profile_id, 
          created_at, 
          images!image_id(url), 
          profiles:profile_id(email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = data
        .filter(c => c.content?.trim()) // Don't show empty captions
        .map(c => ({
          ...c,
          display_url: c.images?.url || '',
          userVote: userVoteMap[c.id] || 0,
          uploader: c.profiles?.email?.split('@')[0] || 'Gardener'
        }));

      setAllData(formatted);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 2. Voting Logic (The fix you needed)
  const handleVote = async (captionId, val) => {
    try {
      // Upsert: Create or Update existing vote
      const { error } = await supabase.from('caption_votes').upsert({
        caption_id: captionId,
        profile_id: user.id,
        vote_value: val
      }, { onConflict: 'caption_id, profile_id' });

      if (error) throw error;
      fetchData(); // Refresh UI
    } catch (e) {
      console.error("Vote failed:", e);
    }
  };

  const handleUpload = async () => {
    if (!file || !caption) return alert("Missing photo or caption!");
    setUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      await supabase.storage.from('pulse-images').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('pulse-images').getPublicUrl(fileName);
      
      const { data: img } = await supabase.from('images').insert([{ url: publicUrl, profile_id: user.id }]).select().single();
      await supabase.from('captions').insert([{ content: caption, image_id: img.id, profile_id: user.id }]);
      
      setFile(null); setCaption(''); setActiveTab('grid'); fetchData();
    } catch (e) { alert("Upload failed"); }
    finally { setUploading(false); }
  };

  // 3. User Grouping (Friend's "Find Users" logic)
  const userGroups = useMemo(() => {
    return allData.reduce((acc, curr) => {
      (acc[curr.uploader] = acc[curr.uploader] || []).push(curr);
      return acc;
    }, {});
  }, [allData]);

  // Filter for Gallery Search
  const filteredMemes = allData.filter(m => 
    m.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div style={styles.loader}>🌸 Warming up meme engine...</div>;

  return (
    <div style={styles.page}>
      {/* Visual Background Effects */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=Fredoka&display=swap');
        .petal { position: fixed; top: -10%; color: #fbcfe8; animation: drift 15s linear infinite; z-index: -1; pointer-events: none; }
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); opacity: 0.8; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
      ` }} />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="petal" style={{ left: `${i * 18}%`, animationDelay: `${i * 2}s` }}>🌸</div>
      ))}

      {/* Sidebar (Translation of friend's Aside) */}
      {sidebarOpen && (
        <div style={styles.sidebar}>
          <button onClick={() => setSidebarOpen(false)} style={styles.closeBtn}>✕</button>
          <h3 style={{color: '#db2777', padding: '10px 0'}}>MODES</h3>
          {['grid', 'swipe', 'upload', 'discover'].map(mode => (
            <button key={mode} 
              onClick={() => {setActiveTab(mode); setSidebarOpen(false);}} 
              style={{...styles.sideTab, ...(activeTab === mode ? styles.activeTab : {})}}>
              {mode.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Top Navigation */}
      <nav style={styles.header}>
        <button onClick={() => setSidebarOpen(true)} style={styles.menuIcon}>☰</button>
        <h1 style={styles.logo}>DormPulse.</h1>
        <div style={{width: 30}} />
      </nav>

      <main style={styles.container}>
        {/* GALLERY VIEW (Standard Feed) */}
        {activeTab === 'grid' && (
          <div>
            <input 
              placeholder="Find a caption worth stealing..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              style={styles.searchBar} 
            />
            <div style={styles.gridContainer}>
              {filteredMemes.map(m => (
                <div key={m.id} style={styles.card}>
                  <img src={m.display_url} style={styles.cardImg} />
                  <div style={styles.cardInfo}>
                    <p>“{m.content}”</p>
                    <div style={styles.miniVoteRow}>
                      <button onClick={() => handleVote(m.id, 1)} style={{...styles.miniBtn, ...(m.userVote === 1 ? {background: '#fbcfe8'} : {})}}>💖</button>
                      <button onClick={() => handleVote(m.id, -1)} style={{...styles.miniBtn, ...(m.userVote === -1 ? {background: '#f1f1f1'} : {})}}>👎</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SWIPE VIEW (Friend's "Quick Vote") */}
        {activeTab === 'swipe' && (
          <div style={styles.swipeWrap}>
            {allData.find(m => m.userVote === 0) ? (
              <div style={styles.swipeCard}>
                <img src={allData.find(m => m.userVote === 0).display_url} style={styles.swipeImg} />
                <h3>“{allData.find(m => m.userVote === 0).content}”</h3>
                <div style={styles.voteRow}>
                  <button onClick={() => handleVote(allData.find(m => m.userVote === 0).id, -1)} style={styles.vBtn}>👎 LAME</button>
                  <button onClick={() => handleVote(allData.find(m => m.userVote === 0).id, 1)} style={styles.vBtnPink}>💖 GAS</button>
                </div>
              </div>
            ) : <h2>All memes voted! 🏁</h2>}
          </div>
        )}

        {/* FIND USERS VIEW */}
        {activeTab === 'discover' && (
          <div style={styles.discoverWrap}>
            {Object.entries(userGroups).map(([name, posts]) => (
              <div key={name} style={styles.userSection}>
                <h3 style={styles.userHeading}>{name}'s Garden</h3>
                <div style={styles.userGrid}>
                  {posts.map(p => <img key={p.id} src={p.display_url} style={styles.userGridImg} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* UPLOAD VIEW */}
        {activeTab === 'upload' && (
          <div style={styles.uploadCard}>
            <h2>Plant a Meme</h2>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{margin: '20px 0'}} />
            <textarea 
              placeholder="What's the vibe?" 
              value={caption} 
              onChange={(e) => setCaption(e.target.value)} 
              style={styles.textArea}
            />
            <button onClick={handleUpload} disabled={uploading} style={styles.submitBtn}>
              {uploading ? "Uploading..." : "Share to Garden"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 100, borderBottom: '1px solid #fce7f3' },
  menuIcon: { border: 'none', background: 'none', fontSize: '24px', color: '#db2777', cursor: 'pointer' },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: 'bold' },
  container: { paddingTop: '80px', paddingBottom: '40px', maxWidth: '1000px', margin: '0 auto', paddingLeft: '20px', paddingRight: '20px' },
  searchBar: { width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #fbcfe8', marginBottom: '30px' },
  gridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' },
  card: { background: 'white', borderRadius: '20px', overflow: 'hidden', border: '1px solid #fce7f3' },
  cardImg: { width: '100%', aspectRatio: '1/1', objectFit: 'cover' },
  cardInfo: { padding: '15px' },
  miniVoteRow: { display: 'flex', gap: '10px', marginTop: '10px' },
  miniBtn: { flex: 1, padding: '8px', borderRadius: '10px', border: '1px solid #fbcfe8', background: 'none', cursor: 'pointer' },
  swipeWrap: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' },
  swipeCard: { background: 'white', borderRadius: '30px', padding: '20px', width: '100%', maxWidth: '400px', textAlign: 'center', border: '4px solid #fbcfe8' },
  swipeImg: { width: '100%', borderRadius: '20px', marginBottom: '15px' },
  voteRow: { display: 'flex', gap: '10px' },
  vBtn: { flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: '#f3f4f6', fontWeight: 'bold' },
  vBtnPink: { flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: '#fbcfe8', color: '#db2777', fontWeight: 'bold' },
  sidebar: { position: 'fixed', top: 0, left: 0, width: '250px', height: '100%', background: 'white', zIndex: 200, padding: '20px', boxShadow: '5px 0 15px rgba(0,0,0,0.05)' },
  sideTab: { display: 'block', width: '100%', padding: '15px', textAlign: 'left', border: 'none', background: 'none', borderRadius: '10px', marginBottom: '5px', cursor: 'pointer', fontWeight: '600', color: '#666' },
  activeTab: { background: '#fff1f2', color: '#db2777' },
  closeBtn: { position: 'absolute', top: 15, right: 15, border: 'none', background: 'none', fontSize: '20px' },
  userSection: { marginBottom: '40px' },
  userHeading: { color: '#db2777', marginBottom: '15px', borderBottom: '2px solid #fbcfe8' },
  userGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' },
  userGridImg: { width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '10px' },
  uploadCard: { maxWidth: '500px', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '25px', textAlign: 'center', border: '2px solid #fbcfe8' },
  textArea: { width: '100%', height: '100px', padding: '15px', borderRadius: '15px', border: '1px solid #fbcfe8', marginBottom: '20px' },
  submitBtn: { width: '100%', padding: '15px', background: '#db2777', color: 'white', borderRadius: '15px', border: 'none', fontWeight: 'bold' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' }
};