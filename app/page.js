'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ConfessionsBoard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState(null);
  const [myStats, setMyStats] = useState({ fire: 0, trash: 0 });
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const router = useRouter();

  const fetchEverything = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      // We now fetch the image_url associated with the caption
      const { data: captionsData } = await supabase
        .from('captions')
        .select('id, content, image_url')
        .order('id', { ascending: false });

      const { data: myVotes } = await supabase.from('caption_votes').select('vote_value').eq('profile_id', session.user.id);

      if (captionsData) {
        setCaptions(captionsData);
        setMyStats({
          fire: myVotes?.filter(v => v.vote_value === 1).length || 0,
          trash: myVotes?.filter(v => v.vote_value === -1).length || 0
        });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchEverything(); }, [fetchEverything]);

  const handleVote = async (voteValue) => {
    if (!user || currentIndex >= captions.length) return;
    
    const captionId = captions[currentIndex].id;
    
    // Trigger Animation
    setExitDirection(voteValue === 1 ? 'exit-right' : 'exit-left');

    // Update DB
    await supabase.from('caption_votes').upsert({ 
      caption_id: captionId, 
      profile_id: user.id, 
      vote_value: voteValue,
      created_datetime_utc: new Date().toISOString()
    }, { onConflict: 'caption_id, profile_id' });

    // Update local stats
    setMyStats(prev => ({
      ...prev,
      fire: voteValue === 1 ? prev.fire + 1 : prev.fire,
      trash: voteValue === -1 ? prev.trash + 1 : prev.trash
    }));

    // Wait for animation, then show next card
    setTimeout(() => {
      setExitDirection(null);
      setCurrentIndex(prev => prev + 1);
    }, 400);
  };

  const handleImageUpload = async () => {
    if (!file || !user) return alert("Select an image!");
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
      alert("Meme Added to Stack!");
      setFile(null);
      fetchEverything();
      setCurrentIndex(0);
    } catch (err) { alert("Error!"); } finally { setUploading(false); }
  };

  if (loading) return <div style={styles.loader}>🍭 Loading Stack...</div>;

  const currentCap = captions[currentIndex];

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Poppins:wght@900&display=swap');
        
        .card-container { transition: transform 0.4s ease, opacity 0.4s ease; }
        .exit-right { transform: translateX(200vw) rotate(30deg); opacity: 0; }
        .exit-left { transform: translateX(-200vw) rotate(-30deg); opacity: 0; }
      `}} />

      <nav style={styles.nav}>
        <h1 style={styles.logo}>DormPulse.</h1>
        <div style={styles.miniScore}>🔥 {myStats.fire} | 🗑️ {myStats.trash}</div>
      </nav>

      <div style={styles.mainArea}>
        {currentIndex < captions.length ? (
          <div className={`card-container ${exitDirection}`} style={styles.stackCard}>
            <div style={{...styles.imageBack, backgroundImage: `url(${currentCap.image_url})`}}>
              <div style={styles.captionOverlay}>
                <p style={styles.cardText}>“{currentCap.content}”</p>
              </div>
            </div>
            
            <div style={styles.actionRow}>
              <button onClick={() => handleVote(-1)} style={styles.ghostBtn}>👻 GHOST IT</button>
              <button onClick={() => handleVote(1)} style={styles.heartBtn}>❤️ LOVE IT</button>
            </div>
          </div>
        ) : (
          <div style={styles.emptyState}>
            <h2>You've reached the end!</h2>
            <p>Upload a new meme to keep the pulse going.</p>
          </div>
        )}
      </div>

      <div style={styles.uploadDrawer}>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
        <button onClick={handleImageUpload} disabled={uploading} style={styles.uploadBtn}>
          {uploading ? 'UPLOADING...' : 'POST NEW MEME'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#111', color: '#fff', fontFamily: "'Poppins', sans-serif", overflow: 'hidden' },
  nav: { display: 'flex', justifyContent: 'space-between', padding: '20px', alignItems: 'center' },
  logo: { fontFamily: "'Luckiest Guy', cursive", fontSize: '28px', color: '#FF00E4' },
  miniScore: { fontSize: '18px', fontWeight: '900', background: '#222', padding: '5px 15px', borderRadius: '20px' },
  mainArea: { height: '70vh', display: 'flex', justifyContent: 'center', alignItems: 'center', perspective: '1000px' },
  stackCard: { width: '350px', height: '500px', background: '#fff', borderRadius: '30px', border: '6px solid #000', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' },
  imageBack: { flex: 1, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'flex-end' },
  captionOverlay: { background: 'rgba(0,0,0,0.7)', width: '100%', padding: '20px', backdropFilter: 'blur(5px)' },
  cardText: { fontSize: '20px', fontWeight: '900', color: '#fff', textAlign: 'center', margin: 0 },
  actionRow: { display: 'flex', padding: '20px', gap: '15px', background: '#fff' },
  ghostBtn: { flex: 1, padding: '15px', borderRadius: '15px', border: '3px solid #000', background: '#ff4757', color: '#fff', fontFamily: "'Luckiest Guy', cursive", cursor: 'pointer' },
  heartBtn: { flex: 1, padding: '15px', borderRadius: '15px', border: '3px solid #000', background: '#2ed573', color: '#fff', fontFamily: "'Luckiest Guy', cursive", cursor: 'pointer' },
  uploadDrawer: { position: 'fixed', bottom: '20px', width: '100%', display: 'flex', justifyContent: 'center', gap: '10px', padding: '0 20px' },
  uploadBtn: { background: '#FF00E4', color: '#fff', border: '2px solid #000', padding: '10px 20px', borderRadius: '15px', fontFamily: "'Luckiest Guy', cursive" },
  fileInput: { color: '#fff', fontSize: '12px' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontFamily: "'Luckiest Guy', cursive" },
  emptyState: { textAlign: 'center', padding: '40px' }
};