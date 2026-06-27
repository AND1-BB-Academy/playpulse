import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBkzBqQQPrPA_inrYPGGGlabpApUGryeJY",
  authDomain: "playpulse-b75d5.firebaseapp.com",
  projectId: "playpulse-b75d5",
  storageBucket: "playpulse-b75d5.firebasestorage.app",
  messagingSenderId: "86914059367",
  appId: "1:86914059367:web:6865037878c8dd417f98c2",
  measurementId: "G-15ERBCVBKB"
};

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
