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
  const [activeTab, setActiveTab] = useState('home'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('all'); 
  const [hasMounted, setHasMounted] = useState(false);
  const [swipeDir, setSwipeDir] = useState(''); 
  const [affirmation, setAffirmation] = useState('');
  
  // States for the Upload Process
  const [isUploading, setIsUploading] = useState(false);

  const phrases = useMemo(() => [
    "Every flower blooms in its own time. You are doing great.",
    "Your presence makes this garden more beautiful.",
    "Bloom where you are planted, and keep reaching for the sun.",
    "Like a seedling, you are stronger than you know.",
    "Take a deep breath. Even the garden rests sometimes.",
    "You are a rare bloom in a field of ordinary."
  ], []);

  useEffect(() => {
    setHasMounted(true);
    setAffirmation(phrases[Math.floor(Math.random() * phrases.length)]);
  }, [phrases]);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      // 1. Get IDs of captions this user has ALREADY voted for
      const { data: votedData } = await supabase
        .from('caption_votes')
        .select('caption_id')
        .eq('profile_id', session.user.id);
      
      const votedIds = votedData?.map(v => v.caption_id) || [];

      // 2. Fetch only captions NOT in the votedIds list
      // This ensures you never see your own stuff twice or re-vote on refresh
      const { data, error } = await supabase
        .from('captions')
        .select(`id, content, images!image_id ( url ), caption_votes ( vote_value )`)
        .not('id', 'in', `(${votedIds.length > 0 ? votedIds.join(',') : '0'})`)
        .order('id', { ascending: false });

      if (error) throw error;

      const formatted = data.map(cap => {
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
    } catch (err) { 
      console.error("Fetch error:", err); 
    } finally { 
      setLoading(false); 
    }
  }, [router]);

  useEffect(() => { 
    if (hasMounted) fetchData(); 
  }, [hasMounted, fetchData]);

  // --- THE PERMANENT MUTATION LOGIC ---
  const saveNewPulseToDatabase = async (imageUrl, generatedText) => {
    setIsUploading(true);
    try {
      // 1. Insert into 'images' table first to get the image_id
      const { data: imgData, error: imgErr } = await supabase
        .from('images')
        .insert([{ url: imageUrl, profile_id: user.id }])
        .select()
        .single();

      if (imgErr) throw imgErr;

      // 2. Insert into 'captions' table using that image_id
      const { error: capErr } = await supabase
        .from('captions')
        .insert([{ 
          content: generatedText, 
          image_id: imgData.id,
          profile_id: user.id 
        }]);

      if (capErr) throw capErr;

      // 3. Refresh the garden so the user (and everyone else) can see it!
      fetchData();
      alert("Pulse planted! Your memory is now part of the garden forever. 🌸");
    } catch (err) {
      console.error("Mutation error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleVote = async (value) => {
    if (captions.length === 0) return;
    const currentCard = captions[0];
    setSwipeDir(value === 1 ? 'right' : 'left');
    
    try {
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

  const handleUndo = async () => {
    if (history.length === 0) return;
    const lastCard = history[0];
    try {
      await supabase.from('caption_votes').delete().match({ caption_id: lastCard.id, profile_id: user.id });
      setHistory(prev => prev.slice(1)); 
      setCaptions(prev => [lastCard, ...prev]); 
    } catch (err) { console.error(err); }
  };

  if (!hasMounted) return null;
  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Gardener";

  return (
    <div style={styles.page}>
       {/* Styles and Petal Drift remain the same as previous version */}
       <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        .petal-drift { position: fixed; top: -10%; color: #fbcfe8; font-size: 24px; animation: drift 15s linear infinite; z-index: 0; pointer-events: none; }
        @keyframes drift { 0% { transform: translateY(-10vh) rotate(0); } 100% { transform: translateY(110vh) rotate(360deg); } }
        .swipe-right { animation: swipeRight 0.5s forwards; }
        .swipe-left { animation: swipeLeft 0.5s forwards; }
        @keyframes swipeRight { 100% { transform: translateX(150%) rotate(20deg); opacity: 0; } }
        @keyframes swipeLeft { 100% { transform: translateX(-150%) rotate(-20deg); opacity: 0; } }
      ` }} />

      <nav style={styles.header}><h1 style={styles.logo}>DormPulse.</h1></nav>

      <main style={styles.content}>
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
                    <div style={styles.counter}>{captions.length} pulses remaining</div>
                  </div>
                </div>

                <div style={styles.utilityRow}>
                  <button onClick={handleUndo} disabled={history.length === 0} style={{...styles.utilBtn, opacity: history.length === 0 ? 0.3 : 1}}>↩️ Undo</button>
                  <button onClick={handleSkip} style={{...styles.utilBtn, background: '#f3e8ff', borderColor: '#d8b4fe'}}>⏭️ Skip</button>
                </div>
              </>
            ) : (
              <div style={styles.doneBox}>
                <h1 style={{fontSize:'40px', color: '#db2777'}}>GARDEN CLEAR! 🌸</h1>
                <p>You've voted on everything. Check back later for new blooms!</p>
                <button onClick={fetchData} style={styles.resetBtn}>Refresh for New Posts</button>
              </div>
            )}
          </div>
        )}

        {/* ... Rest of tabs (Wall, Search, Account) ... */}
        {activeTab === 'account' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <div style={styles.avatar}>{userName.charAt(0).toUpperCase()}</div>
              <h3>Hi, {userName}!</h3>
              <p style={styles.affirmationStyle}>"{affirmation}"</p>
              
              {/* This is where you would call saveNewPulseToDatabase after your generation logic */}
              <button onClick={() => setActiveTab('about')} style={styles.aboutBtn}>About Nabiha's Project</button>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>Logout</button>
            </div>
          </div>
        )}
      </main>

      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={styles.navBtn}>🏠<br/>Vote</button>
        <button onClick={() => setActiveTab('wall')} style={styles.navBtn}>🌸<br/>Garden</button>
        <button onClick={() => setActiveTab('search')} style={styles.navBtn}>🔍<br/>Search</button>
        <button onClick={() => setActiveTab('account')} style={styles.navBtn}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
    // ... all previous styles ...
    counter: { marginTop: '15px', fontSize: '11px', color: '#db2777', fontWeight: '600', opacity: 0.6, letterSpacing: '1px', textTransform: 'uppercase' },
    page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
    header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #fce7f3', zIndex: 1000 },
    logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
    content: { minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 },
    centerContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    pastelCard: { background: '#fff', borderRadius: '35px', width: '100%', maxWidth: '360px', overflow: 'hidden', border: '4px solid #fbcfe8', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
    cardImg: { width: '100%', maxHeight: '45vh', objectFit: 'contain', background: '#f9f9f9' },
    cardBody: { padding: '25px', textAlign: 'center' },
    cardCaption: { fontSize: '22px', fontWeight: '600' },
    actionRow: { display: 'flex', gap: '15px', marginTop: '10px' },
    fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '16px', borderRadius: '20px', border: 'none', fontSize: '20px' },
    trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '16px', borderRadius: '20px', border: 'none', fontSize: '20px' },
    utilityRow: { display: 'flex', gap: '40px', marginTop: '25px' },
    utilBtn: { background: 'white', border: '2px solid #fbcfe8', padding: '8px 18px', borderRadius: '15px', color: '#db2777', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
    navBar: { position: 'fixed', bottom: 0, width: '100%', height: '85px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3', zIndex: 1000 },
    navBtn: { border: 'none', background: 'none', color: '#db2777', fontWeight: '600', fontSize: '11px' },
    loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' },
    doneBox: { textAlign: 'center', padding: '20px' },
    resetBtn: { marginTop: '10px', color: '#db2777', fontWeight: '600', background: 'none', border: 'none', textDecoration: 'underline' },
    uploadCard: { background: '#fff', padding: '40px', borderRadius: '40px', textAlign: 'center', border: '3px solid #fbcfe8', width: '100%', maxWidth: '320px' },
    avatar: { width: '80px', height: '80px', background: '#fbcfe8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#db2777', fontSize: '30px', fontWeight: '600' },
    affirmationStyle: { fontStyle: 'italic', color: '#db2777', margin: '15px 0 25px', fontSize: '16px', lineHeight: '1.4' },
    aboutBtn: { display: 'block', width: '100%', margin: '10px 0', padding: '12px', borderRadius: '15px', background: '#fbcfe8', border: 'none', color: '#db2777', fontWeight: '600' },
    logoutBtn: { width: '100%', padding: '12px', borderRadius: '15px', border: '2px solid #db2777', background: 'none', color: '#db2777', fontWeight: '600' },
};