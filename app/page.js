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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('all'); // 'all', 'high', 'low'
  const [hasMounted, setHasMounted] = useState(false);
  const [swipeDir, setSwipeDir] = useState(''); 

  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);
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
        const ups = votes.filter(v => v.vote_value === 1).length;
        const downs = votes.filter(v => v.vote_value === -1).length;
        return {
          ...cap,
          display_url: cap.images?.url || 'https://via.placeholder.com/400',
          upvotes: ups,
          downvotes: downs,
          net: ups - downs
        };
      });
      setCaptions(formatted);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { if (hasMounted) fetchData(); }, [hasMounted, fetchData]);

  // Combined Search + Category Filter
  const filteredCaptions = useMemo(() => {
    let list = [...captions];
    if (sortMode === 'high') list.sort((a, b) => b.net - a.net);
    if (sortMode === 'low') list.sort((a, b) => a.net - b.net);
    
    if (searchQuery) {
      list = list.filter(c => c.content.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [captions, sortMode, searchQuery]);

  const handleVote = async (captionId, value) => {
    setSwipeDir(value === 1 ? 'right' : 'left');
    try {
      await supabase.from('caption_votes').upsert({
        caption_id: captionId, profile_id: user.id, vote_value: value,
        created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setSwipeDir('');
        fetchData();
      }, 450);
    } catch (err) { setSwipeDir(''); }
  };

  if (!hasMounted) return null;
  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        @keyframes slowRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulseCenter { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes swipeRight { 100% { transform: translateX(150%) rotate(20deg); opacity: 0; } }
        @keyframes swipeLeft { 100% { transform: translateX(-150%) rotate(-20deg); opacity: 0; } }
        .flower-rotate { animation: slowRotate 40s linear infinite; }
        .flower-center-pulse { animation: pulseCenter 4s ease-in-out infinite; }
        .swipe-right { animation: swipeRight 0.5s forwards; }
        .swipe-left { animation: swipeLeft 0.5s forwards; }
      ` }} />

      <nav style={styles.header}><h1 style={styles.logo}>DormPulse.</h1></nav>

      <main style={styles.content}>
        
        {/* TAB: HOME (Swiping) */}
        {activeTab === 'home' && (
          <div style={styles.centerContainer}>
            {currentIndex < captions.length ? (
              <div className={swipeDir === 'right' ? 'swipe-right' : swipeDir === 'left' ? 'swipe-left' : ''} style={styles.pastelCard}>
                <img src={captions[currentIndex].display_url} style={styles.cardImg} />
                <div style={styles.cardBody}>
                  <p style={styles.cardCaption}>“{captions[currentIndex].content}”</p>
                  <div style={styles.actionRow}>
                    <button onClick={() => handleVote(captions[currentIndex].id, -1)} style={styles.trashBtn}>👎</button>
                    <button onClick={() => handleVote(captions[currentIndex].id, 1)} style={styles.fireBtn}>💖</button>
                  </div>
                </div>
              </div>
            ) : <div style={styles.doneBox}><h1>FINITO! 🌸</h1><button onClick={() => setCurrentIndex(0)} style={styles.resetBtn}>Restart Garden</button></div>}
          </div>
        )}

        {/* TAB: THE MEGA FLOWER MENU */}
        {activeTab === 'wall' && (
          <div style={styles.centerContainer}>
            <div className="flower-rotate" style={styles.flowerWrapper}>
              {[
                { deg: 0, lab: 'View All', mode: 'all' },
                { deg: 60, lab: 'Highest', mode: 'high' },
                { deg: 120, lab: 'Lowest', mode: 'low' },
                { deg: 180, lab: 'View All', mode: 'all' },
                { deg: 240, lab: 'Highest', mode: 'high' },
                { deg: 300, lab: 'Lowest', mode: 'low' }
              ].map((petal, i) => (
                <div key={i} style={{...styles.prettyPetal, transform: `rotate(${petal.deg}deg) translateY(-90px)`}} 
                     onClick={() => { setSortMode(petal.mode); setActiveTab('search'); }}>
                  <div style={{transform: `rotate(-${petal.deg}deg)`, fontSize: '10px', fontWeight:'600', color:'#fff', textAlign:'center'}}>
                    {petal.lab}
                  </div>
                </div>
              ))}
              <div className="flower-center-pulse" style={styles.prettyCenter}>Dorm<br/>Pulse</div>
            </div>
            <p style={styles.flowerInstruction}>Pick a petal to explore categories</p>
          </div>
        )}

        {/* TAB: SEARCH GARDEN */}
        {activeTab === 'search' && (
          <div style={styles.searchView}>
            <div style={styles.searchHeader}>
              <h2 style={{margin:0, color:'#db2777'}}>Garden: {sortMode === 'all' ? 'All Seeds' : sortMode === 'high' ? 'Best Blooms' : 'Wilting Seeds'}</h2>
              <input style={styles.searchBar} placeholder="Search specific words..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div style={styles.wallGrid}>
              {filteredCaptions.map(c => (
                <div key={c.id} style={styles.wallItem}>
                  <img src={c.display_url} style={styles.wallImg} />
                  <div style={styles.wallPadding}>
                    <p style={styles.wallText}>{c.content}</p>
                    <div style={styles.voteDisplay}>
                      <span style={{color:'#10b981'}}>👍 {c.upvotes}</span>
                      <span style={{color:'#ef4444'}}>👎 {c.downvotes}</span>
                    </div>
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
              <div style={styles.avatar}>{user?.email?.[0].toUpperCase()}</div>
              <h3>Bloom where you are planted!</h3>
              <p style={styles.affirmation}>"Like a flower, you grow through the dirt to reach the light." 🌸</p>
              <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} style={styles.logoutBtn}>Rest your petals (Logout)</button>
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
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif", color: '#444' },
  header: { position: 'fixed', top: 0, width: '100%', height: '60px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #fce7f3', zindex: 100 },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { height: '100vh', display: 'flex', flexDirection: 'column' },
  centerContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px' },
  
  // THE BEAUTIFUL FLOWER
  flowerWrapper: { position: 'relative', width: '100px', height: '100px' },
  prettyPetal: { 
    position: 'absolute', width: '70px', height: '110px', 
    background: 'linear-gradient(to bottom, #ff85a2, #db2777)', 
    borderRadius: '50% 50% 50% 50% / 80% 80% 20% 20%', 
    border: '2px solid #fff', 
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    cursor: 'pointer', left: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
  },
  prettyCenter: { 
    position: 'absolute', top: '20px', left: '20px', width: '60px', height: '60px', 
    background: '#ffb3c1', borderRadius: '50%', border: '4px solid #fff', 
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    fontSize: '11px', fontWeight: '600', color: '#db2777', textAlign:'center', zIndex: 10,
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)'
  },
  flowerInstruction: { marginTop: '100px', color: '#db2777', fontWeight: '600', fontSize: '14px' },

  // SEARCH & GRID
  searchView: { paddingTop: '80px', paddingBottom: '100px', paddingLeft:'20px', paddingRight:'20px' },
  searchHeader: { marginBottom: '20px' },
  searchBar: { width: '100%', padding: '12px', borderRadius: '15px', border: '2px solid #fbcfe8', marginTop: '10px', outline: 'none' },
  wallGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  wallItem: { background: '#fff', borderRadius: '20px', overflow: 'hidden', border: '1px solid #fce7f3' },
  wallImg: { width: '100%', height: '120px', objectFit: 'cover' },
  wallPadding: { padding: '10px' },
  wallText: { fontSize: '12px', fontWeight: '600', height: '30px', overflow: 'hidden' },
  voteDisplay: { display: 'flex', gap: '10px', fontSize: '11px', fontWeight: '600', marginTop: '5px' },

  // HOME CARD
  pastelCard: { background: '#fff', borderRadius: '30px', width: '100%', maxWidth: '340px', overflow: 'hidden', border: '4px solid #fbcfe8', boxShadow: '0 15px 30px rgba(0,0,0,0.05)' },
  cardImg: { width: '100%', maxHeight: '40vh', objectFit: 'cover' },
  cardBody: { padding: '25px', textAlign: 'center' },
  cardCaption: { fontSize: '20px', fontWeight: '600', marginBottom: '20px' },
  actionRow: { display: 'flex', gap: '15px' },
  fireBtn: { flex: 1, background: '#fbcfe8', color: '#db2777', padding: '15px', borderRadius: '20px', border: 'none', fontSize: '20px' },
  trashBtn: { flex: 1, background: '#f3f4f6', color: '#6b7280', padding: '15px', borderRadius: '20px', border: 'none', fontSize: '20px' },
  
  doneBox: { textAlign: 'center' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', height: '80px', background: '#fff', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #fce7f3' },
  navBtn: { border: 'none', background: 'none', color: '#db2777', fontWeight: '600', fontSize: '11px' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' },
  uploadCard: { background: '#fff', padding: '30px', borderRadius: '30px', textAlign: 'center', border: '2px solid #fce7f3' },
  avatar: { width: '60px', height: '60px', background: '#fbcfe8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', color: '#db2777', fontWeight: '600' },
  logoutBtn: { marginTop: '20px', padding: '10px 20px', borderRadius: '15px', border: '1px solid #db2777', background: 'none', color: '#db2777' }
};