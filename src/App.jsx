// src/App.jsx
import React, { useEffect, useState } from 'react';
import TinderCard from 'react-tinder-card';
import './App.css';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { db } from './firebase-config';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  increment,
  addDoc
} from 'firebase/firestore';



// ─── Improved Leaderboard ─────────────────────────────────────────────────────
const Leaderboard = ({ challenges }) => {
  const sorted = [...challenges]
    .map(c => {
      const total = c.yesCount + c.noCount + c.skipCount;
      const approvalFrac = total > 0 ? c.yesCount / total : 0;
      const approvalRate = approvalFrac * 100;
      const weightedScore = approvalFrac * (1 - Math.exp(-total / 5));
      return {
        ...c,
        total,
        approvalRate: approvalRate.toFixed(1),
        weightedScore
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);

  return (
    <div className="leaderboard p-4 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6 text-white">
        🏆 Challenge Leaderboard
      </h2>
      <div className="overflow-x-auto rounded-xl shadow-xl bg-white/10 backdrop-blur-lg border border-white/10">
        <table className="min-w-full table-auto text-sm text-white">
          <thead className="sticky top-0 bg-white/5">
            <tr className="text-left border-b border-white/20">
              <th className="py-3 px-4">Rank</th>
              <th className="py-3 px-4">Challenge</th>
              <th className="py-3 px-2 text-center">✅</th>
              <th className="py-3 px-2 text-center">❌</th>
              <th className="py-3 px-2 text-center">⏭️</th>
              <th className="py-3 px-2 text-center">Total</th>
              <th className="py-3 px-4 text-center">Approval</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr
                key={c.id}
                className={`
                  transition-all duration-200 ease-in-out cursor-pointer
                  hover:bg-white/20 hover:text-white hover:shadow-lg
                  ${i === 0 ? 'bg-yellow-500/20' 
                    : i === 1 ? 'bg-gray-300/20' 
                    : i === 2 ? 'bg-yellow-700/20' 
                    : ''
                  }
                `}
              >
                <td className="py-3 px-4 font-medium">
                  {i === 0
                    ? '🥇'
                    : i === 1
                    ? '🥈'
                    : i === 2
                    ? '🥉'
                    : i + 1}
                </td>
                <td className="py-3 px-4 max-w-xs whitespace-normal break-words">
                  {c.text}
                </td>
                <td className="py-3 px-2 text-center">{c.yesCount}</td>
                <td className="py-3 px-2 text-center">{c.noCount}</td>
                <td className="py-3 px-2 text-center">{c.skipCount}</td>
                <td className="py-3 px-2 text-center">{c.total}</td>
                <td className="py-3 px-4 text-center">
                  <div className="relative w-full h-2 bg-white/20 rounded overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-green-400"
                      style={{ width: `${c.approvalRate}%` }}
                    />
                  </div>
                  <span className="ml-2 text-xs">{c.approvalRate}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Utility: auto-remove unpopular challenges ────────────────────────────────
const thresholdReached = (yes, no, skips) => {
  const total = yes + no + skips;
  return total >= 5 && (no / total >= 0.8 || skips / total >= 0.8);
};

// ─── Main App ────────────────────────────────────────────────────────────────
function App() {
  const [challenges, setChallenges] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastDirection, setLastDirection] = useState(null);
  const [emoji, setEmoji] = useState(null);
  const [trail, setTrail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [newChallenge, setNewChallenge] = useState('');
  const [skipsLeft, setSkipsLeft] = useState(7);
  const [showLeaderboardOnly, setShowLeaderboardOnly] = useState(false);

  // Fetch & patch
  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'challenges'));
      const data = [];
      for (let ds of snap.docs) {
        const d = ds.data();
        const ref = doc(db, 'challenges', ds.id);
        // auto-patch missing fields
        const updates = {};
        if (d.yesCount === undefined) updates.yesCount = 0;
        if (d.noCount === undefined) updates.noCount = 0;
        if (d.skipCount === undefined) updates.skipCount = 0;
        if (d.removed === undefined) updates.removed = false;
        if (Object.keys(updates).length) await updateDoc(ref, updates);
        if (d.text && !d.removed)
          data.push({
            id: ds.id,
            text: d.text,
            yesCount: d.yesCount || 0,
            noCount: d.noCount || 0,
            skipCount: d.skipCount || 0
          });
      }
      setChallenges(data.sort(() => Math.random() - 0.5));
      setCurrentIndex(0);
      setShowConfetti(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  // Swipe handler
  const handleSwipe = async (dir, challenge) => {
    setLastDirection(dir);
    setEmoji(dir === 'right' ? '✅' : '❌');
    setTrail(prev => [...prev, dir]);
    setTimeout(() => setEmoji(null), 800);

    const votedKey = `voted_${challenge.id}`;
    if (localStorage.getItem(votedKey)) return;

    const ref = doc(db, 'challenges', challenge.id);
    const updated = [...challenges];
    try {
      if (dir === 'right') {
        await updateDoc(ref, { yesCount: increment(1) });
        updated[currentIndex].yesCount += 1;
      } else {
        await updateDoc(ref, { noCount: increment(1) });
        updated[currentIndex].noCount += 1;
      }
      localStorage.setItem(votedKey, 'true');
      setChallenges(updated);

      // auto-remove if too unpopular
      const c = updated[currentIndex];
      if (thresholdReached(c.yesCount, c.noCount, c.skipCount)) {
        await updateDoc(ref, { removed: true });
      }
    } catch {
      alert('Error saving vote—please try again.');
    }
  };

  // When card exits screen
  const handleCardLeftScreen = () => {
    setLastDirection(null);
    setCurrentIndex(i => {
      const next = i + 1;
      if (next >= challenges.length) setShowConfetti(true);
      return next;
    });
  };

  // Skip
  const updateSkip = async (challenge) => {
    if (skipsLeft === 0) return alert("No skips left.");
    const ref = doc(db, 'challenges', challenge.id);
    await updateDoc(ref, { skipCount: increment(1) });
    const updated = [...challenges];
    updated[currentIndex].skipCount += 1;
    setChallenges(updated);
    setSkipsLeft(s => s - 1);
    setCurrentIndex(i => i + 1);
  };

  // Submit new challenge
  const submitChallenge = async () => {
    if (!newChallenge.trim()) return;
    await addDoc(collection(db, 'pendingChallenges'), { text: newChallenge.trim() });
    setNewChallenge('');
    setShowSubmitForm(false);
    alert('Thanks! Pending review.');
  };

  // Keyboard nav
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowRight') {
        handleSwipe('right', challenges[currentIndex]);
        handleCardLeftScreen();
      }
      if (e.key === 'ArrowLeft') {
        handleSwipe('left', challenges[currentIndex]);
        handleCardLeftScreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [challenges, currentIndex]);

  // Colors & fonts
  const bg = darkMode ? '#1e1e1e' : '#fff';
  const fg = darkMode ? '#eee' : '#000';

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // Intro
  if (showIntro) {
    return (
      <div style={{
        background: bg,
        color: fg,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: 20
      }}>
        <h1>Welcome to Challenge Swiper 🎯</h1>
        <p>
          Swipe through fun challenges!
          <br />
          Swipe → for Yes, ← for No, or use the buttons.
          <br></br>You can also use keyboard arrows to vote.
          <br></br>Let's see what the world thinks :)
        </p>
        <button onClick={() => setShowIntro(false)} style={{ marginTop: 20, padding: '10px 20px' }}>
          Start
        </button>
      </div>
    );
  }

  // Main render
  return (
    <div style={{ background: bg, color: fg, minHeight: '100vh', padding: 20, transition: '0.3s' }}>
      {/* Controls */}
      <button onClick={() => setDarkMode(m => !m)} style={{ position: 'absolute', top: 10, right: 10 }}>
        {darkMode ? '🌞 Light' : '🌙 Dark'}
      </button>
      <button onClick={fetchChallenges} style={{ position: 'absolute', top: 10, left: 10 }}>
        🔁 Restart
      </button>
      <button onClick={() => setShowLeaderboardOnly(true)} style={{ position: 'absolute', top: 10, left: 120 }}>
        🏆 Leaderboard
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 80 }}>
        {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}

        {loading ? (
          <h2>Loading challenges...</h2>
        ) : showLeaderboardOnly ? (
          <>
            <Leaderboard challenges={challenges} />
            <button onClick={() => setShowLeaderboardOnly(false)} style={{ marginTop: 16 }}>
              ← Back
            </button>
          </>
        ) : currentIndex >= challenges.length ? (
          <>
            <h2>Done swiping! 🙌</h2>
            <button onClick={() => setShowSubmitForm(true)} style={{ margin: '16px 0' }}>
              Submit Your Own Challenge
            </button>
            {showSubmitForm && (
              <div style={{ maxWidth: 400, width: '100%' }}>
                <textarea
                  value={newChallenge}
                  onChange={e => setNewChallenge(e.target.value)}
                  placeholder="Your challenge..."
                  style={{ width: '100%', padding: 10, borderRadius: 8 }}
                />
                <button onClick={submitChallenge} style={{ marginTop: 10 }}>
                  Submit
                </button>
              </div>
            )}
            <Leaderboard challenges={challenges} />
          </>
        ) : (
          <>
            {/* Progress */}
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              Challenge {currentIndex + 1} of {challenges.length}
              <div style={{
                height: 4,
                width: 320,
                background: '#ddd',
                borderRadius: 2,
                overflow: 'hidden',
                marginTop: 6
              }}>
                <motion.div
                  initial={false}
                  animate={{ width: `${((currentIndex) / challenges.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                  style={{ height: '100%', background: '#4caf50' }}
                />
              </div>
            </div>

            {/* Emoji trail */}
            <AnimatePresence>
              {emoji && (
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: 1, y: -30 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  style={{ fontSize: 40, position: 'absolute', top: 50 }}
                >
                  {emoji}
                </motion.div>
              )}
            </AnimatePresence>
            {trail.map((d, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0.5, scale: 0.8 }}
                animate={{ opacity: 0, scale: 1.2, x: d === 'right' ? 200 : -200 }}
                transition={{ duration: 0.6 }}
                style={{
                  position: 'absolute',
                  top: 240,
                  fontSize: 24,
                  color: d === 'right' ? 'green' : 'red'
                }}
              >
                {d === 'right' ? '✅' : '❌'}
              </motion.div>
            ))}

            {/* Swipe card */}
            <TinderCard
              key={challenges[currentIndex].id}
              onSwipe={dir => handleSwipe(dir, challenges[currentIndex])}
              onCardLeftScreen={handleCardLeftScreen}
              preventSwipe={['up','down']}
              swipeRequirementType="position"
              swipeThreshold={50}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0, x: lastDirection === 'right' ? 200 : -200 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                style={{
                  position: 'relative',
                  background: bg,
                  color: fg,
                  width: 320,
                  height: 460,
                  padding: 20,
                  borderRadius: 16,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center'
                }}
              >
                <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                  {challenges[currentIndex].text}
                </div>
                {skipsLeft > 0 && (
                  <>
                    <button
                      onClick={() => updateSkip(challenges[currentIndex])}
                      style={{
                        marginTop: 20,
                        padding: '8px 16px',
                        border: '1px solid gray',
                        borderRadius: 8,
                        background: '#f9f9f9',
                        cursor: 'pointer'
                      }}
                    >
                      ⏭️ Skip ({skipsLeft})
                    </button>
                    <p style={{ fontSize: 12, marginTop: 8, color: '#777' }}>
                      Skip confusing or poorly worded challenges.
                    </p>
                  </>
                )}
              </motion.div>
            </TinderCard>

            {/* No / Yes buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: 320, marginTop: 10 }}>
              <button
                onClick={() => {
                  handleSwipe('left', challenges[currentIndex]);
                  handleCardLeftScreen();
                }}
                style={{
                  flex: 1,
                  marginRight: 10,
                  padding: '10px 0',
                  borderRadius: 8,
                  border: '2px solid #e74c3c',
                  background: '#fff',
                  color: '#e74c3c',
                  cursor: 'pointer'
                }}
              >
                ❌ No
              </button>
              <button
                onClick={() => {
                  handleSwipe('right', challenges[currentIndex]);
                  handleCardLeftScreen();
                }}
                style={{
                  flex: 1,
                  marginLeft: 10,
                  padding: '10px 0',
                  borderRadius: 8,
                  border: '2px solid #2ecc71',
                  background: '#fff',
                  color: '#2ecc71',
                  cursor: 'pointer'
                }}
              >
                ✅ Yes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
