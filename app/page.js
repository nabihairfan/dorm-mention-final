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
  const [newCaptions, setNewCaptions] = useState([]); 

  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // --- THE SPECIFIC JOIN ---
      // We grab captions. Since image_id in captions points to id (PK) in images,
      // we use the 'images' relation to get the 'url'.
      const { data, error } = await supabase
        .from('captions')
        .select(`
          id, 
          content, 
          image_id,
          images!image_id ( 
            url, 
            profile_id 
          )
        `)
        .order('id', { ascending: false });

      if (error) throw error;

      const formatted = data.map(cap => {
        // Safe check for the joined images data
        const imgData = Array.isArray(cap.images) ? cap.images[0] : cap.images;
        return { 
          ...cap, 
          display_url: imgData?.url || 'https://via.placeholder.com/400?text=Image+Not+Found'
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

  const handlePipelineUpload = async () => {
    if (!file || !user) return alert("Select an image!");
    setUploading(true);
    setNewCaptions([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session.access_token;

      // STEP 1: Generate URL
      const r1 = await fetch('https://api.almostcrackd.ai/pipeline/generate-presigned-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type })
      });
      const { presignedUrl, cdnUrl } = await r1.json();

      // STEP 2: Upload Bytes
      await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });

      // STEP 3: Register Image
      const r3 = await fetch('https://api.almostcrackd.ai/pipeline/upload-image-from-url', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false })
      });
      const { imageId } = await r3.json();

      // STEP 4: Generate Captions
      const r4 = await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: imageId })
      });
      const generated = await r4.json();

      // REQUIREMENT: Show result immediately
      setNewCaptions(generated);
      
      // Sync DB data
      fetchData(); 
    } catch (err) {
      alert("Pipeline Failed.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading DormPulse...</div>;

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Poppins:wght@400;900&display=swap');` }} />

      <nav style={styles.headerNav}>
        <h1 style={styles.logo}>DormPulse.</h1>
      </nav>

      <main style={styles.content}>
        {/* TAB: VOTE (ONE AT A TIME) */}
        {activeTab === 'home' && (
          <div style={styles.centered}>
            {captions[currentIndex] ? (
              <div key={captions[currentIndex].id} style={styles.card}>
                <img src={captions[currentIndex].display_url} style={styles.img} alt="meme" />
                <div style={styles.info}>
                  <p style={styles.cap}>“{captions[currentIndex].content}”</p>
                  <div style={styles.btnRow}>
                    <button onClick={() => setCurrentIndex(c => (c + 1) % captions.length)} style={styles.trash}>🗑️ TRASH</button>
                    <button onClick={() => setCurrentIndex(c => (c + 1) % captions.length)} style={styles.fire}>🔥 FIRE</button>
                  </div>
                </div>
              </div>
            ) : <p>No memes yet!</p>}
          </div>
        )}

        {/* TAB: THE WALL (FULL PERSISTED DATA) */}
        {activeTab === 'wall' && (
          <div style={styles.grid}>
            <h2 style={styles.title}>The Wall</h2>
            {captions.map(c => (
              <div key={c.id} style={styles.wallItem}>
                <img src={c.display_url} style={styles.wallImg} alt="meme" />
                <p style={styles.wallText}>{c.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB: UPLOAD (PIPELINE FLOW) */}
        {activeTab === 'upload' && (
          <div style={styles.uploadBox}>
            <h2 style={styles.title}>Post Meme</h2>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} />
            <button onClick={handlePipelineUpload} disabled={uploading} style={styles.mainBtn}>
              {uploading ? 'PROCESSING...' : 'GENERATE'}
            </button>
            
            {newCaptions.length > 0 && (
              <div style={styles.results}>
                <h4 style={{margin: '0 0 10px'}}>Generated Captions:</h4>
                {newCaptions.map((nc, idx) => (
                  <p key={idx} style={{fontSize: '14px', fontWeight: 'bold'}}>✅ {nc.content}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <nav style={styles.nav}>
        <button onClick={() => setActiveTab('home')} style={styles.ni}>🔥<br/>Vote</button>
        <button onClick={() => setActiveTab('wall')} style={styles.ni}>🧱<br/>Wall</button>
        <button onClick={() => setActiveTab('upload')} style={styles.ni}>➕<br/>Post</button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#f5f5f5', minHeight: '100vh', paddingBottom: '100px', fontFamily: "'Poppins', sans-serif" },
  headerNav: { position: 'fixed', top: 0, width: '100%', background: '#fff', padding: '15px', textAlign: 'center', borderBottom: '2px solid #ddd', zIndex: 100 },
  logo: { fontFamily: "'Luckiest Guy', cursive", fontSize: '26px', color: '#6366f1' },
  content: { paddingTop: '90px', maxWidth: '450px', margin: '0 auto', padding: '0 15px' },
  centered: { width: '100%' },
  card: { background: '#fff', borderRadius: '20px', border: '4px solid #000', overflow: 'hidden', boxShadow: '8px 8px 0 #000' },
  img: { width: '100%', background: '#eee' },
  info: { padding: '20px', textAlign: 'center' },
  cap: { fontSize: '22px', fontWeight: '900' },
  btnRow: { display: 'flex', gap: '10px', marginTop: '15px' },
  fire: { flex: 1, background: '#4ade80', padding: '15px', borderRadius: '12px', border: '3px solid #000', fontWeight: 'bold' },
  trash: { flex: 1, background: '#f87171', padding: '15px', borderRadius: '12px', border: '3px solid #000', fontWeight: 'bold' },
  grid: { display: 'flex', flexDirection: 'column', gap: '20px' },
  title: { fontFamily: "'Luckiest Guy', cursive", textAlign: 'center' },
  wallItem: { background: '#fff', padding: '10px', borderRadius: '15px', border: '2px solid #000' },
  wallImg: { width: '100%', borderRadius: '10px' },
  wallText: { fontWeight: '900', marginTop: '10px' },
  uploadBox: { background: '#fff', padding: '30px', borderRadius: '20px', border: '4px solid #000', textAlign: 'center' },
  mainBtn: { width: '100%', marginTop: '20px', padding: '15px', background: '#6366f1', color: '#fff', border: '3px solid #000', borderRadius: '12px', fontFamily: "'Luckiest Guy', cursive" },
  results: { marginTop: '20px', padding: '15px', background: '#e0f2fe', borderRadius: '12px', textAlign: 'left' },
  nav: { position: 'fixed', bottom: 0, width: '100%', background: '#fff', display: 'flex', justifyContent: 'space-around', padding: '15px 0', borderTop: '2px solid #ddd' },
  ni: { border: 'none', background: 'none', textAlign: 'center', fontWeight: 'bold' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Luckiest Guy', cursive", fontSize: '24px' }
};