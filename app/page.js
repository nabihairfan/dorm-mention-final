'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ConfessionsBoard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [activeTab, setActiveTab] = useState('home'); // home (vote), wall (gallery), search, upload, account
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Pipeline States
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [newCaptions, setNewCaptions] = useState([]); // To show results immediately

  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // Fetch captions with their associated image URL from the images table
      const { data, error } = await supabase
        .from('captions')
        .select(`id, content, images ( url )`)
        .order('id', { ascending: false });

      if (error) throw error;
      setCaptions(data || []);
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

      // STEP 2: Upload Bytes to S3
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

      // STEP 4: Generate Captions (System saves these to DB automatically)
      const res4 = await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: imageId })
      });
      const generatedData = await res4.json();

      // Display results immediately per requirements
      setNewCaptions(generatedData);
      fetchData(); // Refresh main list
    } catch (err) {
      alert("Pipeline failed. Check console.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading Data...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Poppins:wght@400;900&display=swap');` }} />

      <nav style={styles.headerNav}>
        <h1 style={styles.logo}>DormPulse.</h1>
      </nav>

      <main style={styles.content}>
        {/* TAB 1: VOTING (One by One) */}
        {activeTab === 'home' && (
          <div style={styles.stackArea}>
            {captions[currentIndex] ? (
              <div style={styles.memeCard}>
                <img src={captions[currentIndex].images?.url} style={styles.memeImg} alt="meme" />
                <div style={styles.cardInfo}>
                  <p style={styles.captionText}>“{captions[currentIndex].content}”</p>
                  <div style={styles.voteBar}>
                    <button onClick={() => setCurrentIndex((prev) => (prev + 1) % captions.length)} style={styles.trashBtn}>🗑️ TRASH</button>
                    <button onClick={() => setCurrentIndex((prev) => (prev + 1) % captions.length)} style={styles.fireBtn}>🔥 FIRE</button>
                  </div>
                </div>
              </div>
            ) : <p>No memes found.</p>}
          </div>
        )}

        {/* TAB 2: THE WALL (Requirement: Display all data) */}
        {activeTab === 'wall' && (
          <div style={styles.wallGrid}>
            <h2 style={styles.tabTitle}>The Meme Wall</h2>
            {captions.map(cap => (
              <div key={cap.id} style={styles.wallItem}>
                <img src={cap.images?.url} style={styles.wallImg} alt="meme" />
                <p style={styles.wallText}>{cap.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: UPLOAD (Requirement: Pipeline Steps) */}
        {activeTab === 'upload' && (
          <div style={styles.uploadArea}>
            <div style={styles.uploadBox}>
              <h2 style={styles.tabTitle}>New Post</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
              <button onClick={handlePipelineUpload} disabled={uploading} style={styles.actionBtn}>
                {uploading ? 'PROCESSING PIPELINE...' : 'UPLOAD & GENERATE'}
              </button>
            </div>

            {newCaptions.length > 0 && (
              <div style={styles.resultsBox}>
                <h3>Generated Captions:</h3>
                {newCaptions.map((c, i) => <p key={i} style={styles.resText}>✅ {c.content}</p>)}
              </div>
            )}
          </div>
        )}
      </main>

      {/* NAVIGATION */}
      <nav style={styles.bottomNav}>
        <button onClick={() => setActiveTab('home')} style={styles.navItem}>🔥<br/>Vote</button>
        <button onClick={() => setActiveTab('wall')} style={styles.navItem}>🧱<br/>Wall</button>
        <button onClick={() => setActiveTab('upload')} style={styles.navItem}>➕<br/>Post</button>
        <button onClick={() => setActiveTab('account')} style={styles.navItem}>👤<br/>Me</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f0f0f0', fontFamily: "'Poppins', sans-serif" },
  headerNav: { position: 'fixed', top: 0, width: '100%', background: '#fff', padding: '15px', textAlign: 'center', borderBottom: '2px solid #ddd', zIndex: 100 },
  logo: { fontFamily: "'Luckiest Guy', cursive", fontSize: '24px', margin: 0, color: '#6366f1' },
  content: { paddingTop: '80px', paddingBottom: '100px', maxWidth: '500px', margin: '0 auto', padding: '0 15px' },
  tabTitle: { fontFamily: "'Luckiest Guy', cursive", textAlign: 'center', marginBottom: '20px' },
  memeCard: { background: '#fff', borderRadius: '20px', border: '3px solid #000', overflow: 'hidden', boxShadow: '8px 8px 0px #000' },
  memeImg: { width: '100%', display: 'block' },
  cardInfo: { padding: '20px', textAlign: 'center' },
  captionText: { fontSize: '20px', fontWeight: '900' },
  voteBar: { display: 'flex', gap: '10px', marginTop: '20px' },
  fireBtn: { flex: 1, background: '#4ade80', padding: '15px', borderRadius: '10px', border: '2px solid #000', fontWeight: 'bold' },
  trashBtn: { flex: 1, background: '#f87171', padding: '15px', borderRadius: '10px', border: '2px solid #000', fontWeight: 'bold' },
  wallGrid: { display: 'flex', flexDirection: 'column', gap: '20px' },
  wallItem: { background: '#fff', padding: '10px', borderRadius: '15px', border: '2px solid #000' },
  wallImg: { width: '100%', borderRadius: '10px' },
  wallText: { fontWeight: 'bold', marginTop: '10px' },
  uploadBox: { background: '#fff', padding: '30px', borderRadius: '20px', border: '3px solid #000', textAlign: 'center' },
  actionBtn: { width: '100%', padding: '15px', background: '#6366f1', color: '#fff', border: '2px solid #000', borderRadius: '10px', fontFamily: "'Luckiest Guy', cursive" },
  resultsBox: { marginTop: '20px', background: '#dcfce7', padding: '15px', borderRadius: '10px', border: '2px solid #166534' },
  bottomNav: { position: 'fixed', bottom: 0, width: '100%', background: '#fff', display: 'flex', justifyContent: 'space-around', padding: '10px 0', borderTop: '2px solid #ddd' },
  navItem: { border: 'none', background: 'none', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Luckiest Guy', cursive", fontSize: '24px' }
};