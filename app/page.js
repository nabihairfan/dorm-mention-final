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
  const [searchQuery, setSearchQuery] = useState('');
  
  // Upload States
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');

  // DATA FETCHING (Fixed Logic)
  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // 1. Get user's current votes
      const { data: userVotes } = await supabase.from('caption_votes')
        .select('caption_id, vote_value')
        .eq('profile_id', session.user.id);
      
      const userVoteMap = Object.fromEntries(userVotes?.map(v => [v.caption_id, v.vote_value]) || []);

      // 2. Fetch Captions + Joined Images/Profiles
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
        .filter(c => c.content?.trim()) 
        .map(c => ({
          ...c,
          display_url: c.images?.url || '',
          // FIX: If not in map, set to null so the queue knows it's unvoted
          userVote: userVoteMap[c.id] !== undefined ? userVoteMap[c.id] : null,
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

  // VOTING (Fixed Logic)
  const handleVote = async (id, val) => {
    try {
      const { error } = await supabase.from('caption_votes').upsert({
        caption_id: id, 
        profile_id: user.id, 
        vote_value: val
      }, { onConflict: 'caption_id, profile_id' });
      
      if (error) throw error;
      fetchData(); // Refresh list to remove from queue
    } catch (e) { 
      console.error("Vote Error:", e);
    }
  };

  // UPLOAD
  const handleUpload = async () => {
    if (!file || !caption) return alert("Add a photo and caption! 🌸");
    setUploading(true);
    try {
      const name = `${user.id}/${Date.now()}-${file.name}`;
      await supabase.storage.from('pulse-images').upload(name, file);
      const { data: { publicUrl } } = supabase.storage.from('pulse-images').getPublicUrl(name);
      
      const { data: img } = await supabase.from('images').insert([{ url: publicUrl, profile_id: user.id }]).select().single();
      await supabase.from('captions').insert([{ content: caption, image_id: img.id, profile_id: user.id }]);
      
      setFile(null); setCaption(''); setActiveTab('wall'); fetchData();
    } catch (e) { alert("Upload failed"); }
    finally { setUploading(false); }
  };

  // FEATURE: Grouping for "Find Users"
  const userGroups = useMemo(() => {
    return allData.reduce((acc, curr) => {
      (acc[curr.uploader] = acc[curr.uploader] || []).push(curr);
      return acc;
    }, {});
  }, [allData]);

  // FEATURE: Filter for "The Wall"
  const wallData = useMemo(() => {
    return allData.filter(c => c.content.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allData, searchQuery]);

  // FEATURE: The Vote Queue (Filters out already voted)
  const voteQueue = allData.filter(m => m.userVote === null);

  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        .petal { position: fixed; top: -10%; color: #fbcfe8; animation: drift 15s linear infinite; z-index: -1; pointer-events: none; }
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); opacity: 0.8; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
      ` }} />

      {/* BACKGROUND EFFECTS */}
      <div style={styles.bgOverlay} />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="petal" style={{ left: `${i * 18}%`, animationDelay: `${i * 2}s` }}>🌸</div>
      ))}

      {/* TOP HEADER */}
      <nav style={styles.header}>
        <div style={{width: 30}} />
        <h1 style={styles.logo}>DormPulse.</h1>
        <div style={{width: 30}} />
      </nav>

      <main style={styles.content}>
        
        {/* HOME / SWIPE MODE */}
        {activeTab === 'home' && (
          <div style={styles.centerWrap}>
            {voteQueue.length > 0 ? (
              <div style={styles.card}>
                <img src={voteQueue[0].display_url} style={styles.cardImg} />
                <div style={styles.cardPadding}>
                  <p style={styles.uploaderName}>@{voteQueue[0].uploader}</p>
                  <p style={styles.captionMain}>“{voteQueue[0].content}”</p>
                  <div style={styles.voteRow}>
                    <button onClick={() => handleVote(voteQueue[0].id, -1)} style={styles.vBtn}>👎</button>
                    <button onClick={() => handleVote(voteQueue[0].id, 1)} style={styles.vBtnPink}>💖</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{textAlign:'center'}}>
                <h2>Garden Clear! 🏁</h2>
                <button onClick={fetchData} style={styles.refreshBtn}>Refresh Garden</button>
              </div>
            )}
          </div>
        )}

        {/* THE WALL (GALLERY) */}
        {activeTab === 'wall' && (
          <div style={styles.listWrap}>
            <input 
              placeholder="Search captions..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              style={styles.searchBar} 
            />
            {wallData.map(c => (
              <div key={c.id} style={styles.wallItem}>
                <img src={c.display_url} style={styles.wallImg} />
                <div style={{padding: '15px'}}>
                  <p style={{fontWeight: 600, color: '#db2777'}}>@{c.uploader}</p>
                  <p>“{c.content}”</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FIND USERS (DISCOVER) */}
        {activeTab === 'users' && (
          <div style={styles.listWrap}>
            {Object.entries(userGroups).map(([name, posts]) => (
              <div key={name} style={{marginBottom: 40}}>
                <h3 style={styles.userHeading}>{name}'s Garden</h3>
                <div style={styles.grid}>
                  {posts.map(p => <img key={p.id} src={p.display_url} style={styles.gridImg} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* UPLOAD MODE */}
        {activeTab === 'post' && (
          <div style={styles.centerWrap}>
            <div style={styles.formCard}>
              <h2 style={{color: '#db2777'}}>New Bloom</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{margin: '15px 0'}} />
              <textarea 
                value={caption} 
                onChange={(e) => setCaption(e.target.value)} 
                style={styles.textArea} 
                placeholder="What's the vibe?" 
              />
              <button onClick={handleUpload} disabled={uploading} style={styles.submitBtn}>
                {uploading ? "Planting..." : "Share to Garden"}
              </button>
            </div>
          </div>
        )}

      </main>

      {/* NAVIGATION BAR (Original Style) */}
      <nav style={styles.footer}>
        <button onClick={() => setActiveTab('home')} style={{...styles.footBtn, opacity: activeTab === 'home' ? 1 : 0.4}}>🏠</button>
        <button onClick={() => setActiveTab('post')} style={{...styles.footBtn, opacity: activeTab === 'post' ? 1 : 0.4}}>➕</button>
        <button onClick={() => setActiveTab('wall')} style={{...styles.footBtn, opacity: activeTab === 'wall' ? 1 : 0.4}}>🖼️</button>
        <button onClick={() => setActiveTab('users')} style={{...styles.footBtn, opacity: activeTab === 'users' ? 1 : 0.4}}>👥</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  bgOverlay: { position: 'fixed', inset: 0, zIndex: -2, background: '#fff5f7' },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, borderBottom: '1px solid #fce7f3' },
  logo: { fontSize: '24px', color: '#db2777', fontWeight: 'bold', letterSpacing: '-1px' },
  content: { paddingTop: '80px', paddingBottom: '100px' },
  centerWrap: { display: 'flex', justifyContent: 'center', padding: '0 20px' },
  listWrap: { maxWidth: '600px', margin: '0 auto', padding: '0 20px' },
  card: { background: 'white', borderRadius: '30px', width: '100%', maxWidth: '380px', border: '4px solid #fbcfe8', overflow: 'hidden', boxShadow: '0 10px 20px rgba(219,39,119,0.05)' },
  cardImg: { width: '100%', height: '380px', objectFit: 'cover' },
  cardPadding: { padding: '20px', textAlign: 'center' },
  uploaderName: { fontSize: '14px', color: '#db2777', marginBottom: '5px', fontWeight: 'bold' },
  captionMain: { fontSize: '18px', marginBottom: '20px', fontWeight: '500' },
  voteRow: { display: 'flex', gap: '15px' },
  vBtn: { flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: '#f3f4f6', fontSize: '20px', cursor: 'pointer' },
  vBtnPink: { flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: '#fbcfe8', color: '#db2777', fontSize: '20px', cursor: 'pointer' },
  searchBar: { width: '100%', padding: '12px 20px', borderRadius: '25px', border: '2px solid #fbcfe8', marginBottom: '20px', outline: 'none' },
  wallItem: { background: 'white', borderRadius: '25px', overflow: 'hidden', border: '1px solid #fce7f3', marginBottom: '20px' },
  wallImg: { width: '100%', height: 'auto', display: 'block' },
  userHeading: { color: '#db2777', borderBottom: '2px solid #fbcfe8', paddingBottom: '5px', marginBottom: '15px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  gridImg: { width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '15px' },
  formCard: { background: 'white', borderRadius: '30px', width: '100%', maxWidth: '400px', padding: '30px', border: '2px solid #fbcfe8', textAlign: 'center' },
  textArea: { width: '100%', height: '100px', padding: '15px', borderRadius: '15px', border: '1px solid #fce7f3', marginBottom: '15px', fontFamily: 'inherit' },
  submitBtn: { width: '100%', padding: '15px', borderRadius: '15px', border: 'none', background: '#db2777', color: 'white', fontWeight: 'bold', cursor: 'pointer' },
  footer: { position: 'fixed', bottom: 0, width: '100%', height: '70px', background: 'white', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3', zIndex: 100 },
  footBtn: { border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', transition: '0.2s' },
  refreshBtn: { marginTop: '10px', padding: '10px 20px', borderRadius: '20px', border: 'none', background: '#fbcfe8', color: '#db2777', fontWeight: 'bold' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777', fontSize: '20px' }
};