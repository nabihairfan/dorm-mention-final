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

      // 2. Fetch Data (Captions + Images + Profiles)
      const { data, error } = await supabase
        .from('captions')
        .select(`id, content, image_id, profile_id, created_at, images!image_id(url), profiles:profile_id(email)`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 3. Filter out any accidental empty captions
      const formatted = data
        .filter(c => c.content && c.content.trim() !== "") 
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

  // VOTING FIX: Ensure this is called with the correct ID
  const handleVote = async (id, val) => {
    try {
      const { error } = await supabase.from('caption_votes').upsert({
        caption_id: id, 
        profile_id: user.id, 
        vote_value: val
      }, { onConflict: 'caption_id, profile_id' });
      
      if (error) throw error;
      fetchData(); // Refresh to update UI
    } catch (e) { 
      console.error("Vote Error:", e);
    }
  };

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

  // Grouping for "Find Users"
  const userGroups = useMemo(() => {
    return allData.reduce((acc, curr) => {
      (acc[curr.uploader] = acc[curr.uploader] || []).push(curr);
      return acc;
    }, {});
  }, [allData]);

  const wallData = useMemo(() => {
    if (!searchQuery) return allData;
    return allData.filter(c => c.content.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allData, searchQuery]);

  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  const voteQueue = allData.filter(c => c.userVote === 0);

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        .petal { position: fixed; top: -10%; color: #fbcfe8; animation: drift 15s linear infinite; z-index: -1; pointer-events: none; }
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); opacity: 0.8; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
      ` }} />

      {/* BACKGROUND (Forced to the back) */}
      <div style={styles.bgOverlay} />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="petal" style={{ left: `${i * 18}%`, animationDelay: `${i * 2}s` }}>🌸</div>
      ))}

      <nav style={styles.header}>
        <button onClick={() => setSidebarOpen(true)} style={styles.menuIcon}>☰</button>
        <h1 style={styles.logo}>DormPulse.</h1>
        <div style={{width: 30}} />
      </nav>

      <main style={styles.content}>
        
        {/* VOTE QUEUE */}
        {activeTab === 'home' && (
          <div style={styles.centerWrap}>
            {voteQueue.length > 0 ? (
              <div style={styles.card}>
                <img src={voteQueue[0].display_url} style={styles.cardImg} />
                <div style={styles.cardPadding}>
                  <p style={styles.captionMain}>“{voteQueue[0].content}”</p>
                  <div style={styles.voteRow}>
                    <button onClick={() => handleVote(voteQueue[0].id, -1)} style={styles.vBtn}>👎</button>
                    <button onClick={() => handleVote(voteQueue[0].id, 1)} style={styles.vBtnPink}>💖</button>
                  </div>
                </div>
              </div>
            ) : <div style={{textAlign:'center'}}><h2>Garden Clear! 🌸</h2></div>}
          </div>
        )}

        {/* THE WALL (FIXED IMAGE SCALING) */}
        {activeTab === 'wall' && (
          <div style={styles.listWrap}>
            <input placeholder="Search garden..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchBar} />
            {wallData.map(c => (
              <div key={c.id} style={styles.wallItem}>
                <img src={c.display_url} style={styles.wallImg} />
                <div style={{padding: 15}}>
                  <p style={{fontWeight: 600}}>“{c.content}”</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FIND USERS TAB */}
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

        {/* ACCOUNT / UPLOAD */}
        {activeTab === 'post' && (
          <div style={styles.centerWrap}>
            <div style={styles.formCard}>
              <h2 style={{color: '#db2777'}}>New Bloom</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{margin: '15px 0'}} />
              <textarea value={generatedCaption} onChange={(e) => setGeneratedCaption(e.target.value)} style={styles.textArea} placeholder="Caption here..." />
              <button onClick={handleUpload} disabled={uploading} style={styles.submitBtn}>{uploading ? "Planting..." : "Post"}</button>
            </div>
          </div>
        )}

      </main>

      <nav style={styles.footer}>
        <button onClick={() => setActiveTab('home')} style={styles.footBtn}>🏠</button>
        <button onClick={() => setActiveTab('post')} style={styles.footBtn}>➕</button>
        <button onClick={() => setActiveTab('wall')} style={styles.footBtn}>🖼️</button>
        <button onClick={() => setActiveTab('users')} style={styles.footBtn}>👥</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  bgOverlay: { position: 'fixed', inset: 0, zIndex: -2, background: '#fff5f7' },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 100, borderBottom: '1px solid #fce7f3' },
  content: { paddingTop: '80px', paddingBottom: '100px', position: 'relative', zIndex: 10 },
  centerWrap: { display: 'flex', justifyContent: 'center', padding: '20px' },
  card: { background: 'white', borderRadius: '30px', width: '100%', maxWidth: '380px', border: '4px solid #fbcfe8', overflow: 'hidden', position: 'relative', zIndex: 20 },
  cardImg: { width: '100%', height: '350px', objectFit: 'cover' },
  cardPadding: { padding: '20px', textAlign: 'center' },
  voteRow: { display: 'flex', gap: '15px' },
  vBtn: { flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: '#f3f4f6', fontSize: '20px', cursor: 'pointer' },
  vBtnPink: { flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: '#fbcfe8', color: '#db2777', fontSize: '20px', cursor: 'pointer' },
  wallItem: { background: 'white', borderRadius: '25px', overflow: 'hidden', border: '1px solid #fce7f3', marginBottom: '20px' },
  wallImg: { width: '100%', height: 'auto', display: 'block' }, // Requirement: Fixed scaling
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  gridImg: { width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '10px' },
  footer: { position: 'fixed', bottom: 0, width: '100%', height: '70px', background: 'white', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 100 },
  footBtn: { border: 'none', background: 'none', fontSize: '22px', cursor: 'pointer' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' },
  // ... rest of styles
};