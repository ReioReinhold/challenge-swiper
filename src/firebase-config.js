import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBD5ScmgkiiUN5mmHyweH0QZIjUNKq7u2s",
  authDomain: "tinder-swipe-for-challenges.firebaseapp.com",
  projectId: "tinder-swipe-for-challenges",
  storageBucket: "tinder-swipe-for-challenges.appspot.com",
  messagingSenderId: "727880644960",
  appId: "1:727880644960:web:3908186429c3c292620605"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
