// Firebase Configuration for Frontend
// This is a client-side config and safe to expose (Firebase Security Rules protect the data)

import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyAV3GJCURU26ebXZZHuz0vIMfDs2fCa5_M",
    authDomain: "erp4u.firebaseapp.com",
    databaseURL: "https://erp4u-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "erp4u",
    storageBucket: "erp4u.firebasestorage.app",
    messagingSenderId: "713218189002",
    appId: "1:713218189002:web:138a699456e34d2ef07633",
    measurementId: "G-NSR5XK3DE2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Realtime Database instance
export const database = getDatabase(app);

export default app;
