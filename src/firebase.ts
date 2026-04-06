import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
};
export type { User };

// Helper to check for admin role
export async function isAdmin(uid: string): Promise<boolean> {
  try {
    const currentUser = auth.currentUser;
    const primaryAdminEmail = 'noorsori@gmail.com';
    
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    
    // If this is the primary admin email, ensure they have the admin role
    if (currentUser?.email === primaryAdminEmail) {
      if (!userDoc.exists() || userDoc.data().role !== 'admin') {
        await setDoc(userDocRef, {
          uid,
          email: currentUser.email,
          role: 'admin',
          displayName: currentUser.displayName || 'Admin'
        }, { merge: true });
      }
      return true;
    }

    if (userDoc.exists()) {
      return userDoc.data().role === 'admin';
    }
    
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}
