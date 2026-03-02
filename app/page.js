'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormPulseGarden() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]); // This will be our active queue
  const [history, setHistory] = useState([]); // Array of full objects for undo
  const [activeTab, setActiveTab] = useState('home'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('all'); 
  const [hasMounted, setHasMounted] = useState(false);
  const [swipeDir, setSwipeDir] = useState(''); 
  const [affirmation, setAffirmation] = useState('');

  const phrases = [
    "Every flower blooms in its own time. You are doing great.",
    "Your presence makes this garden more beautiful.",
    "Bloom where you are planted, and keep reaching for the sun.",
    "Like a seedling, you are stronger than you know.",
    "Take a deep breath. Even the garden rests sometimes.",
    "You are a rare bloom in a field of ordinary."
  ];

  useEffect(() => {
    setHasMounted(true);
    setAffirmation(phrases[Math.floor(Math.random() * phrases.length)]);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data, error } = await supabase
        .from('captions')
        .select(`id, content, images!image_id ( url ), caption_votes ( vote_value )`)
        .order('id', { ascending: false });

      if (error) throw error;

      const formatted = data.map(cap => {
        const votes = cap.caption_votes || [];
        return {
          ...cap,
          content: cap.content || "",
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

  // --- REWIRED LOGIC: THE QUEUE SYSTEM ---

  const handleVote = async (value) => {
    if (captions.length === 0) return;
    const currentCard = captions[0]; // Always act on the first card
    
    setSwipeDir(value === 1 ? 'right' : 'left');
    
    try {
      await supabase.from('caption_votes').upsert({
        caption_id: currentCard.id, profile_id: user.id, vote_value: value,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });
      
      setTimeout(() => {
        setHistory(prev => [currentCard, ...prev]); // Save full card to undo
        setCaptions(prev => prev.slice(1)); // Remove the first card
        setSwipeDir('');
      }, 450);
    } catch (err) { setSwipeDir(''); }
  };

  const handleSkip = () => {
    if (captions.length <= 1) return;
    setCaptions(prev => {
      const [first, ...rest] = prev;
      return [...rest, first]; // Move first card to the end
    });
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const lastCard = history[0];
    
    try {
      await supabase.from('caption_votes').delete().match({ caption_id: lastCard.id, profile_id: user.id });
      setHistory(prev => prev.slice(1)); // Remove from history
      setCaptions(prev => [lastCard, ...prev]); // Put it back at the front
    } catch (err) { console.error(err); }
  };

  // For the Wall/Search tabs, we still want a sorted view of everything
  const wallData = useMemo(() => {
    let list = [...captions, ...history]; // Combine everything for the list view
    if (sortMode === 'high') list.sort((a, b) => b.net - a.net);
    if (sortMode === 'low') list.sort((a, b) => a.net - b.net);
    if (searchQuery.trim()) {
      list = list.filter(c => c.content?.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [captions, history, sortMode, searchQuery]);

  if (!hasMounted) return null;
  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Gardener";

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        @keyframes slowRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes drift {
          0% { transform: translateY(-10vh) translateX(0) rotate(0); opacity: 1; }
          100% { transform: translateY(110vh) translateX(100px) rotate(360deg); opacity: 0; }
        }
        .petal-drift { position: fixed; top: -10%; color: #fbcfe8; font-size: 24px; animation: drift 15s linear infinite; z-index: 0; pointer-events: none; }
        .flower-rotate { animation: slowRotate 70s linear infinite; }
        .swipe-right { animation: swipeRight 0.5s forwards; }
        .swipe-left { animation: swipeLeft 0.5s forwards; }
        @keyframes swipeRight { 100% { transform: translateX(150%) rotate(20deg); opacity: 0; } }
        @keyframes swipeLeft { 100% { transform: translateX(-150%) rotate(-20deg); opacity: 0; } }
      ` }} />

      {[...Array(6)].map((_, i) => (
        <div key={i} className="petal-drift" style={{ left: `${Math.random() * 100}%`, animationDelay: `${i * 2}s` }}>🌸</div>
      ))}

      <nav style={styles.header}><h1 style={styles.logo}>DormPulse.</h1></nav>

      <main style={styles.content}>
        
        {/* TAB: HOME */}
        {activeTab === 'home' && (
          <div style={styles.centerContainer}>
            {captions.length > 0 ? (
              <>
                <div className={swipeDir === 'right' ? 'swipe-right' : swipeDir === 'left' ? 'swipe-left' : ''} style={styles.pastelCard}>
                  <img src={captions[0].display_url} style={styles.cardImg} />
                  <div style={styles.cardBody}>
                    <p style={styles.cardCaption}>“{captions[0].content}”</p>
                    <div style={styles.actionRow}>
                      <button onClick={() => handleVote(-1)} style={styles.trashBtn}>👎</button>
                      <button onClick={() => handleVote(1)} style={styles.fireBtn}>💖</button>
                    </div>
                  </div>
                </div>

                <div style={styles.utilityRow}>
                  <button onClick={handleUndo} disabled={history.length === 0} style={{...styles.utilBtn, opacity: history.length === 0 ? 0.3 : 1}}>
                    ↩️ Undo
                  </button>
                  <button onClick={handleSkip} style={{...styles.utilBtn, background: '#f3e8ff', borderColor: '#d8b4fe'}}>
                    ⏭️ Skip
                  </button>
                </div>
              </>
            ) : (
              <div style={styles.doneBox}>
                <h1 style={{fontSize:'40px', color: '#db2777'}}>GARDEN CLEAR! 🌸</h1>
                <button onClick={fetchData} style={styles.resetBtn}>Refresh Garden</button>
              </div>
            )}
          </div>
        )}

        {/* TAB: THE BIG FLOWER */}
        {activeTab === 'wall' && (
          <div style={styles.centerContainer}>
            <div className="flower-rotate" style={styles.giantFlowerWrapper}>
              {[
                { deg: 0, lab: 'View All', mode: 'all' },
                { deg: 60, lab: 'Highest Voted Sorted', mode: 'high' },
                { deg: 120, lab: 'Lowest Voted Sorted', mode: 'low' },
                { deg: 180, lab: 'View All', mode: 'all' },
                { deg: 240, lab: 'Highest Voted Sorted', mode: 'high' },
                { deg: 300, lab: 'Lowest Voted Sorted', mode: 'low' }
              ].map((petal, i) => (
                <div key={i} style={{...styles.giantPetal, transform: `rotate(${petal.deg}deg) translateY(-145px)`}} 
                     onClick={() => { setSortMode(petal.mode); setActiveTab('search'); }}>
                  <div style={{transform: `rotate(-${petal.deg}deg)`, fontSize: '11px', fontWeight:'600', color:'#fff', textAlign:'center', width: '80%'}}>
                    {petal.lab}
                  </div>
                </div>
              ))}
              <div style={styles.giantCenter}>Dorm<br/>Pulse</div>
            </div>
          </div>
        )}

        {/* TAB: SEARCH */}
        {activeTab === 'search' && (
          <div style={styles.searchView}>
            <h2 style={{color:'#db2777', textAlign:'center'}}>The Wall</h2>
            <input style={styles.searchBar} placeholder="Search names or words..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <div style={styles.fullWidthFeed}>
              {wallData.map(c => (
                <div key={c.id} style={styles.feedItem}>
                  <img src={c.display_url} style={styles.feedImg} />
                  <div style={styles.feedPadding}>
                    <p style={styles.feedText}>“{c.content}”</p>
                    <div style={styles.voteDisplay}><span>👍 {c.upvotes}</span><span>👎 {c.downvotes}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: ACCOUNT */}
        {activeTab === 'account' && (
          <div style={styles.centerContainer}>
            <div style={styles.uploadCard}>
              <div style={styles.avatar}>{userName.charAt(0).toUpperCase()}</div>
              <h3 style={{margin: '0'}}>Hi, {userName}!</h3>
              <p style={styles.affirmationStyle}>"{affirmation}"</p>
              <button onClick={() => setActiveTab('about')} style={styles.aboutBtn}>About Nabiha's Project</button>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>Logout</button>
            </div>
          </div>
        )}

        {/* TAB: ABOUT */}
        {activeTab === 'about' && (
          <div style={styles.centerContainer}>
            <div style={styles.aboutCard}>
              <h2 style={{color: '#db2777'}}>DormPulse</h2>
              <p>Created by <strong>Nabiha Irfan</strong>.</p>
              <div style={styles.aboutText}>
                In the long process it took to make, you can now generate captions and vote for them. Every pulse is a memory planted in our shared garden. 🌸
              </div>
              <button onClick={() => setActiveTab('account')} style={styles.resetBtn}>Back to Me</button>
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
  page: { background: '#fff5f7', backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-1-3-4-5-7-5-4 0-7 3-7 7 0 3 2 6 5 7-3 1-5 4-5 7 0 4 3 7 7 7 3 0 6-2 7-5 1 3 4 5 7 5 4 0 7-3 7-7 0-3-2-6-5-7 3-1 5-4 5-7 0-4-3-7-7-7-3 0-6 2-7 5z' fill='%23fbcfe8' fill-opacity='0.4'/%3E%3C/svg%3E")`, minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #fce7f3', zIndex: 1000 },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 },
  centerContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  giantFlowerWrapper: { position: 'relative', width: '150px', height: '150px' },
  giantPetal: { position: 'absolute', width: '115px', height: '175px', background: 'linear-gradient(to bottom, #ff85a2, #db2777)', borderRadius: '50% 50% 50% 50% / 80% 80% 20% 20%', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', left: '17px', boxShadow: '0 8px 20px rgba(219,39,119,0.3)' },
  giantCenter: { position: 'absolute', top: '25px', left: '25px', width: '100px', height: '100px', background: '#ffb3c1', borderRadius: '50%', border: '5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '600', color: '#db2777', textAlign:'center', zIndex: 10 },
  pastelCard: { background: '#fff', borderRadius: '35px', width: '100%', maxWidth: '360px', overflow: 'hidden', border: '4px solid #fbcfe8', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
  cardImg: { width: '100%', maxHeight: '45vh', objectFit: 'contain', background: '#f9f9f9' },
  cardBody: { padding: '25px', textAlign: 'center' },
  cardCaption: { fontSize: '22px', fontWeight: '600' },
  actionRow: { display: 'flex', gap: '15px', marginTop: '10px' },
  fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '16px', borderRadius: '20px', border: 'none', fontSize: '20px' },
  trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '16px', borderRadius: '20px', border: 'none', fontSize: '20px' },
  utilityRow: { display: 'flex', gap: '40px', marginTop: '25px' },
  utilBtn: { background: 'white', border: '2px solid #fbcfe8', padding: '8px 18px', borderRadius: '15px', color: '#db2777', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
  searchView: { paddingTop: '80px', paddingBottom: '100px', maxWidth: '500px', margin: '0 auto', paddingLeft:'15px', paddingRight:'15px' },
  searchBar: { width: '100%', padding: '15px', borderRadius: '20px', border: '2px solid #fbcfe8', marginBottom: '20px', outline: 'none' },
  fullWidthFeed: { display: 'flex', flexDirection: 'column', gap: '25px' },
  feedItem: { background: '#fff', borderRadius: '30px', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' },
  feedImg: { width: '100%', height: 'auto' },
  feedPadding: { padding: '20px' },
  feedText: { fontSize: '18px', fontWeight: '600' },
  voteDisplay: { display: 'flex', gap: '20px', marginTop: '10px', fontWeight: '600', color: '#db2777' },
  uploadCard: { background: '#fff', padding: '40px', borderRadius: '40px', textAlign: 'center', border: '3px solid #fbcfe8', width: '100%', maxWidth: '320px' },
  avatar: { width: '80px', height: '80px', background: '#fbcfe8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#db2777', fontSize: '30px', fontWeight: '600' },
  affirmationStyle: { fontStyle: 'italic', color: '#db2777', margin: '15px 0 25px', fontSize: '16px', lineHeight: '1.4' },
  aboutBtn: { display: 'block', width: '100%', margin: '10px 0', padding: '12px', borderRadius: '15px', background: '#fbcfe8', border: 'none', color: '#db2777', fontWeight: '600' },
  logoutBtn: { width: '100%', padding: '12px', borderRadius: '15px', border: '2px solid #db2777', background: 'none', color: '#db2777', fontWeight: '600' },
  aboutCard: { background: '#fff', padding: '40px', borderRadius: '40px', border: '3px solid #fbcfe8', textAlign: 'center', maxWidth: '350px' },
  aboutText: { marginTop: '20px', lineHeight: '1.6', color: '#666', marginBottom: '20px' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '85px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3', zIndex: 1000 },
  navBtn: { border: 'none', background: 'none', color: '#db2777', fontWeight: '600', fontSize: '11px' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' },
  doneBox: { textAlign: 'center', padding: '20px' },
  resetBtn: { marginTop: '10px', color: '#db2777', fontWeight: '600', background: 'none', border: 'none', textDecoration: 'underline' }
};