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
  
  // Pipeline States
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [newCaptions, setNewCaptions] = useState([]); 

  const router = useRouter();

  // 1. DATA FETCHING (Persisted Wall Logic)
  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // Join captions with images table to get the URL
      const { data, error } = await supabase
        .from('captions')
        .select(`
          id, 
          content, 
          image_id,
          images!image_id ( url, profile_id, is_common_use )
        `)
        .order('id', { ascending: false });

      if (error) throw error;

      // Map data safely to handle the image object return
      const formatted = data.map(cap => {
        const imgObj = Array.isArray(cap.images) ? cap.images[0] : cap.images;
        return { 
          ...cap, 
          display_url: imgObj?.url || 'https://via.placeholder.com/400?text=Private+Image'
        };
      });

      setCaptions(formatted);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 2. THE 4-STEP PIPELINE (The core assignment requirement)
  const handlePipelineUpload = async () => {
    if (!file || !user) return alert("Select an image first!");
    setUploading(true);
    setNewCaptions([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session.access_token;

      // STEP 1: Generate Presigned URL
      const res1 = await fetch('https://api.almostcrackd.ai/pipeline/generate-presigned-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type })
      });
      const { presignedUrl, cdnUrl } = await res1.json();

      // STEP 2: Upload Image Bytes directly to presignedUrl
      await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });

      // STEP 3: Register Image URL in the Pipeline
      const res3 = await fetch('https://api.almostcrackd.ai/pipeline/upload-image-from-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false })
      });
      const { imageId } = await res3.json();

      // STEP 4: Generate Captions
      const res4 = await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: imageId })
      });
      const generatedData = await res4.json();

      // REQUIREMENT: resulting captions come up right there
      setNewCaptions(generatedData);
      
      // RE-FETCH: ensures the data is now persisted in your Wall
      fetchData(); 
    } catch (err) {
      alert("Pipeline process failed.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading DormPulse...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Poppins:wght@400;900&display=swap');` }} />

      {/* HEADER: Fixed top layout fix */}
      <nav style={styles.header}>
        <h1 style={styles.logo}>DormPulse.</h1>
      </nav>

      <main style={styles.content}>
        {/* TAB: VOTE (One by One) */}
        {activeTab === 'home' && (
          <div style={styles.tabSection}>
            {captions[currentIndex] ? (
              <div key={captions[currentIndex].id} style={styles.card}>
                <img src={captions[currentIndex].display_url} style={styles.cardImg} alt="meme" />
                <div style={styles.cardBody}>
                  <p style={styles.cardCaption}>“{captions[currentIndex].content}”</p>
                  <div style={styles.cardActions}>
                    <button onClick={() => setCurrentIndex(c => (c + 1) % captions.length)} style={styles.trashBtn}>🗑️ TRASH</button>
                    <button onClick={() => setCurrentIndex(c => (c + 1) % captions.length)} style={styles.fireBtn}>🔥 FIRE</button>
                  </div>
                </div>
              </div>
            ) : <p style={{textAlign: 'center'}}>No memes found. Head to Post!</p>}
          </div>
        )}

        {/* TAB: THE WALL (Full Wall View) */}
        {activeTab === 'wall' && (
          <div style={styles.wallGrid}>
            <h2 style={styles.tabHeader}>The Meme Wall</h2>
            {captions.map(c => (
              <div key={c.id} style={styles.wallItem}>
                <img src={c.display_url} style={styles.wallImg} alt="meme" />
                <div style={styles.wallContent}>
                  <p style={styles.wallText}>{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: UPLOAD (The Pipeline Steps) */}
        {activeTab === 'upload' && (
          <div style={styles.tabSection}>
            <div style={styles.uploadCard}>
              <h2 style={styles.tabHeader}>New Post</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
              <button onClick={handlePipelineUpload} disabled={uploading} style={styles.actionBtn}>
                {uploading ? 'PIPELINE PROCESSING...' : 'GENERATE CAPTIONS'}
              </button>
            </div>
            
            {newCaptions.length > 0 && (
              <div style={styles.successBox}>
                <h3 style={{marginTop: 0}}>✨ Caption Results:</h3>
                {newCaptions.map((nc, i) => (
                  <p key={i} style={{fontWeight: 'bold'}}>✅ {nc.content}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* NAVIGATION: Fixed bottom */}
      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={styles.navBtn}>🔥<br/>Vote</button>
        <button onClick={() => setActiveTab('wall')} style={styles.navBtn}>🧱<br/>Wall</button>
        <button onClick={() => setActiveTab('upload')} style={styles.navBtn}>➕<br/>Post</button>
      </nav>
    </div>
  );
}

// 3. THE STYLING TOOLKIT (Layout Fixes)
const styles = {
  page: { 
    background: '#f8f8f8', 
    minHeight: '100vh', 
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Poppins', sans-serif" 
  },
  header: { 
    position: 'fixed', 
    top: 0, left: 0, right: 0,
    height: '70px', 
    background: '#fff', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderBottom: '4px solid #000', 
    zIndex: 1000 
  },
  logo: { fontFamily: "'Luckiest Guy', cursive", fontSize: '28px', color: '#6366f1', margin: 0 },
  content: { 
    paddingTop: '100px', // Pushes content below the fixed header
    paddingBottom: '110px', // Prevents nav overlap at bottom
    maxWidth: '480px', 
    width: '100%',
    margin: '0 auto', 
    paddingLeft: '15px', 
    paddingRight: '15px' 
  },
  tabSection: { width: '100%' },
  tabHeader: { fontFamily: "'Luckiest Guy', cursive", textAlign: 'center', marginBottom: '20px' },
  card: { 
    background: '#fff', 
    borderRadius: '25px', 
    border: '4px solid #000', 
    overflow: 'hidden', 
    boxShadow: '10px 10px 0 #000' 
  },
  cardImg: { width: '100%', height: 'auto', maxHeight: '55vh', objectFit: 'cover', background: '#ddd', display: 'block' },
  cardBody: { padding: '20px', textAlign: 'center' },
  cardCaption: { fontSize: '22px', fontWeight: '900', margin: '0 0 20px 0' },
  cardActions: { display: 'flex', gap: '15px' },
  fireBtn: { flex: 1, background: '#4ade80', padding: '16px', borderRadius: '15px', border: '3px solid #000', fontWeight: '900', cursor: 'pointer', fontFamily: "'Luckiest Guy', cursive" },
  trashBtn: { flex: 1, background: '#f87171', padding: '16px', borderRadius: '15px', border: '3px solid #000', fontWeight: '900', cursor: 'pointer', fontFamily: "'Luckiest Guy', cursive" },
  wallGrid: { display: 'flex', flexDirection: 'column', gap: '20px' },
  wallItem: { background: '#fff', borderRadius: '20px', border: '3px solid #000', overflow: 'hidden' },
  wallImg: { width: '100%', display: 'block', borderBottom: '3px solid #000' },
  wallContent: { padding: '15px' },
  wallText: { fontWeight: '900', fontSize: '18px' },
  uploadCard: { background: '#fff', padding: '30px', borderRadius: '25px', border: '4px solid #000', textAlign: 'center' },
  fileInput: { margin: '20px 0', width: '100%' },
  actionBtn: { width: '100%', padding: '18px', background: '#6366f1', color: '#fff', border: '3px solid #000', borderRadius: '15px', fontFamily: "'Luckiest Guy', cursive", fontSize: '20px', cursor: 'pointer' },
  successBox: { marginTop: '25px', padding: '20px', background: '#dcfce7', borderRadius: '20px', border: '3px dashed #166534' },
  navBar: { 
    position: 'fixed', 
    bottom: 0, left: 0, right: 0,
    background: '#fff', 
    display: 'flex', 
    justifyContent: 'space-around', 
    padding: '15px 0', 
    borderTop: '4px solid #000',
    zIndex: 1000 
  },
  navBtn: { border: 'none', background: 'none', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Luckiest Guy', cursive", fontSize: '28px' }
};