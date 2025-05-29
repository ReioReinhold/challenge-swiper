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

// Reset leaderboard counts
const resetAllChallenges = async () => {
  const snapshot = await getDocs(collection(db, 'challenges'));
  const updates = snapshot.docs.map(docSnap => {
    const ref = doc(db, 'challenges', docSnap.id);
    return updateDoc(ref, {
      yesCount: 0,
      noCount: 0,
      skipCount: 0,
      removed: false
    });
  });
  await Promise.all(updates);
  console.log("Leaderboard reset!");
};

// Leaderboard component
const Leaderboard = ({ challenges }) => {
  const sorted = [...challenges]
    .map(c => {
      const total = c.yesCount + c.noCount + c.skipCount;
      const approvalRate = total > 0 ? (c.yesCount / total) : 0;
      const weightedScore = approvalRate * (1 - Math.exp(-total / 5));
      return { ...c, total, approvalRate: (approvalRate * 100).toFixed(1), weightedScore };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);

  return (
    <div className="leaderboard p-4 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6 text-white">🏆 Challenge Leaderboard</h2>
      <div className="overflow-x-auto rounded-xl shadow-xl bg-white/10 backdrop-blur-lg border border-white/10 transition-all duration-300">
        <table className="min-w-full text-sm text-white">
          <thead>
            <tr className="text-left border-b border-white/20 bg-white/5">
              <th className="py-3 px-4">Challenge</th>
              <th className="py-3 px-2 text-center">✅</th>
              <th className="py-3 px-2 text-center">❌</th>
              <th className="py-3 px-2 text-center">⏭️</th>
              <th className="py-3 px-2 text-center">Total</th>
              <th className="py-3 px-2 text-center">👍 %</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr
                key={i}
                className="transition-all duration-200 ease-in-out cursor-pointer hover:bg-white/20 hover:text-white hover:shadow-lg hover:backdrop-blur-md"
              >
                <td className="py-3 px-4 max-w-xs text-sm whitespace-normal break-words">
                  {c.text}
                </td>
                <td className="py-3 px-2 text-center">{c.yesCount}</td>
                <td className="py-3 px-2 text-center">{c.noCount}</td>
                <td className="py-3 px-2 text-center">{c.skipCount || 0}</td>
                <td className="py-3 px-2 text-center">{c.total}</td>
                <td className="py-3 px-2 text-center">{c.approvalRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Utility to check if challenge should be auto-removed
const thresholdReached = (yes, no, skips) => {
  const total = yes + no + skips;
  return total >= 5 && (no / total >= 0.8 || skips / total >= 0.8);
};

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

  // Fetch and patch challenges
  const fetchChallenges = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'challenges'));
      const data = [];

      for (const docSnap of querySnapshot.docs) {
        const docData = docSnap.data();
        const text = docData.text || '';
        const challengeRef = doc(db, 'challenges', docSnap.id);
        const updates = {};

        if (docData.yesCount === undefined) updates.yesCount = 0;
        if (docData.noCount === undefined) updates.noCount = 0;
        if (docData.skipCount === undefined) updates.skipCount = 0;
        if (docData.removed === undefined) updates.removed = false;
        if (Object.keys(updates).length > 0) await updateDoc(challengeRef, updates);

        if (text.trim() !== '' && !docData.removed) {
          data.push({
            id: docSnap.id,
            text,
            yesCount: docData.yesCount || 0,
            noCount: docData.noCount || 0,
            skipCount: docData.skipCount || 0,
            removed: docData.removed || false
          });
        }
      }

      setChallenges(data.sort(() => 0.5 - Math.random()));
      setCurrentIndex(0);
      setShowConfetti(false);
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  // Voting handlers
  const handleSwipe = async (direction, challenge) => {
    setLastDirection(direction);
    setEmoji(direction === 'right' ? '✅' : '❌');
    setTrail(prev => [...prev, direction]);
    setTimeout(() => setEmoji(null), 800);

    const votedKey = `voted_${challenge.id}`;
    if (localStorage.getItem(votedKey)) return;

    const challengeRef = doc(db, 'challenges', challenge.id);
    const updated = [...challenges];

    try {
      if (direction === 'right') {
        await updateDoc(challengeRef, { yesCount: increment(1) });
        updated[currentIndex].yesCount += 1;
      } else if (direction === 'left') {
        await updateDoc(challengeRef, { noCount: increment(1) });
        updated[currentIndex].noCount += 1;
      }

      localStorage.setItem(votedKey, 'true');
      setChallenges(updated);

      // Auto-remove if threshold reached
      if (thresholdReached(updated[currentIndex].yesCount, updated[currentIndex].noCount, updated[currentIndex].skipCount)) {
        await updateDoc(challengeRef, { removed: true });
      }
    } catch (err) {
      console.error(`Failed to record vote for ${challenge.text}:`, err);
      alert('Error saving your vote. Please try again.');
    }
  };

  const handleCardLeftScreen = () => {
    setLastDirection(null);
    setCurrentIndex(prev => {
      const next = prev + 1;
      if (next >= challenges.length) setShowConfetti(true);
      return next;
    });
  };

  // Skip handler
  const updateSkip = async (challenge) => {
    if (skipsLeft <= 0) return alert("You've reached the skip limit.");
    const challengeRef = doc(db, 'challenges', challenge.id);
    await updateDoc(challengeRef, { skipCount: increment(1) });
    const updated = [...challenges];
    updated[currentIndex].skipCount += 1;
    setChallenges(updated);
    setSkipsLeft(skipsLeft - 1);
    setCurrentIndex(prev => prev + 1);
  };

  // Submit new challenge
  const submitChallenge = async () => {
    if (!newChallenge.trim()) return;
    await addDoc(collection(db, 'pendingChallenges'), { text: newChallenge.trim() });
    setNewChallenge('');
    setShowSubmitForm(false);
    alert('Thanks! Your challenge is pending review.');
  };

  // Key navigation
  useEffect(() => {
    const handleKey = e => {
      if (e.key === 'ArrowRight') {
        handleSwipe('right', challenges[currentIndex]);
        handleCardLeftScreen();
      }
      if (e.key === 'ArrowLeft') {
        handleSwipe('left', challenges[currentIndex]);
        handleCardLeftScreen();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [challenges, currentIndex]);

  // UI Colors & Fonts
  const backgroundColor = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#eee' : '#000';
  const fontFamily = "'Poppins', sans-serif";

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // Intro screen
  if (showIntro) {
    return (
      <div style={{ backgroundColor, color: textColor, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 20, fontFamily }}>
        <h1>Welcome to Challenge Swiper 🎯</h1>
        <p>Swipe through fun and meaningful challenges. Swipe right if you're up for it, left if not.</p>
        <button onClick={() => setShowIntro(false)} style={{ marginTop: 20, padding: '10px 20px', fontFamily }}>
          Start
        </button>
      </div>
    );
  }

  // Main render
  return (
    <div style={{ backgroundColor, color: textColor, minHeight: '100vh', padding: 20, transition: 'all 0.3s ease', fontFamily }}>
      {/* Top Controls */}
      <button onClick={() => setDarkMode(!darkMode)} style={{ position: 'absolute', top: 10, right: 10 }}>
        {darkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
      </button>
      <button onClick={fetchChallenges} style={{ position: 'absolute', top: 10, left: 10 }}>🔁 Restart</button>
      <button onClick={() => setShowLeaderboardOnly(true)} style={{ position: 'absolute', top: 10, left: 120 }}>🏆 Leaderboard</button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 80 }}>
        {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}

        {loading ? (
          <h2>Loading challenges...</h2>
        ) : showLeaderboardOnly ? (
          <>  
            <Leaderboard challenges={challenges} />
            <button onClick={() => setShowLeaderboardOnly(false)} style={{ marginTop: 16 }}>🔙 Back</button>
          </>
        ) : currentIndex >= challenges.length ? (
          <>  
            <h2>Thanks for swiping! 🙌</h2>
            <button onClick={() => setShowSubmitForm(true)} style={{ margin: '16px 0' }}>Submit Your Own Challenge</button>
            {showSubmitForm && (
              <div style={{ maxWidth: 400, width: '100%' }}>
                <textarea value={newChallenge} onChange={e => setNewChallenge(e.target.value)} placeholder="Write your challenge..." style={{ width: '100%', padding: 10, fontSize: 16, borderRadius: 8 }} />
                <button onClick={submitChallenge} style={{ marginTop: 10, padding: '8px 16px' }}>Submit</button>
              </div>
            )}
            <Leaderboard challenges={challenges} />
          </>
        ) : (
          <>  
            {/* Progress Bar */}
            <div style={{ marginBottom: 10, textAlign: 'center' }}>
              Challenge {currentIndex + 1} of {challenges.length}
              <div style={{ height: 4, width: 320, background: '#ddd', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                <motion.div initial={false} animate={{ width: `${(currentIndex / (challenges.length - 1)) * 100}%` }} transition={{ duration: 0.3 }} style={{ height: '100%', background: '#4caf50' }} />
              </div>
            </div>

            {/* Swipe Emoji Trail */}
            <AnimatePresence>
              {emoji && <motion.div initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1, y: -30 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} style={{ fontSize: 40, position: 'absolute', top: 50 }}>{emoji}</motion.div>}
            </AnimatePresence>
            {trail.map((dir, i) => (
              <motion.div key={i} initial={{ opacity: 0.5, scale: 0.8 }} animate={{ opacity: 0, scale: 1.2, x: dir === 'right' ? 200 : -200 }} transition={{ duration: 0.6 }} style={{ position: 'absolute', top: 240, fontSize: 24, color: dir === 'right' ? 'green' : 'red' }}>{dir === 'right' ? '✅' : '❌'}</motion.div>
            ))}

            {/* Tinder Card */}
            <TinderCard
              key={challenges[currentIndex].id}
              onSwipe={dir => handleSwipe(dir, challenges[currentIndex])}
              onCardLeftScreen={handleCardLeftScreen}
              preventSwipe={['up', 'down']}
              swipeRequirementType="position"
              swipeThreshold={50}
            >
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0, x: lastDirection === 'right' ? 200 : -200 }} transition={{ duration: 0.4, ease: 'easeInOut' }} style={{ position: 'relative', backgroundColor, color: textColor, width: 320, height: 460, padding: 20, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>{challenges[currentIndex].text}</div>
                {skipsLeft > 0 && (
                  <>  
                    <button onClick={() => updateSkip(challenges[currentIndex])} style={{ marginTop: 20, padding: '8px 16px', fontSize: 14, border: '1px solid gray', borderRadius: 8, backgroundColor: '#f9f9f9', cursor: 'pointer' }}>⏭️ Skip ({skipsLeft})</button>
                    <p style={{ fontSize: 12, marginTop: 8, color: '#777' }}>Skip confusing or poorly worded challenges.</p>
                  </>
                )}
              </motion.div>
            </TinderCard>

            {/* Fallback Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: 320, marginTop: 10 }}>
              <button onClick={() => { handleSwipe('left', challenges[currentIndex]); handleCardLeftScreen(); }} style={{ flex: 1, marginRight: 10, padding: '10px 0', borderRadius: 8, border: '1px solid #e74c3c', background: '#fff', cursor: 'pointer' }}>❌ No</button>
              <button onClick={() => { handleSwipe('right', challenges[currentIndex]); handleCardLeftScreen(); }} style={{ flex: 1, marginLeft: 10, padding: '10px 0', borderRadius: 8, border: '1px solid #2ecc71', background: '#fff', cursor: 'pointer' }}>✅ Yes</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
