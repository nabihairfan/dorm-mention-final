'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ConfessionsBoard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'search', 'upload', 'account'
  const [searchQuery, setSearchQuery] = useState('');
  const [myStats, setMyStats] = useState({ fire: 0, trash: 0 });
  
  // Upload States
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
        .select('id, content, image_url')
        .order('id', { ascending: false });

      const { data: allVotes } = await supabase.from('caption_votes').select('caption_id, vote_value');
      const { data: myVotes } = await supabase.from('caption_votes').select('caption_id, vote_value').eq('profile_id', session.user.id);

      if (captionsData) {
        const formatted = captionsData.map(cap => {
          const myVoteEntry = myVotes?.find(v => v.caption_id === cap.id);
          const globalFire = allVotes?.filter(v => v.caption_id === cap.id && v.vote_value === 1).length || 0;
          const globalTrash = allVotes?.filter(v => v.caption_id === cap.id && v.vote_value === -1).length || 0;
          return { ...cap, userVote: myVoteEntry ? myVoteEntry.vote_value : null, globalFire, globalTrash };
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
    const currentCard = captions.find(c => c.id === captionId);
    const isRemoving = currentCard?.userVote === voteValue;

    // Optimistic UI Update
    setCaptions(prev => prev.map(c => {
      if (c.id === captionId) {
        let newFire = c.globalFire;
        let newTrash = c.globalTrash;
        if (isRemoving) {
          voteValue === 1 ? newFire = Math.max(0, newFire - 1) : newTrash = Math.max(0, newTrash - 1);
        } else {
          if (c.userVote === 1) newFire = Math.max(0, newFire - 1);
          if (c.userVote === -1) newTrash = Math.max(0, newTrash - 1);
          voteValue === 1 ? newFire++ : newTrash++;
        }
        return { ...c, userVote: isRemoving ? null : voteValue, globalFire: newFire, globalTrash: newTrash };
      }
      return c;
    }));

    if (isRemoving) {
      await supabase.from('caption_votes').delete().eq('caption_id', captionId).eq('profile_id', user.id);
    } else {
      await supabase.from('caption_votes').upsert({ 
        caption_id: captionId, profile_id: user.id, vote_value: voteValue, created_datetime_utc: new Date().toISOString()
      }, { onConflict: 'caption_id, profile_id' });
    }
  };

  const handleImageUpload = async () => {
    if (!file || !user) return alert("Pick a file!");
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session.access_token;
      
      const res1 = await fetch('https://api.almostcrackd.ai/pipeline/generate-presigned-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type })
      });
      const { presignedUrl, cdnUrl } = await res1.json();
      await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      const res3 = await fetch('https://api.almostcrackd.ai/pipeline/upload-image-from-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false })
      });
      const { imageId } = await res3.json();
      await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: imageId })
      });

      alert("Uploaded! Check the feed.");
      setFile(null);
      setActiveTab('home');
      fetchEverything();
    } catch (err) { alert("Upload Failed!"); } finally { setUploading(false); }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading Vibes...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Poppins:wght@400;700;900&display=swap');` }} />

      {/* HEADER */}
      <nav style={styles.headerNav}>
        <h1 style={styles.logo}>DormPulse.</h1>
      </nav>

      <main style={styles.content}>
        
        {/* TAB 1: HOME FEED */}
        {activeTab === 'home' && (
          <div style={styles.feed}>
            {captions.map((cap, i) => (
              <div key={cap.id} style={styles.memeCard}>
                <img src={cap.image_url} alt="meme" style={styles.memeImg} />
                <div style={styles.cardInfo}>
                  <p style={styles.captionText}>“{cap.content}”</p>
                  <div style={styles.voteBar}>
                    <button onClick={() => handleVote(cap.id, 1)} style={{...styles.voteBtn, background: cap.userVote === 1 ? '#4ade80' : '#f0f0f0'}}>
                      🔥 {cap.globalFire}
                    </button>
                    <button onClick={() => handleVote(cap.id, -1)} style={{...styles.voteBtn, background: cap.userVote === -1 ? '#f87171' : '#f0f0f0'}}>
                      🗑️ {cap.globalTrash}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: SEARCH */}
        {activeTab === 'search' && (
          <div style={styles.tabContent}>
            <input 
              style={styles.searchBar} 
              placeholder="Search captions..." 
              onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
            />
            <div style={styles.feed}>
              {captions.filter(c => c.content.toLowerCase().includes(searchQuery)).map(cap => (
                <div key={cap.id} style={styles.searchResult}>
                  <img src={cap.image_url} style={styles.searchThumb} alt="thumbnail" />
                  <p>{cap.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: UPLOAD */}
        {activeTab === 'upload' && (
          <div style={styles.tabContent}>
            <div style={styles.uploadBox}>
              <h2 style={styles.tabTitle}>Post a Meme</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
              <button onClick={handleImageUpload} disabled={uploading} style={styles.actionBtn}>
                {uploading ? 'GENERATING...' : 'UPLOAD & CAPTION'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: ACCOUNT */}
        {activeTab === 'account' && (
          <div style={styles.tabContent}>
            <div style={styles.accountCard}>
              <h2 style={styles.tabTitle}>My Account</h2>
              <p style={styles.emailText}>Logged in as: <b>{user?.email}</b></p>
              <div style={styles.statsRow}>
                <div style={styles.statBox}>🔥 Sent: {myStats.fire}</div>
                <div style={styles.statBox}>🗑️ Sent: {myStats.trash}</div>
              </div>
              <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={styles.logoutBtn}>
                LOGOUT
              </button>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION BAR */}
      <nav style={styles.bottomNav}>
        <button onClick={() => setActiveTab('home')} style={{...styles.navItem, color: activeTab === 'home' ? '#6366f1' : '#888'}}>🏠<br/>Feed</button>
        <button onClick={() => setActiveTab('search')} style={{...styles.navItem, color: activeTab === 'search' ? '#6366f1' : '#888'}}>🔍<br/>Search</button>
        <button onClick={() => setActiveTab('upload')} style={{...styles.navItem, color: activeTab === 'upload' ? '#6366f1' : '#888'}}>➕<br/>Post</button>
        <button onClick={() => setActiveTab('account')} style={{...styles.navItem, color: activeTab === 'account' ? '#6366f1' : '#888'}}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f5f5', fontFamily: "'Poppins', sans-serif" },
  headerNav: { position: 'fixed', top: 0, width: '100%', background: '#fff', padding: '15px', textAlign: 'center', borderBottom: '2px solid #ddd', zIndex: 100 },
  logo: { fontFamily: "'Luckiest Guy', cursive", fontSize: '24px', margin: 0 },
  content: { paddingTop: '70px', paddingBottom: '90px', maxWidth: '600px', margin: '0 auto' },
  feed: { padding: '0 10px' },
  memeCard: { background: '#fff', marginBottom: '20px', borderRadius: '15px', overflow: 'hidden', border: '2px solid #000', boxShadow: '5px 5px 0px #000' },
  memeImg: { width: '100%', height: 'auto', display: 'block' },
  cardInfo: { padding: '15px' },
  captionText: { fontSize: '18px', fontWeight: '900', marginBottom: '10px' },
  voteBar: { display: 'flex', gap: '10px' },
  voteBtn: { flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid #000', fontWeight: 'bold', cursor: 'pointer' },
  bottomNav: { position: 'fixed', bottom: 0, width: '100%', background: '#fff', display: 'flex', justifyContent: 'space-around', padding: '10px 0', borderTop: '2px solid #ddd' },
  navItem: { border: 'none', background: 'none', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' },
  tabContent: { padding: '20px' },
  tabTitle: { fontFamily: "'Luckiest Guy', cursive", fontSize: '32px', textAlign: 'center' },
  searchBar: { width: '100%', padding: '15px', borderRadius: '10px', border: '2px solid #000', marginBottom: '20px' },
  searchResult: { display: 'flex', alignItems: 'center', gap: '15px', background: '#fff', padding: '10px', borderRadius: '10px', marginBottom: '10px', border: '1px solid #ddd' },
  searchThumb: { width: '50px', height: '50px', borderRadius: '5px', objectFit: 'cover' },
  uploadBox: { background: '#fff', padding: '30px', borderRadius: '20px', border: '3px solid #000', textAlign: 'center' },
  fileInput: { margin: '20px 0', display: 'block', width: '100%' },
  actionBtn: { background: '#6366f1', color: '#fff', padding: '15px', width: '100%', borderRadius: '10px', border: '2px solid #000', fontFamily: "'Luckiest Guy', cursive" },
  accountCard: { background: '#fff', padding: '30px', borderRadius: '20px', border: '3px solid #000', textAlign: 'center' },
  emailText: { marginBottom: '20px' },
  statsRow: { display: 'flex', gap: '10px', marginBottom: '20px' },
  statBox: { flex: 1, padding: '10px', background: '#000', color: '#fff', borderRadius: '10px', fontWeight: 'bold' },
  logoutBtn: { background: '#ff4757', color: '#fff', padding: '10px 20px', borderRadius: '10px', border: '2px solid #000', fontWeight: 'bold' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Luckiest Guy', cursive", fontSize: '24px' }
};