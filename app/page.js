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
  
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [newCaptions, setNewCaptions] = useState([]); // REQUIRED: To show results immediately

  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // We fetch captions and join the 'images' table using your columns: id, url, profile_id
      const { data, error } = await supabase
        .from('captions')
        .select(`
          id, 
          content, 
          image_id,
          images ( 
            url, 
            profile_id,
            is_common_use
          )
        `)
        .order('id', { ascending: false });

      if (error) throw error;

      // Logic to extract the URL safely even if RLS is being tricky
      const formatted = data.map(cap => {
        let finalUrl = 'https://via.placeholder.com/400x300?text=Private+Image';
        
        // If the join worked, use the URL from your images table
        if (cap.images && cap.images.url) {
          finalUrl = cap.images.url;
        } 
        
        return { ...cap, display_url: finalUrl };
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

      // STEP 1: Generate Presigned URL
      const res1 = await fetch('https://api.almostcrackd.ai/pipeline/generate-presigned-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type })
      });
      const { presignedUrl, cdnUrl } = await res1.json();

      // STEP 2: Upload Bytes to S3 (PUT request)
      await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });

      // STEP 3: Register Image URL
      const res3 = await fetch('https://api.almostcrackd.ai/pipeline/upload-image-from-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false })
      });
      const { imageId } = await res3.json();

      // STEP 4: Generate Captions
      // The system saves these to the DB automatically.
      const res4 = await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: imageId })
      });
      const generatedData = await res4.json();

      // REQUIREMENT: Show resulting captions right there
      setNewCaptions(generatedData);
      
      // Refresh the Wall to show the new data is saved
      fetchData(); 
    } catch (err) {
      alert("Pipeline failed.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading Vibes...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Poppins:wght@400;900&display=swap');` }} />

      <nav style={styles.headerNav}>
        <h1 style={styles.logo}>DormPulse.</h1>
      </nav>

      <main style={styles.content}>
        {/* TAB 1: VOTING (One Card at a Time) */}
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
            ) : <p>The feed is empty. Post something!</p>}
          </div>
        )}

        {/* TAB 2: THE WALL (Requirement: Full Wall of saved data) */}
        {activeTab === 'wall' && (
          <div style={styles.wallGrid}>
            <h2 style={styles.tabTitle}>Meme Wall</h2>
            {captions.map(cap => (
              <div key={cap.id} style={styles.wallItem}>
                <img src={cap.display_url} style={styles.wallImg} alt="meme" />
                <div style={styles.wallContent}>
                  <p style={styles.wallText}>{cap.content}</p>
                  <small style={{color: '#999'}}>Saved ID: {cap.id}</small>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: UPLOAD (Requirement: Pipeline Order) */}
        {activeTab === 'upload' && (
          <div style={styles.uploadArea}>
            <div style={styles.uploadBox}>
              <h2 style={styles.tabTitle}>Generate</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
              <button onClick={handlePipelineUpload} disabled={uploading} style={styles.actionBtn}>
                {uploading ? 'PIPELINE RUNNING...' : 'UPLOAD & CAPTION'}
              </button>
            </div>
            
            {/* REQUIREMENT: resulting captions come up right there */}
            {newCaptions.length > 0 && (
              <div style={styles.resultsBox}>
                <h3 style={{margin: '0 0 10px 0'}}>✨ Generated & Saved:</h3>
                {newCaptions.map((c, i) => (
                  <p key={i} style={styles.resItem}>✅ {c.content}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <nav style={styles.bottomNav}>
        <button onClick={() => setActiveTab('home')} style={{...styles.navItem, color: activeTab === 'home' ? '#6366f1' : '#888'}}>🏠<br/>Vote</button>
        <button onClick={() => setActiveTab('wall')} style={{...styles.navItem, color: activeTab === 'wall' ? '#6366f1' : '#888'}}>🧱<br/>Wall</button>
        <button onClick={() => setActiveTab('upload')} style={{...styles.navItem, color: activeTab === 'upload' ? '#6366f1' : '#888'}}>➕<br/>Post</button>
        <button onClick={() => setActiveTab('account')} style={{...styles.navItem, color: activeTab === 'account' ? '#6366f1' : '#888'}}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f5f5', fontFamily: "'Poppins', sans-serif" },
  headerNav: { position: 'fixed', top: 0, width: '100%', background: '#fff', padding: '15px', textAlign: 'center', borderBottom: '2px solid #ddd', zIndex: 100 },
  logo: { fontFamily: "'Luckiest Guy', cursive", fontSize: '26px', margin: 0, color: '#6366f1' },
  content: { paddingTop: '90px', paddingBottom: '100px', maxWidth: '480px', margin: '0 auto', padding: '0 15px' },
  tabTitle: { fontFamily: "'Luckiest Guy', cursive", textAlign: 'center', marginBottom: '20px', fontSize: '28px' },
  memeCard: { background: '#fff', borderRadius: '25px', border: '4px solid #000', overflow: 'hidden', boxShadow: '10px 10px 0px #000' },
  memeImg: { width: '100%', height: 'auto', display: 'block', minHeight: '250px', backgroundColor: '#eee' },
  cardInfo: { padding: '20px', textAlign: 'center' },
  captionText: { fontSize: '22px', fontWeight: '900', lineHeight: 1.2 },
  voteBar: { display: 'flex', gap: '15px', marginTop: '20px' },
  fireBtn: { flex: 1, background: '#4ade80', padding: '15px', borderRadius: '15px', border: '3px solid #000', fontWeight: 'bold', cursor: 'pointer', fontFamily: "'Luckiest Guy', cursive" },
  trashBtn: { flex: 1, background: '#f87171', padding: '15px', borderRadius: '15px', border: '3px solid #000', fontWeight: 'bold', cursor: 'pointer', fontFamily: "'Luckiest Guy', cursive" },
  wallGrid: { display: 'flex', flexDirection: 'column', gap: '20px' },
  wallItem: { background: '#fff', borderRadius: '20px', border: '3px solid #000', overflow: 'hidden' },
  wallImg: { width: '100%', height: 'auto', borderBottom: '3px solid #000' },
  wallContent: { padding: '15px' },
  wallText: { fontWeight: '900', fontSize: '18px' },
  uploadBox: { background: '#fff', padding: '30px', borderRadius: '25px', border: '4px solid #000', textAlign: 'center' },
  fileInput: { margin: '20px 0', display: 'block', width: '100%' },
  actionBtn: { width: '100%', padding: '18px', background: '#6366f1', color: '#fff', border: '3px solid #000', borderRadius: '15px', fontFamily: "'Luckiest Guy', cursive", fontSize: '20px' },
  resultsBox: { marginTop: '25px', background: '#fff', padding: '20px', borderRadius: '20px', border: '3px dashed #6366f1' },
  resItem: { margin: '8px 0', fontWeight: 'bold', color: '#444' },
  bottomNav: { position: 'fixed', bottom: 0, width: '100%', background: '#fff', display: 'flex', justifyContent: 'space-around', padding: '12px 0', borderTop: '2px solid #ddd' },
  navItem: { border: 'none', background: 'none', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Luckiest Guy', cursive", fontSize: '24px' },
  accountCard: { background: '#fff', padding: '30px', borderRadius: '25px', border: '4px solid #000', textAlign: 'center' }
};