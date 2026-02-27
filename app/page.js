'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ConfessionsBoard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [activeTab, setActiveTab] = useState('home'); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [newCaptions, setNewCaptions] = useState([]);

  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // We select the content and the related 'url' from the 'images' table
      const { data, error } = await supabase
        .from('captions')
        .select(`
          id, 
          content, 
          image_id,
          images ( url )
        `)
        .order('id', { ascending: false });

      if (error) throw error;

      // DEFENSIVE MAPPING:
      // We look for the URL inside the nested 'images' object
      const formatted = data.map(cap => {
        let imgUrl = 'https://via.placeholder.com/400x300?text=No+Image+Found';
        
        if (cap.images && cap.images.url) {
          imgUrl = cap.images.url;
        } else if (Array.isArray(cap.images) && cap.images[0]?.url) {
          imgUrl = cap.images[0].url;
        }

        return { ...cap, display_url: imgUrl };
      });

      setCaptions(formatted);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePipelineUpload = async () => {
    if (!file || !user) return alert("Select an image first.");
    setUploading(true);
    setNewCaptions([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session.access_token;

      // STEP 1
      const res1 = await fetch('https://api.almostcrackd.ai/pipeline/generate-presigned-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type })
      });
      const { presignedUrl, cdnUrl } = await res1.json();

      // STEP 2
      await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });

      // STEP 3
      const res3 = await fetch('https://api.almostcrackd.ai/pipeline/upload-image-from-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false })
      });
      const { imageId } = await res3.json();

      // STEP 4
      const res4 = await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: imageId })
      });
      const generatedData = await res4.json();

      setNewCaptions(generatedData);
      fetchData(); 
    } catch (err) {
      alert("Pipeline failed.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Poppins:wght@400;900&display=swap');` }} />

      <nav style={styles.headerNav}>
        <h1 style={styles.logo}>DormPulse.</h1>
      </nav>

      <main style={styles.content}>
        {/* VOTE TAB */}
        {activeTab === 'home' && (
          <div style={styles.stackArea}>
            {captions[currentIndex] ? (
              <div style={styles.memeCard}>
                <img src={captions[currentIndex].display_url} style={styles.memeImg} alt="meme" />
                <div style={styles.cardInfo}>
                  <p style={styles.captionText}>“{captions[currentIndex].content}”</p>
                  <div style={styles.voteBar}>
                    <button onClick={() => setCurrentIndex((prev) => (prev + 1) % captions.length)} style={styles.trashBtn}>🗑️ TRASH</button>
                    <button onClick={() => setCurrentIndex((prev) => (prev + 1) % captions.length)} style={styles.fireBtn}>🔥 FIRE</button>
                  </div>
                </div>
              </div>
            ) : <p>No memes yet.</p>}
          </div>
        )}

        {/* WALL TAB */}
        {activeTab === 'wall' && (
          <div style={styles.wallGrid}>
            <h2 style={styles.tabTitle}>Meme Wall</h2>
            {captions.map(cap => (
              <div key={cap.id} style={styles.wallItem}>
                <img src={cap.display_url} style={styles.wallImg} alt="meme" />
                <p style={styles.wallText}>{cap.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <div style={styles.tabContent}>
            <input 
              style={styles.searchBar} 
              placeholder="Search captions..." 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
            <div style={styles.wallGrid}>
              {captions.filter(c => c.content?.toLowerCase().includes(searchQuery.toLowerCase())).map(cap => (
                <div key={cap.id} style={styles.wallItem}>
                  <img src={cap.display_url} style={styles.wallImg} alt="thumb" />
                  <p>{cap.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* POST TAB */}
        {activeTab === 'upload' && (
          <div style={styles.uploadArea}>
            <div style={styles.uploadBox}>
              <h2 style={styles.tabTitle}>Upload</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
              <button onClick={handlePipelineUpload} disabled={uploading} style={styles.actionBtn}>
                {uploading ? 'PIPELINE RUNNING...' : 'GENERATE'}
              </button>
            </div>
            {newCaptions.length > 0 && (
              <div style={styles.resultsBox}>
                <h3>Success! Generated:</h3>
                {newCaptions.map((c, i) => <p key={i}>✅ {c.content}</p>)}
              </div>
            )}
          </div>
        )}

        {/* ACCOUNT TAB */}
        {activeTab === 'account' && (
          <div style={styles.accountCard}>
            <h2 style={styles.tabTitle}>Account</h2>
            <p>{user?.email}</p>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} style={styles.logoutBtn}>LOGOUT</button>
          </div>
        )}
      </main>

      <nav style={styles.bottomNav}>
        <button onClick={() => setActiveTab('home')} style={styles.navItem}>🔥<br/>Vote</button>
        <button onClick={() => setActiveTab('wall')} style={styles.navItem}>🧱<br/>Wall</button>
        <button onClick={() => setActiveTab('search')} style={styles.navItem}>🔍<br/>Search</button>
        <button onClick={() => setActiveTab('upload')} style={styles.navItem}>➕<br/>Post</button>
        <button onClick={() => setActiveTab('account')} style={styles.navItem}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

// ... styles remain largely same as previous response, ensuring memeImg has a min-height or height:auto
const styles = {
  page: { minHeight: '100vh', background: '#f8f8f8', fontFamily: "'Poppins', sans-serif" },
  headerNav: { position: 'fixed', top: 0, width: '100%', background: '#fff', padding: '15px', textAlign: 'center', borderBottom: '2px solid #ddd', zIndex: 100 },
  logo: { fontFamily: "'Luckiest Guy', cursive", fontSize: '24px', margin: 0, color: '#6366f1' },
  content: { paddingTop: '80px', paddingBottom: '100px', maxWidth: '500px', margin: '0 auto', padding: '0 15px' },
  tabTitle: { fontFamily: "'Luckiest Guy', cursive", textAlign: 'center', marginBottom: '20px' },
  memeCard: { background: '#fff', borderRadius: '20px', border: '3px solid #000', overflow: 'hidden', boxShadow: '8px 8px 0px #000' },
  memeImg: { width: '100%', height: 'auto', display: 'block', minHeight: '200px', backgroundColor: '#eee' },
  cardInfo: { padding: '20px', textAlign: 'center' },
  captionText: { fontSize: '20px', fontWeight: '900' },
  voteBar: { display: 'flex', gap: '10px', marginTop: '20px' },
  fireBtn: { flex: 1, background: '#4ade80', padding: '15px', borderRadius: '10px', border: '2px solid #000', fontWeight: 'bold' },
  trashBtn: { flex: 1, background: '#f87171', padding: '15px', borderRadius: '10px', border: '2px solid #000', fontWeight: 'bold' },
  wallGrid: { display: 'flex', flexDirection: 'column', gap: '20px' },
  wallItem: { background: '#fff', padding: '15px', borderRadius: '15px', border: '2px solid #000' },
  wallImg: { width: '100%', height: 'auto', borderRadius: '10px', marginBottom: '10px' },
  wallText: { fontWeight: 'bold' },
  searchBar: { width: '100%', padding: '15px', borderRadius: '10px', border: '2px solid #000', marginBottom: '20px' },
  uploadBox: { background: '#fff', padding: '30px', borderRadius: '20px', border: '3px solid #000', textAlign: 'center' },
  fileInput: { margin: '20px 0', display: 'block', width: '100%' },
  actionBtn: { width: '100%', padding: '15px', background: '#6366f1', color: '#fff', border: '2px solid #000', borderRadius: '10px', fontFamily: "'Luckiest Guy', cursive" },
  resultsBox: { marginTop: '20px', background: '#dcfce7', padding: '15px', borderRadius: '10px', border: '2px solid #166534' },
  accountCard: { background: '#fff', padding: '30px', borderRadius: '20px', border: '3px solid #000', textAlign: 'center' },
  logoutBtn: { marginTop: '20px', background: '#ff4757', color: '#fff', padding: '10px 20px', borderRadius: '10px', border: '2px solid #000', fontWeight: 'bold' },
  bottomNav: { position: 'fixed', bottom: 0, width: '100%', background: '#fff', display: 'flex', justifyContent: 'space-around', padding: '10px 0', borderTop: '2px solid #ddd' },
  navItem: { border: 'none', background: 'none', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Luckiest Guy', cursive", fontSize: '24px' }
};