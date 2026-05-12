import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, doc, addDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Search, Loader2, UserPlus, Users } from 'lucide-react';
import { motion } from 'motion/react';

export function SearchUsers({ currentUser, onSelectUser }: { currentUser: any, onSelectUser: (user: any) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        handleSearch();
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '>=', searchTerm.toLowerCase()),
        where('username', '<=', searchTerm.toLowerCase() + '\uf8ff'),
        limit(10)
      );
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'users');
        return;
      }
      const users = querySnapshot.docs
        .map(doc => doc.data())
        .filter(u => currentUser?.uid && u.uid !== currentUser.uid);
      setResults(users);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (targetUser: any) => {
    if (!currentUser?.uid || !targetUser?.uid) return;
    // Check if DM exists
    const chatID = [currentUser.uid, targetUser.uid].sort().join('_');
    const chatRef = doc(db, 'chats', chatID);
    let chatSnap;
    try {
      chatSnap = await getDoc(chatRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `chats/${chatID}`);
      return;
    }

    if (!chatSnap.exists()) {
      try {
        await setDoc(chatRef, {
          type: 'dm',
          participants: [currentUser.uid, targetUser.uid],
          updatedAt: serverTimestamp(),
          lastMessage: null,
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `chats/${chatID}`);
      }
    }
    
    onSelectUser({ id: chatID, ...targetUser, type: 'dm' });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[#00a884] transition-colors" />
        <input 
          type="text" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by username..."
          className="w-full bg-[#f0f2f5] border-none rounded-xl py-4 pl-12 pr-4 text-[15px] focus:ring-2 focus:ring-[#00a884] outline-none transition-all placeholder:text-gray-500"
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00a884] animate-spin" />}
      </div>

      <div className="flex flex-col">
        {results.map((u) => (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            key={u.uid}
            onClick={() => startChat(u)}
            className="flex items-center gap-4 px-2 py-4 hover:bg-[#f0f2f5] rounded-xl cursor-pointer transition-colors group"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-100 shadow-sm transition-transform group-hover:scale-105">
               <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-[16px] text-[#111b21]">{u.displayName}</p>
              <p className="text-[#667781] text-[13px] font-medium">@{u.username}</p>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-[#dcf8c6] transition-colors">
              <UserPlus className="w-4 h-4 text-[#00a884]" />
            </div>
          </motion.div>
        ))}
        {searchTerm.length >= 2 && results.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Users className="w-12 h-12 mb-4 opacity-10" />
            <p className="text-sm font-medium tracking-tight">No results found for "{searchTerm}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
