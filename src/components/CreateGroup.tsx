import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Search, Loader2, Users, Check, X, SearchIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export function CreateGroup({ currentUser, onCreated }: { currentUser: any, onCreated: (chat: any) => void }) {
  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Debounced Search
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '>=', searchTerm.toLowerCase()),
        where('username', '<=', searchTerm.toLowerCase() + '\uf8ff'),
        limit(15)
      );
      
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs
        .map(doc => ({ ...doc.data(), uid: doc.id }))
        .filter(u => currentUser?.uid && u.uid !== currentUser.uid);
      setResults(users);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (user: any) => {
    if (selectedUsers.find(u => u.uid === user.uid)) {
      setSelectedUsers(selectedUsers.filter(u => u.uid !== user.uid));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreate = async () => {
    if (!currentUser?.uid || !groupName.trim() || selectedUsers.length === 0) return;
    setCreating(true);
    try {
      const chatData = {
        type: 'group',
        name: groupName,
        participants: [currentUser.uid, ...selectedUsers.map(u => u.uid)],
        createdBy: currentUser.uid,
        updatedAt: serverTimestamp(),
        lastMessage: null,
        metadata: {
          memberCount: selectedUsers.length + 1
        }
      };
      
      const docRef = await addDoc(collection(db, 'chats'), chatData);
      onCreated({ id: docRef.id, ...chatData });
    } catch (error) {
      console.error(error);
      alert("Failed to create group. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-6 flex-1">
        <div className="bg-gray-50/50 p-4 rounded-[2rem] border border-gray-100 dark:bg-gray-800/30 dark:border-gray-800 transition-colors">
          <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest px-2">Group Name</label>
          <input 
            type="text" 
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Squad Name..."
            className="w-full bg-transparent border-none rounded-xl py-2 px-2 text-lg font-bold focus:ring-0 outline-none placeholder:text-gray-300 dark:text-white"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2 px-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Add Members ({selectedUsers.length})</label>
            {selectedUsers.length > 0 && (
              <button 
                onClick={() => setSelectedUsers([])}
                className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
              >
                Clear All
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4 px-2 min-h-[32px]">
            <AnimatePresence>
              {selectedUsers.map(u => (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  key={u.uid} 
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} className="w-4 h-4 rounded-full border border-white/20" alt="" />
                  {u.displayName}
                  <button onClick={() => toggleUser(u)} className="hover:bg-white/20 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
               {loading ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <SearchIcon className="w-4 h-4" />}
            </div>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by username..."
              className="w-full bg-gray-50 border-none rounded-[1.5rem] py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:bg-gray-800/50 dark:text-white"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 mt-2 max-h-60 overflow-y-auto px-1 custom-scrollbar">
          {searchTerm.length >= 2 && results.length === 0 && !loading && (
            <p className="text-center py-4 text-xs text-gray-400 font-medium italic">No users found matching "@{searchTerm}"</p>
          )}
          {results.map((u) => {
            const isSelected = selectedUsers.find(su => su.uid === u.uid);
            return (
              <motion.div 
                layout
                key={u.uid}
                onClick={() => toggleUser(u)}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border-2",
                  isSelected 
                    ? "bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/20" 
                    : "hover:bg-gray-50 border-transparent dark:hover:bg-gray-800/30"
                )}
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-800 shadow-sm">
                    <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full p-1 border-2 border-white dark:border-[#111b21]">
                      <Check className="w-2 h-2 font-black" />
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-black text-gray-900 dark:text-gray-100 truncate">{u.displayName}</p>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest truncate">@{u.username}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="pt-6 mt-auto">
        <button 
          onClick={handleCreate}
          disabled={creating || !groupName.trim() || selectedUsers.length === 0}
          className="w-full bg-[#00a884] text-white py-5 rounded-[2rem] font-black text-lg disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-[#00a884]/20 flex items-center justify-center gap-3"
        >
          {creating ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Users className="w-6 h-6" />
          )}
          {creating ? 'Creating...' : 'Create Group'}
        </button>
      </div>
    </div>
  );
}
