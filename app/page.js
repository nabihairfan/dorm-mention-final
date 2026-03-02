'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormPulseGarden() {
  const router = useRouter();
  
  // App States
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]); 
  const [history, setHistory] = useState([]); 
  const [activeTab, setActiveTab] = useState('home'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('all'); 
  const [hasMounted, setHasMounted] = useState(false);
  const [swipeDir, setSwipeDir] = useState(''); 
  const [affirmation, setAffirmation] = useState('');

  // Upload States (The "Post" Tab is back!)
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState('');

  const phrases = useMemo(() => [
    "Every flower blooms in its own time. You are doing great.",
    "Your presence makes this garden more beautiful.",
    "Bloom where you are planted, and keep reaching for the sun.",
    "Like a seedling, you are stronger than you know.",
  ], []);

  useEffect(() => {
    setHasMounted(true);
    setAffirmation(phrases[Math.floor(Math.random() * phrases.length)]);
  }, [phrases]);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // 1. Find every ID the user has already voted on
      const { data: votedData } = await supabase
        .from('caption_votes')
        .select('caption_id')
        .eq('profile_id', session.user.id);
      
      const votedIds = votedData?.map(v => v.caption_id) || [];

      // 2. Fetch only the ones NOT in that list
      const { data, error } = await supabase
        .from('captions')
        .select(`id, content, images!image_id ( url ), caption_votes ( vote_value )`)
        .order('id', { ascending: false });

      if (error) throw error;

      // Filter locally to ensure fresh results even if DB is slow
      const filtered = data.filter(cap => !votedIds.includes(cap.id));

      const formatted = filtered.map(cap => {
        const votes = cap.caption_votes || [];
        return {
          ...cap,
          display_url: cap.images?.url || 'https://via.placeholder.com/400',
          upvotes: votes.filter(v => v.vote_value === 1).length,
          downvotes: votes.filter(v => v.vote_value === -1).length,
          net: votes.filter(v => v.vote_value === 1).length - votes.filter(v => v.vote_value === -1).length
        };
      });
      setCaptions(formatted);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { if (hasMounted) fetchData(); }, [hasMounted, fetchData]);

  // --- VOTE & SKIP ---
  const handleVote = async (value) => {
    if (captions.length === 0) return;
    const currentCard = captions[0];
    setSwipeDir(value === 1 ? 'right' : 'left');
    
    try {
      // PERMANENT SAVE:
      await supabase.from('caption_votes').upsert({
        caption_id: currentCard.id, profile_id: user.id, vote_value: value,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });
      
      setTimeout(() => {
        setHistory(prev => [currentCard, ...prev]); 
        setCaptions(prev => prev.slice(1)); 
        setSwipeDir('');
      }, 450);
    } catch (err) { setSwipeDir(''); }
  };

  const handleSkip = () => {
    if (captions.length <= 1) return;
    setCaptions(prev => {
      const [first, ...rest] = prev;
      return [...rest, first];
    });
  };

  // --- THE POST FUNCTION ---
  const handleUploadAndPost = async () => {
    if (!file || !generatedCaption) return alert("Select a photo and generate a caption first!");
    setUploading(true);
    try {
      // 1. Upload Image to Storage (Simplified for this example)
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from('pulse-images')
        .upload(fileName, file);

      if (storageError) throw storageError;
      const { data: { publicUrl } } = supabase.storage.from('pulse-images').getPublicUrl(fileName);

      // 2. Link to Database
      const { data: imgRecord } = await supabase.from('images').insert([{ url: publicUrl, profile_id: user.id }]).select().single();
      await supabase.from('captions').insert([{ content: generatedCaption, image_id: imgRecord.id, profile_id: user.id }]);

      alert("Memory Planted! 🌸");
      setFile(null);
      setGeneratedCaption('');
      setActiveTab('home');
      fetchData();
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
  };

  if (!hasMounted) return null;
  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  return (
    <div style={styles.page}>
      <nav style={styles.header}><h1 style={styles.logo}>DormPulse.</h1></nav>

      <main style={styles.content}>
        
        {/* HOME VOTE TAB */}
        {activeTab === 'home' && (
          <div style={styles.centerContainer}>
            {captions.length > 0 ? (
              <>
                <div className={swipeDir === 'right' ? 'swipe-right' : swipeDir === 'left' ? 'swipe-left' : ''} style={styles.pastelCard}>
                  <img src={captions[0].display_url} style={styles.cardImg} alt="Pulse" />
                  <div style={styles.cardBody}>
                    <p style={styles.cardCaption}>“{captions[0].content}”</p>
                    <div style={styles.actionRow}>
                      <button onClick={() => handleVote(-1)} style={styles.trashBtn}>👎</button>
                      <button onClick={() => handleVote(1)} style={styles.fireBtn}>💖</button>
                    </div>
                    <div style={styles.counter}>{captions.length} pulses left</div>
                  </div>
                </div>
                <div style={styles.utilityRow}>
                   <button onClick={handleSkip} style={styles.utilBtn}>⏭️ Skip</button>
                </div>
              </>
            ) : (
              <div style={styles.doneBox}><h1>GARDEN CLEAR! 🌸</h1><button onClick={fetchData} style={styles.resetBtn}>Refresh</button></div>
            )}
          </div>
        )}

        {/* POST TAB (REINSTATED) */}
        {activeTab === 'post' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <h2 style={{color:'#db2777'}}>Plant a Memory</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{marginBottom:'10px'}} />
              <textarea 
                placeholder="Write or generate a caption..." 
                value={generatedCaption}
                onChange={(e) => setGeneratedCaption(e.target.value)}
                style={styles.textArea}
              />
              <button onClick={handleUploadAndPost} disabled={uploading} style={styles.aboutBtn}>
                {uploading ? "Planting..." : "Post to Garden 🌸"}
              </button>
            </div>
          </div>
        )}

        {/* OTHER TABS (Search, Account) */}
        {activeTab === 'account' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <h3>Hi, {user?.email?.split('@')[0]}!</h3>
              <p style={styles.affirmationStyle}>"{affirmation}"</p>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>Logout</button>
            </div>
          </div>
        )}

      </main>

      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={styles.navBtn}>🏠<br/>Vote</button>
        <button onClick={() => setActiveTab('post')} style={styles.navBtn}>➕<br/>Post</button>
        <button onClick={() => setActiveTab('search')} style={styles.navBtn}>🔍<br/>Wall</button>
        <button onClick={() => setActiveTab('account')} style={styles.navBtn}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #fce7f3', zIndex: 1000 },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { paddingTop: '80px', paddingBottom: '100px' },
  centerContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  pastelCard: { background: '#fff', borderRadius: '35px', width: '100%', maxWidth: '360px', overflow: 'hidden', border: '4px solid #fbcfe8', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
  cardImg: { width: '100%', maxHeight: '45vh', objectFit: 'contain' },
  cardBody: { padding: '25px', textAlign: 'center' },
  cardCaption: { fontSize: '22px', fontWeight: '600' },
  actionRow: { display: 'flex', gap: '15px', marginTop: '10px' },
  fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '16px', borderRadius: '20px', border: 'none', fontSize: '20px' },
  trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '16px', borderRadius: '20px', border: 'none', fontSize: '20px' },
  counter: { marginTop: '15px', fontSize: '12px', color: '#db2777', opacity: 0.6 },
  utilityRow: { marginTop: '20px' },
  utilBtn: { background: '#f3e8ff', border: '2px solid #d8b4fe', padding: '10px 25px', borderRadius: '15px', color: '#db2777', fontWeight: '600' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '85px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3' },
  navBtn: { border: 'none', background: 'none', color: '#db2777', fontWeight: '600', fontSize: '11px' },
  uploadCard: { background: '#fff', padding: '30px', borderRadius: '30px', border: '3px solid #fbcfe8', width: '100%', maxWidth: '400px', textAlign:'center' },
  textArea: { width: '100%', height: '100px', borderRadius: '15px', border: '2px solid #fbcfe8', padding: '10px', marginTop: '10px', marginBottom: '10px' },
  aboutBtn: { width: '100%', padding: '12px', borderRadius: '15px', background: '#fbcfe8', border: 'none', color: '#db2777', fontWeight: '600' },
  logoutBtn: { width: '100%', padding: '12px', borderRadius: '15px', border: '2px solid #db2777', background: 'none', color: '#db2777', fontWeight: '600' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' },
  doneBox: { textAlign: 'center' },
  resetBtn: { color: '#db2777', background: 'none', border: 'none', textDecoration: 'underline' }
};