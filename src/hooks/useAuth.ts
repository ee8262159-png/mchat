import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        
        // Check if user doc exists, create if not
        const userDocRef = doc(db, 'users', authUser.uid);
        let userDoc;
        try {
          userDoc = await getDoc(userDocRef);
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `users/${authUser.uid}`);
          setLoading(false);
          return;
        }
        
        if (!userDoc.exists()) {
          const defaultUsername = authUser.email?.split('@')[0] + Math.floor(Math.random() * 1000);
          const initialProfile = {
            uid: authUser.uid,
            displayName: authUser.displayName || 'New User',
            username: defaultUsername.toLowerCase().replace(/[^a-z0-9_]/g, ''),
            email: authUser.email,
            photoURL: authUser.photoURL,
            isOnline: true,
            lastSeen: serverTimestamp(),
            onboarded: false,
            bio: ''
          };
          try {
            await setDoc(userDocRef, initialProfile);
          } catch (e) {
            handleFirestoreError(e, OperationType.CREATE, `users/${authUser.uid}`);
          }
        }

        // Set up real-time listener for profile
        profileUnsub = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            setProfile({ ...snap.data(), uid: snap.id });
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setProfile(null);
        if (profileUnsub) profileUnsub();
        setLoading(false);
      }
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  return { user, profile, loading };
}
