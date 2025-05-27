import React, { useEffect, useState } from 'react';
import TinderCard from 'react-tinder-card';
import { motion } from 'framer-motion';
import { db } from './firebase-config';

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  increment
} from 'firebase/firestore';

function App() {
  const [challenges, setChallenges] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastDirection, setLastDirection] = useState(null);
  const [loading, setLoading] = useState(true);

  // Debug log
  console.log('Index:', currentIndex, 'Challenges:', challenges.length);


  useEffect(() => {
    const fetchChallenges = async () => {
      const querySnapshot = await getDocs(collection(db, 'challenges'));
      const data = querySnapshot.docs.map(doc => {
        const docData = doc.data();
        // Handle potential space in field name
        const text = docData.text || docData[' text'] || docData['text'];
        return {
          id: doc.id,
          text: text,
          yesCount: docData.yesCount || 0,
          noCount: docData.noCount || 0
        };
      });
      console.log('Fetched challenges:', data);
      setChallenges(data);
      setLoading(false);
    };
    fetchChallenges();
  }, []);

  const handleSwipe = async (direction, challenge) => {
    setLastDirection(direction); // 👈 add this as the first line inside handleSwipe
    const votedKey = `voted_${challenge.id}`;
    if (localStorage.getItem(votedKey)) return;

    const challengeRef = doc(db, 'challenges', challenge.id);
    if (direction === 'right') {
      await updateDoc(challengeRef, { yesCount: increment(1) });
    } else if (direction === 'left') {
      await updateDoc(challengeRef, { noCount: increment(1) });
    }

    localStorage.setItem(votedKey, 'true');
    setCurrentIndex((prev) => prev + 1);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '80px' }}>
      {loading ? (
        <h2>Loading challenges...</h2>
      ) : currentIndex >= challenges.length ? (
        <h2>No more challenges!</h2>
      ) : (
      <TinderCard
        key={challenges[currentIndex].id}
        onSwipe={(dir) => handleSwipe(dir, challenges[currentIndex])}
        preventSwipe={['up', 'down']}
      >
        <div
          style={{
            position: 'relative',
            backgroundColor: '#fff',
            width: '320px',
            height: '420px',
            padding: '20px',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '20px',
            textAlign: 'center'
          }}
        >
          {/* ✅ YES / ❌ NO labels */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: lastDirection === 'right' ? 1 : 0 }}
            style={{
              position: 'absolute',
              top: 20,
              left: 20,
              color: 'green',
              fontWeight: 'bold',
              fontSize: '18px',
              transform: 'rotate(-20deg)'
            }}
          >
            YES
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: lastDirection === 'left' ? 1 : 0 }}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              color: 'red',
              fontWeight: 'bold',
              fontSize: '18px',
              transform: 'rotate(20deg)'
            }}
          >
            NO
          </motion.div>

          {/* 🧠 Challenge text */}
          {challenges[currentIndex].text}
        </div>
      </TinderCard>

      )}
    </div>
  );
}

export default App;
