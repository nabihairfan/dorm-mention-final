'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DormPulseGarden() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Pipeline & Upload
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  // Voting flow controls
  const [skippedIds, setSkippedIds] = useState([]);
  const [focusedCaptionId, setFocusedCaptionId] = useState(null);

  // Garden wall sort
  const [gardenMode, setGardenMode] = useState('all');

  const router = useRouter();

  const storageKey = user ? `dormpulse-skipped-${user.id}` : null;

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      setUser(session.user);

      const { data, error } = await supabase
        .from('captions')
        .select(`
          id, content, image_id, profile_id,
          images!image_id ( url ),
          caption_votes ( vote_value, profile_id )
        `)
        .order('id', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((cap) => {
        const votes = cap.caption_votes || [];
        const score = votes.reduce((acc, v) => acc + v.vote_value, 0) || 0;
        const userVote = votes.find((v) => v.profile_id === session.user.id);

        return {
          ...cap,
          display_url: cap.images?.url || 'https://via.placeholder.com/400',
          score,
          hasVoted: !!userVote,
          userVoteValue: userVote?.vote_value ?? null,
        };
      });

      setCaptions(formatted);
    } catch (err) {
      console.error('Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!storageKey) return;
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) setSkippedIds(parsed);
    } catch (e) {
      console.error('Failed to restore skipped captions', e);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(skippedIds));
  }, [storageKey, skippedIds]);

  const unvotedCaptions = useMemo(() => captions.filter((c) => !c.hasVoted), [captions]);

  const voteQueue = useMemo(() => {
    const pending = unvotedCaptions.filter((c) => !skippedIds.includes(c.id));
    const skippedPending = unvotedCaptions.filter((c) => skippedIds.includes(c.id));

    const queue = [...pending, ...skippedPending];

    if (focusedCaptionId) {
      const idx = queue.findIndex((c) => c.id === focusedCaptionId);
      if (idx > 0) {
        const [focused] = queue.splice(idx, 1);
        queue.unshift(focused);
      }
    }

    return queue;
  }, [unvotedCaptions, skippedIds, focusedCaptionId]);

  const currentCaption = voteQueue[0] || null;

  const handleVote = async (captionId, value) => {
    setHistory((prev) => [...prev, { id: captionId }]);

    try {
      const { error } = await supabase
        .from('caption_votes')
        .upsert(
          {
            caption_id: captionId,
            profile_id: user.id,
            vote_value: value,
            created_datetime_utc: new Date().toISOString(),
          },
          { onConflict: 'caption_id, profile_id' }
        );

      if (error) throw error;

      setSkippedIds((prev) => prev.filter((id) => id !== captionId));
      setFocusedCaptionId(null);
      await fetchData();
    } catch (err) {
      console.error('Vote Error:', err);
    }
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const lastAction = history[history.length - 1];

    try {
      const { error } = await supabase
        .from('caption_votes')
        .delete()
        .match({ caption_id: lastAction.id, profile_id: user.id });
      if (error) throw error;

      setHistory((prev) => prev.slice(0, -1));
      setSkippedIds((prev) => prev.filter((id) => id !== lastAction.id));
      setFocusedCaptionId(lastAction.id);
      await fetchData();
    } catch (err) {
      console.error('Undo Error:', err);
    }
  };

  const handleSkip = () => {
    if (!currentCaption) return;
    setSkippedIds((prev) => (prev.includes(currentCaption.id) ? prev : [...prev, currentCaption.id]));
    setFocusedCaptionId(null);
  };

  const handlePipelineUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Missing auth session. Please log in again.');
      const token = session.access_token;

      const r1 = await fetch('https://api.almostcrackd.ai/pipeline/generate-presigned-url', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!r1.ok) throw new Error('Failed to generate upload URL.');
      const { presignedUrl, cdnUrl } = await r1.json();
      if (!presignedUrl || !cdnUrl) throw new Error('Upload URL response was incomplete.');

      const r2 = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!r2.ok) throw new Error('Failed to upload image file.');

      const r3 = await fetch('https://api.almostcrackd.ai/pipeline/upload-image-from-url', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false }),
      });
      if (!r3.ok) throw new Error('Failed to register uploaded image.');
      const { imageId } = await r3.json();
      if (!imageId) throw new Error('Image registration did not return an imageId.');

      const r4 = await fetch('https://api.almostcrackd.ai/pipeline/generate-captions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId }),
      });
      if (!r4.ok) throw new Error('Failed to generate captions.');
      const generated = await r4.json();

      if (generated && generated.length > 0) {
        const { data: imgData, error: imgErr } = await supabase.from('images').insert([{ url: cdnUrl }]).select().single();
        if (imgErr) throw imgErr;

        const { error: capErr } = await supabase.from('captions').insert([
          {
            content: generated[0].content,
            image_id: imgData.id,
            profile_id: user.id,
            is_public: true,
          },
        ]);
        if (capErr) throw capErr;
      }

      setFile(null);
      await fetchData();
      setActiveTab('wall');
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const affirmations = [
    'You are blooming at your own pace. 🌸',
    'Your garden is beautiful because you are in it. ✨',
    'Keep growing, the world needs your light. 🌱',
  ];

  const executeSearch = useCallback(() => {
    const q = searchQuery.trim().toLowerCase();
    setHasSearched(true);

    if (!q) {
      setSearchResults(captions);
      return;
    }

    const results = captions.filter((c) => (c.content || '').toLowerCase().includes(q));
    setSearchResults(results);
  }, [captions, searchQuery]);

  const gardenCaptions = useMemo(() => {
    if (gardenMode === 'high') return [...captions].sort((a, b) => b.score - a.score);
    if (gardenMode === 'low') return [...captions].sort((a, b) => a.score - b.score);
    return captions;
  }, [captions, gardenMode]);

  const userEmailName = user?.email?.split('@')?.[0] || 'gardener';
  const userInitial = user?.email?.charAt(0)?.toUpperCase() || '🌸';

  if (loading) return <div style={styles.loader}>🌸 Blooming...</div>;

  return (
    <div style={styles.page}>
      <nav style={styles.header}>
        <h1 style={styles.logo}>DormPulse.</h1>
      </nav>

      <main style={styles.content}>
        {activeTab === 'home' && (
          <div style={styles.view}>
            <div style={styles.counter}>{voteQueue.length} Pulses Left 🌷</div>
            {currentCaption ? (
              <>
                <div style={styles.pastelCard}>
                  <img src={currentCaption.display_url} style={styles.cardImg} alt="meme" />
                  <div style={styles.cardBody}>
                    <p style={styles.cardCaption}>“{currentCaption.content}”</p>
                    <div style={styles.actionRow}>
                      <button onClick={() => handleVote(currentCaption.id, -1)} style={styles.trashBtn}>
                        👎
                      </button>
                      <button onClick={handleSkip} style={styles.skipBtn}>
                        ⏭️
                      </button>
                      <button onClick={() => handleVote(currentCaption.id, 1)} style={styles.fireBtn}>
                        💖
                      </button>
                    </div>
                  </div>
                </div>
                {history.length > 0 && (
                  <button onClick={handleUndo} style={styles.undoBtn}>
                    ↩️ Undo Last Vote (resets vote)
                  </button>
                )}
              </>
            ) : (
              <div style={styles.doneBox}>
                <h3>All Watered!</h3>
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div style={styles.view}>
            <div style={styles.searchRow}>
              <input
                style={styles.searchBar}
                placeholder="Search captions by words..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') executeSearch();
                }}
              />
              <button style={styles.searchBtn} onClick={executeSearch}>Search</button>
            </div>

            {!hasSearched && <p style={styles.helperText}>Type a phrase and click Search to find matching captions.</p>}
            {hasSearched && searchResults.length === 0 && <p style={styles.helperText}>No captions matched your search.</p>}

            {searchResults.map((c) => (
              <div key={c.id} style={styles.feedItem}>
                <img src={c.display_url} style={{ width: '100%' }} alt="caption result" />
                <p style={{ padding: '10px' }}>“{c.content}” — ⭐ {c.score}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'upload' && (
          <div style={styles.view}>
            <div style={styles.uploadCard}>
              <h2 style={styles.title}>Plant a Memory</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} style={styles.fileInput} />
              <button onClick={handlePipelineUpload} disabled={uploading || !file} style={styles.genBtn}>
                {uploading ? 'AI is thinking...' : '✨ Generate & Plant'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'wall' && (
          <div style={styles.view}>
            <div style={styles.gardenHero}>
              <div style={styles.bigFlower}>🌸</div>
              <h2 style={styles.gardenTitle}>The Collective Garden</h2>
              <div style={styles.petalWrap}>
                <button style={styles.petalBtn} onClick={() => setGardenMode('all')}>
                  View All
                </button>
                <button style={styles.petalBtn} onClick={() => setGardenMode('high')}>
                  Highest Voted Sorted
                </button>
                <button style={styles.petalBtn} onClick={() => setGardenMode('low')}>
                  Lowest Voted Sorted
                </button>
              </div>
            </div>

            <div style={styles.gardenGrid}>
              {gardenCaptions.map((c) => (
                <div key={c.id} style={styles.miniCard}>
                  <img src={c.display_url} style={styles.miniImg} alt="uploaded meme" />
                  <p style={{ fontSize: '11px', padding: '8px', textAlign: 'center' }}>⭐ {c.score}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <div style={styles.view}>
            <div style={styles.uploadCard}>
              <div style={styles.avatar}>{userInitial}</div>
              <h3>Hi, {userEmailName}!</h3>
              <div style={styles.affirmationBox}>
                <p>{`"${affirmations[Math.floor(Math.random() * affirmations.length)]}"`}</p>
              </div>
              <button
                onClick={() => {
                  supabase.auth.signOut();
                  router.push('/login');
                }}
                style={styles.logoutBtn}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </main>

      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={styles.navBtn}>
          🏠
          <br />
          Vote
        </button>
        <button onClick={() => setActiveTab('search')} style={styles.navBtn}>
          🔍
          <br />
          Search
        </button>
        <button onClick={() => setActiveTab('upload')} style={styles.navBtn}>
          ➕
          <br />
          Post
        </button>
        <button onClick={() => setActiveTab('wall')} style={styles.navBtn}>
          🌺
          <br />
          Garden
        </button>
        <button onClick={() => setActiveTab('account')} style={styles.navBtn}>
          👤
          <br />
          Me
        </button>
      </nav>
    </div>
  );
}

const styles = {
  page: { background: '#fff5f7', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" },
  header: {
    position: 'fixed',
    top: 0,
    width: '100%',
    height: '60px',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid #fce7f3',
    zIndex: 1000,
  },
  logo: { fontSize: '20px', color: '#db2777', fontWeight: '600' },
  content: { paddingTop: '80px', paddingBottom: '120px', maxWidth: '420px', margin: '0 auto', padding: '15px' },
  view: { width: '100%' },
  counter: {
    textAlign: 'center',
    background: '#fbcfe8',
    padding: '10px',
    borderRadius: '20px',
    color: '#db2777',
    fontWeight: '600',
    marginBottom: '15px',
  },
  pastelCard: { background: '#fff', borderRadius: '30px', border: '3px solid #fbcfe8', overflow: 'hidden' },
  cardImg: { width: '100%', height: '300px', objectFit: 'cover' },
  cardBody: { padding: '20px', textAlign: 'center' },
  cardCaption: { fontSize: '18px', fontWeight: '600' },
  actionRow: { display: 'flex', gap: '10px', marginTop: '15px' },
  fireBtn: {
    flex: 1,
    background: '#fbcfe8',
    border: 'none',
    padding: '12px',
    borderRadius: '15px',
    color: '#db2777',
    fontWeight: '600',
    cursor: 'pointer',
  },
  skipBtn: {
    flex: 1,
    background: '#ede9fe',
    border: 'none',
    padding: '12px',
    borderRadius: '15px',
    color: '#6d28d9',
    fontWeight: '700',
    cursor: 'pointer',
  },
  trashBtn: { flex: 1, background: '#f3f4f6', border: 'none', padding: '12px', borderRadius: '15px', color: '#666', cursor: 'pointer' },
  undoBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    textDecoration: 'underline',
    width: '100%',
    marginTop: '15px',
    cursor: 'pointer',
  },
  searchRow: { display: 'flex', gap: '8px', marginBottom: '10px' },
  searchBar: { flex: 1, padding: '12px', borderRadius: '15px', border: '2px solid #fbcfe8', outline: 'none' },
  searchBtn: { border: 'none', borderRadius: '12px', background: '#db2777', color: '#fff', padding: '0 14px', fontWeight: '700', cursor: 'pointer' },
  helperText: { color: '#9d174d', fontSize: '13px', marginBottom: '10px' },
  feedItem: { background: '#fff', borderRadius: '20px', marginBottom: '15px', overflow: 'hidden', border: '1px solid #fce7f3' },
  uploadCard: { background: '#fff', padding: '25px', borderRadius: '25px', border: '3px solid #fbcfe8', textAlign: 'center' },
  fileInput: { marginBottom: '15px', width: '100%' },
  genBtn: {
    width: '100%',
    padding: '15px',
    background: '#db2777',
    color: '#fff',
    border: 'none',
    borderRadius: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  gardenHero: {
    minHeight: '70vh',
    borderRadius: '30px',
    padding: '20px',
    background: 'radial-gradient(circle at center, #ffe4ec 0%, #ffd0e1 45%, #ffc2da 100%)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '20px',
  },
  bigFlower: { fontSize: '230px', lineHeight: 1, transform: 'scale(1.15)' },
  gardenTitle: { color: '#be185d', marginTop: '-10px', marginBottom: '12px' },
  petalWrap: { display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' },
  petalBtn: {
    border: 'none',
    borderRadius: '999px',
    padding: '11px',
    fontWeight: '700',
    color: '#831843',
    background: '#fff',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  },
  gardenGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' },
  miniCard: { minWidth: '100px', background: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #eee' },
  miniImg: { width: '100%', height: '150px', objectFit: 'cover' },
  affirmationBox: {
    background: '#fff5f7',
    padding: '15px',
    borderRadius: '15px',
    margin: '15px 0',
    fontStyle: 'italic',
    color: '#db2777',
  },
  logoutBtn: {
    border: '2px solid #db2777',
    background: 'none',
    color: '#db2777',
    padding: '10px 20px',
    borderRadius: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  avatar: {
    width: '60px',
    height: '60px',
    background: '#fbcfe8',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 10px',
    fontSize: '24px',
    color: '#db2777',
    fontWeight: '600',
  },
  navBar: {
    position: 'fixed',
    bottom: 0,
    width: '100%',
    height: '80px',
    background: '#fff',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTop: '1px solid #fce7f3',
  },
  navBtn: { border: 'none', background: 'none', color: '#db2777', fontSize: '10px', fontWeight: '600', cursor: 'pointer' },
  loader: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' },
  title: { color: '#db2777', fontSize: '18px', marginBottom: '15px' },
  doneBox: { textAlign: 'center', padding: '50px', color: '#db2777' },
};