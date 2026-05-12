import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useAuth } from './hooks/useAuth';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDocs, collection, query, where, onSnapshot, orderBy, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { LogIn, MessageSquare, Search, User as UserIcon, Plus, LogOut, Settings, ArrowLeft, Users, Loader2, Check, X, CloudOff, Wifi, Camera, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { SearchUsers } from './components/SearchUsers';
import { CreateGroup } from './components/CreateGroup';
import { ChatWindow } from './components/ChatWindow';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { storage } from './lib/firebase';
import { format, formatDistanceToNow } from 'date-fns';

// --- Chat Loading Hook ---
function useChats(userId: string | undefined) {
  const [chats, setChats] = useState<any[]>([]);
  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(q, async (snap) => {
      const chatList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const enriched = await Promise.all(chatList.map(async (chat: any) => {
        if (chat.type === 'dm') {
          const otherId = chat.participants.find((p: string) => p !== userId);
          if (otherId) {
            const userSnap = await getDoc(doc(db, 'users', otherId));
            return { ...chat, otherUser: userSnap.data() };
          }
        }
        return chat;
      }));
      setChats(enriched);
    });
    return unsub;
  }, [userId]);
  return chats;
}

// --- Presence Setup in App ---
function usePresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    const userRef = doc(db, 'users', userId);
    
    const setPresence = async (online: boolean) => {
      try {
        await setDoc(userRef, { 
          isOnline: online, 
          lastSeen: serverTimestamp() 
        }, { merge: true });
      } catch (e) { 
        console.warn("Presence update failed", e);
      }
    };

    setPresence(true);
    const handleVisibility = () => {
      setPresence(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      setPresence(false);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userId]);
}

function ChatItem({ chat, currentUid, onSelectChat }: any) {
  const [otherUser, setOtherUser] = useState<any>(chat.otherUser || null);

  useEffect(() => {
    if (chat.type === 'dm') {
      const otherId = chat.participants.find((p: string) => p !== currentUid);
      if (otherId) {
        const unsub = onSnapshot(doc(db, 'users', otherId), (snap) => {
          if (snap.exists()) setOtherUser(snap.data());
        });
        return unsub;
      }
    }
  }, [chat.id, chat.type, chat.participants, currentUid]);

  return (
    <div 
      onClick={() => onSelectChat({ ...chat, otherUser })}
      className="flex items-center gap-4 px-6 py-4 hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-800 group"
    >
      <div className="relative shrink-0">
        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center border border-gray-50 dark:border-gray-800 shadow-sm transition-transform group-hover:scale-105">
           {chat.type === 'dm' ? (
             <img 
                src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.participants.find((p: string) => p !== currentUid)}`} 
                alt="" 
                className="w-full h-full object-cover"
              />
           ) : (
             <Users className="w-7 h-7 text-[#00a884]" />
           )}
        </div>
        {chat.type === 'dm' && (
          <div className={cn(
            "absolute bottom-0 right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#111b21] shadow-sm transition-colors",
            otherUser?.isOnline ? "bg-[#25D366]" : "bg-gray-300"
          )} />
        )}
      </div>
      <div className="flex-1 overflow-hidden">
         <div className="flex justify-between items-baseline mb-0.5">
           <h4 className="font-bold text-[16px] text-[#111b21] dark:text-[#e9edef] truncate">
             {chat.type === 'dm' ? (otherUser?.displayName || 'Chat') : chat.name}
           </h4>
           <span className="text-[12px] text-[#667781] dark:text-[#8696a0] font-medium shrink-0">
             {chat.updatedAt?.toDate ? format(chat.updatedAt.toDate(), 'HH:mm') : ''}
           </span>
         </div>
         <div className="flex items-center gap-1">
           {chat.lastMessage?.senderId === currentUid && <Check className="w-3.5 h-3.5 text-blue-400" />}
           <p className="text-[#667781] dark:text-[#8696a0] text-[13.5px] truncate font-medium">
             {chat.lastMessage?.text || 'Sent an attachment'}
           </p>
         </div>
      </div>
    </div>
  );
}

function ChatList({ chats, onSelectChat, currentUid }: { chats: any[]; onSelectChat: (chat: any) => void, currentUid: string }) {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {chats.length === 0 ? (
        <div className="text-center py-12 px-6 text-gray-400 text-sm font-medium">
          No conversations yet. Tap the search icon to find someone!
        </div>
      ) : (
        chats.map(chat => (
          <ChatItem 
            key={chat.id} 
            chat={chat} 
            currentUid={currentUid} 
            onSelectChat={onSelectChat} 
          />
        ))
      )}
    </div>
  );
}

function ProfileSettings({ profile, onClose }: { profile: any; onClose: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.uid) return;

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    setLocalPhoto(localUrl);
    setUploading(true);
    
    try {
      const photoRef = ref(storage, `profiles/${profile.uid}/avatar_${Date.now()}_${file.name}`);
      await uploadBytes(photoRef, file);
      const photoURL = await getDownloadURL(photoRef);
      
      await updateDoc(doc(db, 'users', profile.uid), {
        photoURL,
        updatedAt: serverTimestamp()
      });
      // Success - let the snapshot listener update the global state
    } catch (err) {
      console.error("Photo upload failed", err);
      setLocalPhoto(null); // Revert on failure
      alert("Failed to upload photo. Please check your connection.");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleSave = async () => {
    if (!profile?.uid || !displayName || !username) return;
    setSaving(true);
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    
    try {
      // Check for uniqueness if username changed
      if (cleanUsername !== profile.username) {
        const q = query(collection(db, 'users'), where('username', '==', cleanUsername));
        let snap;
        try {
          snap = await getDocs(q);
        } catch (e) {
          handleFirestoreError(e, OperationType.LIST, 'users');
          return;
        }
        
        if (!snap.empty) {
          alert("Username is already taken.");
          setSaving(false);
          return;
        }
      }

      const userPath = `users/${profile.uid}`;
      try {
        await setDoc(doc(db, 'users', profile.uid), {
          ...profile,
          displayName,
          username: cleanUsername,
          bio,
          updatedAt: serverTimestamp()
        }, { merge: true });
        setIsEditing(false);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, userPath);
      }
    } catch (error) {
      console.error("Update failed:", error);
      alert("Update failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-6 h-full flex flex-col bg-white border-r"
    >
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Settings className="w-5 h-5" /> Profile
        </h2>
        <button onClick={onClose} className="text-sm text-blue-600 hover:underline">Back</button>
      </div>
      
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto px-1">
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <div className="w-40 h-40 rounded-full border-4 border-white shadow-lg overflow-hidden relative bg-gray-100 flex items-center justify-center transition-all">
              {uploading && !localPhoto ? (
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              ) : (
                <img 
                  src={localPhoto || profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} 
                  alt="Avatar" 
                  className={cn(
                    "w-full h-full object-cover transition-opacity duration-300",
                    uploading ? "opacity-50" : "opacity-100"
                  )} 
                />
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-[3px] border-white/30 border-t-blue-500 rounded-full animate-spin" />
                </div>
              )}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white"
              >
                <Camera className="w-8 h-8 mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Change Photo</span>
              </button>
            </div>
            <input 
              type="file" 
              hidden 
              ref={fileInputRef} 
              onChange={handlePhotoUpload} 
              accept="image/*"
            />
          </div>
          
          {!isEditing ? (
            <div className="text-center">
              <h3 className="font-bold text-2xl text-gray-900 tracking-tight">{profile?.displayName}</h3>
              <p className="text-blue-600 font-medium text-sm">@{profile?.username}</p>
            </div>
          ) : (
            <div className="w-full space-y-4">
               <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Display Name</label>
                <input 
                  type="text" 
                  value={displayName} 
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full border-b py-2 focus:border-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Username</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)}
                  className="w-full border-b py-2 focus:border-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Bio</label>
                <textarea 
                  value={bio} 
                  onChange={e => setBio(e.target.value)}
                  className="w-full border-b py-2 focus:border-blue-500 outline-none text-sm resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <button 
                  disabled={saving}
                  onClick={handleSave}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-4 border rounded-xl py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {!isEditing && (
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase text-gray-400 font-bold tracking-tight">Email</label>
              <p className="border-b py-2 text-sm text-gray-600">{profile?.email}</p>
            </div>
            <div>
              <label className="text-xs uppercase text-gray-400 font-bold tracking-tight">Bio</label>
              <p className="border-b py-2 text-sm text-gray-600 italic">
                {profile?.bio || 'No bio yet. Tell us about yourself!'}
              </p>
            </div>
            <button 
              onClick={() => setIsEditing(true)}
              className="w-full border border-blue-100 text-blue-600 rounded-xl py-3 text-sm font-bold hover:bg-blue-50 transition-colors"
            >
              Edit Profile
            </button>
          </div>
        )}
      </div>

      <button 
        onClick={() => signOut(auth)}
        className="mt-6 flex items-center justify-center gap-2 w-full p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-medium"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </motion.div>
  );
}

function Onboarding({ profile, onComplete }: { profile: any; onComplete: () => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDone = async () => {
    const userId = profile?.uid || auth.currentUser?.uid;
    if (!userId) {
      setError('User session invalid. Please log in again.');
      return;
    }
    const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Check for uniqueness
      const q = query(collection(db, 'users'), where('username', '==', cleanUsername));
      let snap;
      try {
        snap = await getDocs(q);
      } catch (e: any) {
        // If index is missing or other error
        if (e.message?.includes('index')) {
          console.error("Firestore Index missing for username field");
        }
        handleFirestoreError(e, OperationType.LIST, 'users');
        return;
      }
      
      if (!snap.empty) {
        const isMe = snap.docs.some(doc => doc.id === userId);
        if (!isMe) {
          setError('Username is already taken. Try another one.');
          setLoading(false);
          return;
        }
      }

      // Save profile
      const userPath = `users/${userId}`;
      try {
        await setDoc(doc(db, 'users', userId), {
          ...profile,
          uid: userId, // Ensure uid is preserved
          username: cleanUsername,
          displayName: displayName || profile?.displayName || 'User',
          onboarded: true,
          updatedAt: serverTimestamp()
        }, { merge: true });
        onComplete();
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, userPath);
      }
    } catch (err) {
      console.error("Onboarding failed:", err);
      // If handleFirestoreError was called, it threw, so we land here
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          setError(`Error: ${parsed.error || 'Please try again.'}`);
        } catch {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-50 p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-xl border border-gray-100"
      >
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-3xl mb-8 mx-auto -rotate-6">m</div>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black tracking-tighter uppercase mb-2">Welcome to mChat.</h2>
          <p className="text-gray-500 text-sm">Choose a unique username to get started.</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Display Name</label>
            <input 
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name"
              className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Username</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 font-bold">@</span>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-10 pr-6 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            {error && <p className="text-red-500 text-xs mt-2 font-medium px-2">{error}</p>}
          </div>

          <button 
            onClick={handleDone}
            disabled={loading || !username.trim()}
            className="w-full py-4 bg-black text-white rounded-2xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Get Started'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Online Status Hook ---
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);
  return isOnline;
}

export default function App() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'chats' | 'search' | 'group' | 'profile'>('chats');
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true' || (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const isOnline = useOnlineStatus();
  const chats = useChats(user?.uid);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  usePresence(user?.uid);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    
    setIsLoggingIn(true);
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // Silently handle user-initiated cancellations or browser-closed popups
        return;
      }
      setLoginError(error.message || "An unexpected error occurred during login.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const selectChat = (chat: any) => {
    setSelectedChat(chat);
    setActiveTab('chats');
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    // ... existing login UI ...
    return (
      <div className="h-screen w-screen flex flex-col md:flex-row bg-[#080808] text-white">
        <div className="flex-1 p-12 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-12">
              <div className="w-10 h-10 bg-[#25D366] rounded-xl flex items-center justify-center font-bold text-2xl tracking-tighter shadow-lg shadow-green-200">m</div>
              <span className="font-black text-xl tracking-tighter text-white">mCHAT</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.8] mb-8 text-white">
              SAY<br />HELLO.
            </h1>
            <p className="text-gray-400 max-w-sm text-lg font-medium">
              Join millions of people who share their moments with mChat. Fast, secure, and always together.
            </p>
          </div>
          
          <div className="flex flex-col gap-4">
            {loginError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
                {loginError}
              </div>
            )}
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="px-8 py-5 bg-[#25D366] text-white rounded-[2rem] font-black text-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 w-fit shadow-xl shadow-green-900/20 disabled:opacity-70 disabled:scale-100"
            >
              {isLoggingIn ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <LogIn className="w-6 h-6" />
              )}
              {isLoggingIn ? 'Signing in...' : 'Continue with Google'}
            </button>
            <p className="text-xs text-green-500/50 font-bold uppercase tracking-widest">Powered by real-time encryption</p>
          </div>
        </div>
        <div className="flex-1 bg-blue-600 hidden md:block relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] border-[40px] border-white rounded-full"></div>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] border-[20px] border-white rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show onboarding if username not set
  if (profile && !profile.onboarded) {
    return <Onboarding profile={profile} onComplete={() => {}} />;
  }

  return (
    <div className="h-screen w-screen bg-gray-100 flex overflow-hidden font-sans">
      {/* Sidebar Wrapper */}
      <div className={cn(
        "bg-white dark:bg-[#111b21] border-r dark:border-gray-800 h-full flex flex-col transition-all duration-300 z-20",
        selectedChat ? "hidden md:flex w-96 shrink-0" : "w-full md:w-96 shrink-0"
      )}>
        <AnimatePresence mode="wait">
          {activeTab === 'profile' ? (
            <ProfileSettings profile={profile} onClose={() => setActiveTab('chats')} />
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full"
              key="main"
            >
              {/* Header */}
              {!isOnline && (
                <div className="bg-orange-500 text-white text-[10px] font-bold py-1 px-4 flex items-center justify-between uppercase tracking-widest">
                  <span className="flex items-center gap-1"><CloudOff className="w-3 h-3" /> Working Offline</span>
                  <span>Syncing...</span>
                </div>
              )}
              <div className="p-6 border-b dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#111b21] sticky top-0 z-10 transition-colors">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveTab('profile')}
                    className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden hover:opacity-80 transition-opacity ring-2 ring-transparent hover:ring-[#25D366] p-0.5"
                  >
                    <div className="w-full h-full rounded-full overflow-hidden border border-white dark:border-gray-800">
                      <img src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                  </button>
                  <div className="transition-colors">
                    <h1 className="font-black text-2xl tracking-tighter leading-none text-[#075E54] dark:text-[#25D366]">mChat</h1>
                    <p className="text-[10px] text-[#25D366] uppercase tracking-widest font-black">Connected</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                   <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#202c33] text-gray-600 dark:text-gray-400 transition-all"
                    title="Toggle Dark Mode"
                   >
                    {isDarkMode ? <Smile className="w-5 h-5 text-yellow-400" /> : <Settings className="w-5 h-5" />}
                   </button>
                   <button 
                    onClick={() => setActiveTab(activeTab === 'group' ? 'chats' : 'group')}
                    className={cn(
                       "p-2 rounded-xl transition-all",
                       activeTab === 'group' ? "bg-black dark:bg-[#25D366] text-white" : "hover:bg-gray-100 dark:hover:bg-[#202c33] text-gray-600 dark:text-gray-400"
                    )}
                   >
                    {activeTab === 'group' ? <ArrowLeft className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                   </button>
                   <button 
                    onClick={() => setActiveTab(activeTab === 'search' ? 'chats' : 'search')}
                    className={cn(
                       "p-2 rounded-xl transition-all",
                       activeTab === 'search' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "hover:bg-gray-100 dark:hover:bg-[#202c33] text-gray-600 dark:text-gray-400"
                    )}
                   >
                    {activeTab === 'search' ? <ArrowLeft className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                   </button>
                </div>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-[#111b21] transition-colors">
                {activeTab === 'search' ? (
                  <div className="p-6 overflow-y-auto">
                    <h2 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-tighter">Search Users</h2>
                    <SearchUsers currentUser={profile} onSelectUser={selectChat} />
                  </div>
                ) : activeTab === 'group' ? (
                  <div className="p-6 overflow-y-auto">
                    <h2 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-tighter">Create Group</h2>
                    <CreateGroup currentUser={profile} onCreated={selectChat} />
                  </div>
                ) : (
                  <ChatList chats={chats} onSelectChat={setSelectedChat} currentUid={profile?.uid} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-white overflow-hidden",
        !selectedChat && "hidden md:flex items-center justify-center bg-gray-50"
      )}>
        {selectedChat ? (
          <div className="flex-1 flex flex-col h-full relative">
             <ChatWindow 
                chat={selectedChat} 
                currentUser={profile} 
                onBack={() => setSelectedChat(null)}
              />
          </div>
        ) : (
          <div className="text-center space-y-6 max-w-sm px-6">
             <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] mx-auto flex items-center justify-center rotate-3 hover:rotate-0 transition-transform">
                <MessageSquare className="w-12 h-12" />
             </div>
             <div className="space-y-2">
               <h2 className="text-3xl font-black tracking-tighter text-gray-900 uppercase">mChat.</h2>
               <p className="text-gray-500 text-sm leading-relaxed">
                 Fast, secure, and real-time. Share messages, images, and videos instantly.
               </p>
             </div>
             <button 
              onClick={() => setActiveTab('search')}
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-100 hover:scale-105 active:scale-95 transition-all w-full"
             >
               Start New Conversation
             </button>
          </div>
        )}
      {/* Full screen Modals */}
      <AnimatePresence>
      </AnimatePresence>
    </div>
  </div>
  );
}
