'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ConfessionsBoard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecycling, setIsRecycling] = useState(false);
  const [myStats, setMyStats] = useState({ fire: 0, trash: 0 });
  
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const router = useRouter();

  const fetchEverything = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data: captionsData } = await supabase
        .from('captions')
        .select(`id, content, images ( url )`)
        .order('id', { ascending: false });

      const { data: allVotes } = await supabase.from('caption_votes').select('caption_id, vote_value');
      const { data: myVotes } = await supabase.from('caption_votes').select('caption_id, vote_value').eq('profile_id', session.user.id);

      if (captionsData) {
        const formatted = captionsData.map(cap => {
          const myVoteEntry = myVotes?.find(v => v.caption_id === cap.id);
          // Correctly filtering counts per caption ID
          const globalFire = allVotes?.filter(v => v.caption_id === cap.id && v.vote_value === 1).length || 0;
          const globalTrash = allVotes?.filter(v => v.caption_id === cap.id && v.vote_value === -1).length || 0;
          
          return { 
            ...cap, 
            userVote: myVoteEntry ? myVoteEntry.vote_value : null, 
            globalFire, 
            globalTrash,
            display_url: cap.images?.url || 'https://via.placeholder.com/400x300?text=No+Image'
          };
        });
        setCaptions(formatted);
        setMyStats({
          fire: myVotes?.filter(v => v.vote_value === 1).length || 0,
          trash: myVotes?.filter(v => v.vote_value === -1).length || 0
        });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchEverything(); }, [fetchEverything]);

  const handleVote = async (captionId, voteValue) => {
    if (!user) return;
    
    // Update local stats
    setMyStats(prev => ({
      fire: voteValue === 1 ? prev.fire + 1 : prev.fire,
      trash: voteValue === -1 ? prev.trash + 1 : prev.trash
    }));

    // Logic for recycling
    if (currentIndex >= captions.length - 1) {
      setIsRecycling(true);
      setTimeout(() => {
        setCurrentIndex(0);
        setIsRecycling(false);
      }, 2000);
    } else {
      setCurrentIndex(prev => prev + 1);
    }

    // Save to DB
    await supabase.from('caption_votes').upsert({ 
      caption_id: captionId, 
      profile_id: user.id, 
      vote_value: voteValue,
      created_datetime_utc: new Date().toISOString()
    }, { onConflict: 'caption_id, profile_id' });
  };

  const handleImageUpload = async () => {
    if (!file || !user) return alert("Pick a file!");
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session.access_token;
      const res1 = await fetch('https://api.almostcrackd.ai/pipeline/generate-presigned-url', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type })
      });
      const { presignedUrl, cdnUrl } = await res1.json();
      await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      const res3 = await fetch('https://api.almostcrackd.ai/pipeline/upload-image-from-url', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false })
      });
      const { imageId } = await res3.json();
      await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: imageId })
      });
      alert("New meme added to the stack!");
      setFile(null);
      setActiveTab('home');
      setCurrentIndex(0);
      fetchEverything();
    } catch (err) { alert("Upload failed!"); } finally { setUploading(false); }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading Vibes...</div>;

  const currentCap = captions[currentIndex];

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Poppins:wght@400;700;900&display=swap');` }} />

      <nav style={styles.headerNav}>
        <h1 style={styles.logo}>DormPulse.</h1>
        <div style={styles.miniStats}>🔥 {myStats.fire} | 🗑️ {myStats.trash}</div>
      </nav>

      <main style={styles.content}>
        {activeTab === 'home' && (
          <div style={styles.stackWrapper}>
            {isRecycling ? (
              <div style={styles.recycleMsg}>
                <h2 style={styles.tabTitle}>🔄 Recycling Deck...</h2>
                <p>You've seen them all! Restarting the stack.</p>
              </div>
            ) : currentCap ? (
              <div key={currentCap.id} style={styles.memeCard}>
                <div style={styles.imgContainer}>
                  <img src={currentCap.display_url} alt="meme" style={styles.memeImg} />
                </div>
                <div style={styles.cardInfo}>
                  <p style={styles.captionText}>“{currentCap.content}”</p>
                  <div style={styles.voteBar}>
                    <button onClick={() => handleVote(currentCap.id, -1)} style={{...styles.voteBtn, background: '#f87171', color: '#fff'}}>🗑️ TRASH</button>
                    <button onClick={() => handleVote(currentCap.id, 1)} style={{...styles.voteBtn, background: '#4ade80', color: '#fff'}}>🔥 FIRE</button>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{textAlign: 'center'}}>No memes yet. Be the first to post!</p>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div style={styles.tabContent}>
            <input 
              style={styles.searchBar} 
              placeholder="Search captions..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
            <div style={styles.searchList}>
              {captions
                .filter(c => c.content?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(cap => (
                  <div key={cap.id} style={styles.searchResult}>
                    <img src={cap.display_url} style={styles.searchThumb} alt="thumb" />
                    <p style={{fontSize: '14px'}}>{cap.content}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div style={styles.tabContent}>
            <div style={styles.uploadBox}>
              <h2 style={styles.tabTitle}>Post a Meme</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
              <button onClick={handleImageUpload} disabled={uploading} style={styles.actionBtn}>
                {uploading ? 'PROCESSING...' : 'UPLOAD & CAPTION'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <div style={styles.tabContent}>
            <div style={styles.accountCard}>
              <h2 style={styles.tabTitle}>Profile</h2>
              <p style={styles.emailText}><b>{user?.email}</b></p>
              <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={styles.logoutBtn}>LOGOUT</button>
            </div>
          </div>
        )}
      </main>

      <nav style={styles.bottomNav}>
        <button onClick={() => setActiveTab('home')} style={{...styles.navItem, color: activeTab === 'home' ? '#6366f1' : '#888'}}>🏠<br/>Vote</button>
        <button onClick={() => setActiveTab('search')} style={{...styles.navItem, color: activeTab === 'search' ? '#6366f1' : '#888'}}>🔍<br/>Search</button>
        <button onClick={() => setActiveTab('upload')} style={{...styles.navItem, color: activeTab === 'upload' ? '#6366f1' : '#888'}}>➕<br/>Post</button>
        <button onClick={() => setActiveTab('account')} style={{...styles.navItem, color: activeTab === 'account' ? '#6366f1' : '#888'}}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f5f5', fontFamily: "'Poppins', sans-serif" },
  headerNav: { position: 'fixed', top: 0, width: '100%', background: '#fff', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ddd', zIndex: 100 },
  logo: { fontFamily: "'Luckiest Guy', cursive", fontSize: '24px', margin: 0 },
  miniStats: { fontWeight: '900', fontSize: '14px', background: '#000', color: '#fff', padding: '5px 12px', borderRadius: '20px' },
  content: { paddingTop: '80px', paddingBottom: '100px', maxWidth: '450px', margin: '0 auto' },
  stackWrapper: { padding: '0 15px', display: 'flex', justifyContent: 'center' },
  memeCard: { background: '#fff', borderRadius: '25px', overflow: 'hidden', border: '4px solid #000', boxShadow: '8px 8px 0px #000', width: '100%' },
  imgContainer: { width: '100%', borderBottom: '4px solid #000', background: '#eee', minHeight: '300px' },
  memeImg: { width: '100%', height: 'auto', display: 'block' },
  cardInfo: { padding: '20px', textAlign: 'center' },
  captionText: { fontSize: '22px', fontWeight: '900', marginBottom: '20px' },
  voteBar: { display: 'flex', gap: '15px' },
  voteBtn: { flex: 1, padding: '15px', borderRadius: '15px', border: '3px solid #000', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px', fontFamily: "'Luckiest Guy', cursive" },
  bottomNav: { position: 'fixed', bottom: 0, width: '100%', background: '#fff', display: 'flex', justifyContent: 'space-around', padding: '12px 0', borderTop: '2px solid #ddd' },
  navItem: { border: 'none', background: 'none', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' },
  tabContent: { padding: '20px' },
  tabTitle: { fontFamily: "'Luckiest Guy', cursive", fontSize: '32px', textAlign: 'center', marginBottom: '15px' },
  searchBar: { width: '100%', padding: '15px', borderRadius: '15px', border: '3px solid #000', marginBottom: '20px', fontSize: '16px' },
  searchList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  searchResult: { display: 'flex', alignItems: 'center', gap: '15px', background: '#fff', padding: '10px', borderRadius: '15px', border: '3px solid #000' },
  searchThumb: { width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover', border: '2px solid #000' },
  uploadBox: { background: '#fff', padding: '30px', borderRadius: '25px', border: '4px solid #000', textAlign: 'center' },
  fileInput: { margin: '20px 0', display: 'block', width: '100%' },
  actionBtn: { background: '#6366f1', color: '#fff', padding: '15px', width: '100%', borderRadius: '15px', border: '3px solid #000', fontFamily: "'Luckiest Guy', cursive", fontSize: '18px' },
  accountCard: { background: '#fff', padding: '30px', borderRadius: '25px', border: '4px solid #000', textAlign: 'center' },
  emailText: { marginBottom: '20px' },
  logoutBtn: { background: '#ff4757', color: '#fff', padding: '12px 25px', borderRadius: '12px', border: '3px solid #000', fontWeight: 'bold' },
  recycleMsg: { textAlign: 'center', padding: '40px' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Luckiest Guy', cursive", fontSize: '28px' }
};