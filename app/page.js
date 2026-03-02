'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormPulseGarden() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [activeTab, setActiveTab] = useState('home'); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState([]); 
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pipeline & Upload
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data, error } = await supabase
        .from('captions')
        .select(`
          id, content, image_id, profile_id,
          images!image_id ( url ),
          caption_votes ( vote_value, profile_id )
        `)
        .order('id', { ascending: false });

      if (error) throw error;

      const formatted = data.map(cap => {
        const votes = cap.caption_votes || [];
        const score = votes.reduce((acc, v) => acc + v.vote_value, 0) || 0;
        const userVote = votes.find(v => v.profile_id === session.user.id);
        
        return { 
          ...cap, 
          display_url: cap.images?.url || 'https://via.placeholder.com/400',
          score,
          hasVoted: !!userVote
        };
      });

      setCaptions(formatted);
    } catch (err) { console.error("Fetch Error:", err); } 
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // VOTE LOGIC
  const unvotedCaptions = useMemo(() => captions.filter(c => !c.hasVoted), [captions]);

  const handleVote = async (captionId, value) => {
    // Save current state to history BEFORE voting
    setHistory(prev => [...prev, { id: captionId, index: currentIndex }]);
    
    try {
      await supabase.from('caption_votes').upsert({
        caption_id: captionId, profile_id: user.id, vote_value: value,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });
      
      await fetchData(); 
    } catch (err) { console.error("Vote Error:", err); }
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const lastAction = history[history.length - 1];
    
    try {
      // Remove the vote from the database
      await supabase.from('caption_votes')
        .delete()
        .match({ caption_id: lastAction.id, profile_id: user.id });
      
      setHistory(prev => prev.slice(0, -1));
      await fetchData();
    } catch (err) { console.error("Undo Error:", err); }
  };

  // ASSIGNMENT 4: THE PIPELINE (GENERATE & SAVE)
  const handlePipelineUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session.access_token;
      
      // Step 1: Presigned URL
      const r1 = await fetch('https://api.almostcrackd.ai/pipeline/generate-presigned-url', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type })
      });
      const { presignedUrl, cdnUrl } = await r1.json();

      // Step 2: PUT Image
      await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });

      // Step 3: Register
      const r3 = await fetch('https://api.almostcrackd.ai/pipeline/upload-image-from-url', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false })
      });
      const { imageId } = await r3.json();

      // Step 4: Generate
      const r4 = await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId })
      });
      const generated = await r4.json();

      // STEP 5: SAVE TO DATABASE (Critical for Grading)
      if (generated && generated.length > 0) {
        // 1. Insert Image record
        const { data: imgData, error: imgErr } = await supabase
          .from('images').insert([{ url: cdnUrl }]).select().single();
        if (imgErr) throw imgErr;

        // 2. Insert Caption record using the AI's content
        const { error: capErr } = await supabase.from('captions').insert([{
          content: generated[0].content, // This is the AI caption
          image_id: imgData.id,
          profile_id: user.id
        }]);
        if (capErr) throw capErr;
      }

      setFile(null);
      await fetchData();
      setActiveTab('wall'); // Go to wall to see the new post
    } catch (err) { 
      alert("Upload failed. Check console."); 
      console.error(err); 
    } finally { setUploading(false); }
  };

  // UI HELPERS
  const affirmations = [
    "You are blooming at your own pace. 🌸",
    "Your garden is beautiful because you are in it. ✨",
    "Keep growing, the world needs your light. 🌱"
  ];

  const filteredSearch = useMemo(() => {
    return captions.filter(c => c.content.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [captions, searchQuery]);

  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  return (
    <div style={styles.page}>
      <nav style={styles.header}><h1 style={styles.logo}>DormPulse.</h1></nav>

      <main style={styles.content}>
        {/* TAB 1: VOTE */}
        {activeTab === 'home' && (
          <div style={styles.view}>
            <div style={styles.counter}>{unvotedCaptions.length} Pulses Left 🌷</div>
            {unvotedCaptions.length > 0 ? (
              <>
                <div style={styles.pastelCard}>
                  <img src={unvotedCaptions[0].display_url} style={styles.cardImg} alt="meme" />
                  <div style={styles.cardBody}>
                    <p style={styles.cardCaption}>“{unvotedCaptions[0].content}”</p>
                    <div style={styles.actionRow}>
                      <button onClick={() => handleVote(unvotedCaptions[0].id, -1)} style={styles.trashBtn}>👎</button>
                      <button onClick={() => handleVote(unvotedCaptions[0].id, 1)} style={styles.fireBtn}>💖</button>
                    </div>
                  </div>
                </div>
                {history.length > 0 && <button onClick={handleUndo} style={styles.undoBtn}>↩️ Undo Last Vote</button>}
              </>
            ) : <div style={styles.doneBox}><h3>All Watered!</h3></div>}
          </div>
        )}

        {/* TAB 2: SEARCH */}
        {activeTab === 'search' && (
          <div style={styles.view}>
            <input 
              style={styles.searchBar} 
              placeholder="Search captions..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
            {filteredSearch.map(c => (
              <div key={c.id} style={styles.feedItem}>
                <img src={c.display_url} style={{width:'100%'}} />
                <p style={{padding:'10px'}}>“{c.content}” — ⭐ {c.score}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: POST */}
        {activeTab === 'upload' && (
          <div style={styles.view}>
            <div style={styles.uploadCard}>
              <h2 style={styles.title}>Plant a Memory</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
              <button onClick={handlePipelineUpload} disabled={uploading || !file} style={styles.genBtn}>
                {uploading ? 'AI is thinking...' : '✨ Generate & Plant'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: SEE UPLOADS (THE WALL) */}
        {activeTab === 'wall' && (
          <div style={styles.view}>
            <h2 style={styles.title}>The Collective Garden</h2>
            {Array.from(new Set(captions.map(c => c.profile_id))).map(pid => (
              <div key={pid} style={styles.userSection}>
                <h3 style={styles.userHeader}>{pid === user.id ? "✨ My Uploads" : `Gardener ${pid.slice(0,4)}`}</h3>
                <div style={styles.horizontalScroll}>
                  {captions.filter(c => c.profile_id === pid).map(c => (
                    <div key={c.id} style={styles.miniCard}>
                       <img src={c.display_url} style={styles.miniImg} />
                       <p style={{fontSize:'10px', textAlign:'center'}}>⭐ {c.score}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: ACCOUNT */}
        {activeTab === 'account' && (
          <div style={styles.view}>
            <div style={styles.uploadCard}>
              <div style={styles.avatar}>{user?.email?.charAt(0).toUpperCase()}</div>
              <h3>Hi, {user?.email?.split('@')[0]}!</h3>
              <div style={styles.affirmationBox}>
                <p>"{affirmations[Math.floor(Math.random() * affirmations.length)]}"</p>
              </div>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>Logout</button>
            </div>
          </div>
        )}
      </main>

      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={styles.navBtn}>🏠<br/>Vote</button>
        <button onClick={() => setActiveTab('search')} style={styles.navBtn}>🔍<br/>Search</button>
        <button onClick={() => setActiveTab('upload')} style={styles.navBtn}>➕<br/>Post</button>
        <button onClick={() => setActiveTab('wall')} style={styles.navBtn}>📸<br/>Uploads</button>
        <button onClick={() => setActiveTab('account')} style={styles.navBtn}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #fce7f3', zIndex: 1000 },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { paddingTop: '80px', paddingBottom: '100px', maxWidth: '400px', margin: '0 auto', padding: '15px' },
  view: { width: '100%' },
  counter: { textAlign: 'center', background: '#fbcfe8', padding: '10px', borderRadius: '20px', color: '#db2777', fontWeight: '600', marginBottom: '15px' },
  pastelCard: { background: '#fff', borderRadius: '30px', border: '3px solid #fbcfe8', overflow: 'hidden' },
  cardImg: { width: '100%', height: '300px', objectFit: 'cover' },
  cardBody: { padding: '20px', textAlign: 'center' },
  cardCaption: { fontSize: '18px', fontWeight: '600' },
  actionRow: { display: 'flex', gap: '10px', marginTop: '15px' },
  fireBtn: { flex: 1, background: '#fbcfe8', border: 'none', padding: '12px', borderRadius: '15px', color: '#db2777', fontWeight: '600', cursor: 'pointer' },
  trashBtn: { flex: 1, background: '#f3f4f6', border: 'none', padding: '12px', borderRadius: '15px', color: '#666', cursor: 'pointer' },
  undoBtn: { background: 'none', border: 'none', color: '#888', textDecoration: 'underline', width: '100%', marginTop: '15px', cursor: 'pointer' },
  searchBar: { width: '100%', padding: '12px', borderRadius: '15px', border: '2px solid #fbcfe8', marginBottom: '20px', outline: 'none' },
  feedItem: { background: '#fff', borderRadius: '20px', marginBottom: '15px', overflow: 'hidden', border: '1px solid #fce7f3' },
  uploadCard: { background: '#fff', padding: '25px', borderRadius: '25px', border: '3px solid #fbcfe8', textAlign: 'center' },
  fileInput: { marginBottom: '15px', width: '100%' },
  genBtn: { width: '100%', padding: '15px', background: '#db2777', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '600', cursor: 'pointer' },
  userSection: { marginBottom: '20px' },
  userHeader: { fontSize: '14px', color: '#db2777', marginBottom: '10px' },
  horizontalScroll: { display: 'flex', gap: '10px', overflowX: 'auto' },
  miniCard: { minWidth: '100px', background: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #eee' },
  miniImg: { width: '100px', height: '100px', objectFit: 'cover' },
  affirmationBox: { background: '#fff5f7', padding: '15px', borderRadius: '15px', margin: '15px 0', fontStyle: 'italic', color: '#db2777' },
  logoutBtn: { border: '2px solid #db2777', background: 'none', color: '#db2777', padding: '10px 20px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' },
  avatar: { width: '60px', height: '60px', background: '#fbcfe8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: '24px', color: '#db2777', fontWeight: '600' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '75px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3' },
  navBtn: { border: 'none', background: 'none', color: '#db2777', fontSize: '11px', fontWeight: '600', cursor: 'pointer' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' },
  title: { color: '#db2777', fontSize: '18px', marginBottom: '15px' },
  doneBox: { textAlign: 'center', padding: '50px', color: '#db2777' }
};