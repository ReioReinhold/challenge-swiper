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
  addDoc,
  getDoc,
  setDoc
} from 'firebase/firestore';

const Leaderboard = ({ challenges }) => {
  const sorted = [...challenges].map(c => {
    const total = c.yesCount + c.noCount + c.skipCount;
    const approvalRate = total > 0 ? ((c.yesCount / total) * 100).toFixed(1) : '0.0';
    return { ...c, total, approvalRate };
  }).sort((a, b) => b.approvalRate - a.approvalRate);

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

  const fetchChallenges = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'challenges'));
      const data = querySnapshot.docs.map(doc => {
        const docData = doc.data();
        const text = docData.text || '';
        if (!text) console.warn(`⚠️ Missing text for challenge ID: ${doc.id}`);
        return {
          id: doc.id,
          text,
          yesCount: docData.yesCount || 0,
          noCount: docData.noCount || 0,
          skipCount: docData.skipCount || 0,
          removed: docData.removed || false
        };
      });

      const filtered = data.filter(ch => ch.text.trim() !== '' && !ch.removed);
      const shuffled = filtered.sort(() => 0.5 - Math.random());
      setChallenges(shuffled);
      setCurrentIndex(0);
      setShowConfetti(false);
      setSkipsLeft(7); // ✅ Reset skips on restart
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchChallenges();
  }, []);

  const updateSkip = async (challenge) => {
    if (skipsLeft <= 0) return alert("You've reached the skip limit (7 skips).");
    const challengeRef = doc(db, 'challenges', challenge.id);
    await updateDoc(challengeRef, { skipCount: increment(1) });
    const updated = [...challenges];
    updated[currentIndex].skipCount = (updated[currentIndex].skipCount || 0) + 1;
    setChallenges(updated);
    setSkipsLeft(skipsLeft - 1);
    if (thresholdReached(updated[currentIndex].yesCount, updated[currentIndex].noCount, updated[currentIndex].skipCount)) {
      await updateDoc(challengeRef, { removed: true });
    }
    setCurrentIndex(prev => prev + 1);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        handleSwipe('right', challenges[currentIndex]);
        handleCardLeftScreen();
      } else if (e.key === 'ArrowLeft') {
        handleSwipe('left', challenges[currentIndex]);
        handleCardLeftScreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [challenges, currentIndex]);

  const handleSwipe = async (direction, challenge) => {
    setLastDirection(direction);
    setEmoji(direction === 'right' ? '✅' : direction === 'left' ? '❌' : null);
    setTrail(prev => [...prev, direction]);
    setTimeout(() => setEmoji(null), 1000);

    const votedKey = `voted_${challenge.id}`;
    if (localStorage.getItem(votedKey)) return;

    const challengeRef = doc(db, 'challenges', challenge.id);
    const updatedChallenges = [...challenges];

    if (direction === 'right') {
      await updateDoc(challengeRef, { yesCount: increment(1) });
      updatedChallenges[currentIndex].yesCount += 1;
    } else if (direction === 'left') {
      await updateDoc(challengeRef, { noCount: increment(1) });
      updatedChallenges[currentIndex].noCount += 1;
    }

    localStorage.setItem(votedKey, 'true');
    setChallenges(updatedChallenges);
  };

  const handleCardLeftScreen = () => {
    setLastDirection(null);
    setCurrentIndex(prev => {
      const nextIndex = prev + 1;
      if (nextIndex >= challenges.length) setShowConfetti(true);
      return nextIndex;
    });
  };

  const submitChallenge = async () => {
    if (newChallenge.trim()) {
      await addDoc(collection(db, 'pendingChallenges'), {
        text: newChallenge.trim()
      });
      setNewChallenge('');
      setShowSubmitForm(false);
      alert('Thanks for your submission! 🎉 Your challenge is pending review. You can submit another challenge if you want');
    }
  };

  const backgroundColor = darkMode ? '#1e1e1e' : '#fff';
  const textColor = darkMode ? '#eee' : '#000';
  const fontFamily = "'Poppins', sans-serif";

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  if (showIntro) {
    return (
      <div style={{ backgroundColor, color: textColor, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px', textAlign: 'center', fontFamily }}>
        <h1>Welcome to Challenge Swiper 🎯</h1>
        <p style={{ maxWidth: '400px' }}>
          Swipe through fun and meaningful challenges. Swipe right ✅ if you're up for it, swipe left ❌ if you're not. Let's see what the world thinks!
        </p>
        <button onClick={() => setShowIntro(false)} style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px', fontFamily }}>
          Start
        </button>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor, color: textColor, minHeight: '100vh', padding: '20px', transition: 'all 0.3s ease', fontFamily }}>
      <button onClick={() => setDarkMode(!darkMode)} style={{ position: 'absolute', top: 10, right: 10 }}>
        {darkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
      </button>

      <button onClick={fetchChallenges} style={{ position: 'absolute', top: 10, left: 10 }}>
        🔁 Restart
      </button>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '80px', position: 'relative', flexDirection: 'column', alignItems: 'center' }}>
        {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}
        {loading ? (
          <h2>Loading challenges...</h2>
        ) : currentIndex >= challenges.length ? (
          <>
            <h2>Thanks for swiping through the challenges! 🙌</h2>
            <button onClick={() => setShowSubmitForm(true)} style={{ margin: '16px 0' }}>Submit Your Own Challenge</button>
            {showSubmitForm && (
              <div style={{ marginBottom: '20px', maxWidth: '400px', width: '100%' }}>
                <textarea
                  value={newChallenge}
                  onChange={e => setNewChallenge(e.target.value)}
                  placeholder="Write your challenge idea here..."
                  style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '8px' }}
                />
                <button onClick={submitChallenge} style={{ marginTop: '10px', padding: '8px 16px' }}>Submit</button>
              </div>
            )}
            <Leaderboard challenges={challenges} />
          </>
        ) : (
          <>
            <div style={{ marginBottom: '10px', fontSize: '16px', fontWeight: 'bold', color: textColor }}>
              Challenge {currentIndex + 1} of {challenges.length}
              <div style={{ height: '4px', width: '320px', background: '#ddd', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                <motion.div
                  initial={false}
                  animate={{ width: `${(currentIndex / (challenges.length - 1)) * 100}%` }}
                  transition={{ duration: 0.3 }}
                  style={{ height: '100%', background: '#4caf50' }}
                />
              </div>
            </div>

            <AnimatePresence>
              {emoji && (
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: 1, y: -30 }}
                  exit={{ opacity: 0, y: -20 }}
                  style={{ fontSize: '40px', position: 'absolute', top: '50px' }}
                >
                  {emoji}
                </motion.div>
              )}
            </AnimatePresence>

            {trail.map((dir, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0.5, scale: 0.8 }}
                animate={{ opacity: 0, scale: 1.2, x: dir === 'right' ? 200 : -200 }}
                transition={{ duration: 0.6 }}
                style={{
                  position: 'absolute',
                  top: '240px',
                  fontSize: '24px',
                  color: dir === 'right' ? 'green' : 'red'
                }}
              >
                {dir === 'right' ? '✅' : '❌'}
              </motion.div>
            ))}

            <TinderCard
              key={challenges[currentIndex].id}
              onSwipe={(dir) => handleSwipe(dir, challenges[currentIndex])}
              onCardLeftScreen={handleCardLeftScreen}
              preventSwipe={['up', 'down']}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0, x: lastDirection === 'right' ? 200 : -200 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                style={{
                  position: 'relative',
                  backgroundColor: backgroundColor,
                  color: textColor,
                  width: '320px',
                  height: '460px',
                  padding: '20px',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '20px',
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
                        marginTop: '20px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        border: '1px solid gray',
                        borderRadius: '8px',
                        backgroundColor: '#f9f9f9',
                        cursor: 'pointer'
                      }}
                    >
                      ⏭️ Skip (remaining: {skipsLeft})
                    </button>
                    <p style={{ fontSize: '12px', marginTop: '8px', color: '#777' }}>
                      If a challenge feels confusing or poorly worded, feel free to skip it.
                    </p>
                  </>
                )}

              </motion.div>
            </TinderCard>

          </>
        )}
      </div>
    </div>
  );
}

export default App;
