import React, { useState, useEffect, useRef, ChangeEvent, FormEvent, MouseEvent, DragEvent } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, setDoc, deleteDoc, getDocs, where, limit } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { Send, Smile, Paperclip, MoreVertical, Image as ImageIcon, Video as VideoIcon, Play, X, FileText, Loader2, Download, Maximize2, Heart, Search, Check, ArrowLeft, Edit2, UserPlus, Info, Users, Mic, Square, Trash2, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';



interface MediaMessageProps {
  type: 'image' | 'video' | 'audio';
  url: string;
  onPreview: (url: string, type: 'image' | 'video' | 'audio') => void;
  duration?: number;
  progress?: number;
  status?: string;
  isMe?: boolean;
  onDelete?: () => void;
  timestamp?: any;
  thumbnail?: string;
  isLocalPreview?: boolean;
  errorMessage?: string;
  isLossless?: boolean;
}

function MediaMessage({ type, url, onPreview, isLocalPreview, thumbnail, duration, status, isMe, onDelete, timestamp, progress, errorMessage, isLossless }: MediaMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [highResLoaded, setHighResLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // High-res display URL
  const highResUrl = url;
  // Fallback to thumbnail or local blob
  const placeholderUrl = thumbnail;

  // Immediate visibility for local previews
  const shouldShowInstant = isLocalPreview && !!url;

  // Check if it's stuck (older than 2 minutes and still uploading)
  const isStuck = !url && status === 'uploading' && timestamp && !isLocalPreview && (
    (Date.now() - (timestamp.toDate ? timestamp.toDate().getTime() : (timestamp.seconds ? timestamp.seconds * 1000 : Date.now()))) > 120000
  );

  const formatDurationSmall = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = (e: MouseEvent) => {
    if (!url || isLocalPreview) return;
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = url;
    link.download = `mchat_${type}_${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!url && !isLocalPreview && !thumbnail) {
    if (status === 'error' || isStuck) {
      const displayError = errorMessage || (isStuck ? 'Upload Stuck' : 'Upload Failed');
      return (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/10 p-4 flex flex-col items-center justify-center gap-2 min-h-[100px] border-2 border-dashed border-red-200 dark:border-red-800/30">
          <X className="w-5 h-5 text-red-500" />
          <p className="text-[10px] text-red-500 font-black uppercase text-center max-w-[150px] leading-tight">
            {displayError}
          </p>
          {isMe && (
            <div className="flex gap-2 mt-1">
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                className="text-[10px] bg-red-500 text-white px-3 py-1 rounded-full font-bold uppercase hover:bg-red-600 transition-colors"
              >
                Discard
              </button>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="rounded-xl bg-gray-100 dark:bg-gray-800 p-4 flex flex-col items-center justify-center gap-2 min-h-[120px] border-2 border-dashed border-gray-200 dark:border-gray-700 relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="relative">
            <Loader2 className="w-6 h-6 text-[#00a884] animate-spin" />
            {progress !== undefined && progress > 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[8px] font-black text-[#00a884]">{Math.round(progress)}%</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tight italic">
            Connecting...
          </p>
        </div>
      </div>
    );
  }

  if (type === 'audio') {
    return (
      <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-xl min-w-[200px]" onClick={e => e.stopPropagation()}>
        <button 
          onClick={() => {
            if (isPlaying) audioRef.current?.pause();
            else audioRef.current?.play();
            setIsPlaying(!isPlaying);
          }}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg transition-colors",
            isLocalPreview && !url ? "bg-gray-400 animate-pulse" : "bg-[#00a884]"
          )}
          disabled={isLocalPreview && !url}
        >
          {isLocalPreview && !url ? <Loader2 className="w-5 h-5 animate-spin" /> : (isPlaying ? <X className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />)}
        </button>
        <div className="flex-1 space-y-1">
          <div className="h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
             {isPlaying && (
               <motion.div 
                 className="h-full bg-[#00a884]"
                 initial={{ width: 0 }}
                 animate={{ width: '100%' }}
                 transition={{ duration: duration || 30, ease: 'linear' }}
               />
             )}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase">
            <span>{isLocalPreview && !url ? 'Sending Voice...' : 'Voice Note'}</span>
            <span className="tabular-nums">{formatDurationSmall(duration || 0)}</span>
          </div>
        </div>
        <audio 
          ref={audioRef} 
          src={url || ""} 
          onEnded={() => setIsPlaying(false)}
          className="hidden" 
        />
      </div>
    );
  }

  return (
    <div 
      className="group relative rounded-2xl overflow-hidden mt-2 max-w-full cursor-pointer bg-black/5 shadow-sm"
      onClick={() => {
        if (url) onPreview(url, type);
        else if (thumbnail) onPreview(thumbnail, type);
      }}
    >
      {type === 'image' ? (
        <div className="relative overflow-hidden bg-gray-100 dark:bg-gray-800/20 text-center min-h-[200px] flex items-center justify-center">
          {highResUrl && (
            <img 
              src={highResUrl} 
              alt="Media content" 
              onLoad={() => setHighResLoaded(true)}
              className={cn(
                "w-full h-auto max-h-[1200px] object-contain transition-all duration-700 rounded-2xl border border-black/5 dark:border-white/5 mx-auto",
                (highResLoaded || shouldShowInstant) ? "opacity-100 relative z-10" : "opacity-0 absolute inset-0"
              )} 
            />
          )}
          {(!highResLoaded || !highResUrl) && placeholderUrl && (
            <img 
              src={placeholderUrl} 
              alt="Thumbnail" 
              className={cn(
                "w-full h-auto max-h-[1200px] object-contain transition-all duration-300 rounded-2xl border border-black/5 dark:border-white/5 mx-auto",
                highResUrl ? "blur-xl scale-105 opacity-60" : "opacity-100"
              )} 
            />
          )}
          {(!highResUrl && !placeholderUrl) && (
             <div className="opacity-40 blur-md p-8 animate-pulse bg-gray-200 dark:bg-gray-700 w-full h-[300px] rounded-2xl" />
          )}
          {isLocalPreview ? (
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full font-black border border-white/10 shadow-xl overflow-hidden scale-90 origin-bottom-right">
              {progress !== undefined && progress < 99 ? (
                <>
                  <Loader2 className="w-3 h-3 text-[#00a884] animate-spin" />
                  <span className="tabular-nums">{Math.round(progress)}%</span>
                </>
              ) : (
                <div className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-white" />
                  <span className="uppercase tracking-tighter">Sent</span>
                </div>
              )}
            </div>
          ) : isLossless && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-[#25D366] text-white text-[9px] px-1.5 py-0.5 rounded shadow-lg font-black uppercase tracking-tighter z-20">
              HD
            </div>
          )}
        </div>
      ) : (
        <div className="relative overflow-hidden bg-gray-100 dark:bg-gray-800/20">
          {(highResUrl || placeholderUrl) ? (
             <div className="relative">
              {highResUrl && (
                <video 
                  src={highResUrl} 
                  autoPlay 
                  muted 
                  loop 
                  playsInline
                  onLoadedData={() => setHighResLoaded(true)}
                  className={cn(
                    "w-full max-h-[1200px] object-contain rounded-2xl transition-opacity duration-500",
                    (highResLoaded || shouldShowInstant) ? "opacity-100 relative z-10" : "opacity-0 absolute inset-0"
                  )} 
                />
              )}
              {(!highResLoaded || !highResUrl) && placeholderUrl && (
                <img 
                  src={placeholderUrl} 
                  className={cn(
                    "w-full h-auto max-h-[1200px] object-contain blur-lg scale-105 rounded-2xl",
                    highResUrl ? "opacity-50" : "opacity-100"
                  )} 
                />
              )}
               {isLocalPreview ? (
                 <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full font-black border border-white/10 shadow-xl overflow-hidden scale-90 origin-bottom-right">
                   {progress !== undefined && progress < 99 ? (
                     <>
                       <Loader2 className="w-3 h-3 text-[#00a884] animate-spin" />
                       <span className="tabular-nums">{Math.round(progress)}%</span>
                     </>
                   ) : (
                     <div className="flex items-center gap-1">
                       <Check className="w-3 h-3 text-white" />
                       <span className="uppercase tracking-tighter">Sent</span>
                     </div>
                   )}
                 </div>
               ) : (
                 <>
                   {isLossless && (
                     <div className="absolute top-2 left-2 flex items-center gap-1 bg-[#25D366] text-white text-[9px] px-1.5 py-0.5 rounded shadow-lg font-black uppercase tracking-tighter z-20">
                       HD
                     </div>
                   )}
                   <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                      <Play className="w-10 h-10 text-white fill-white shadow-lg" />
                   </div>
                 </>
               )}
             </div>
          ) : (
            <div className="w-full h-[200px] bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
               <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
            </div>
          )}
        </div>
      )}
      
      {!isLocalPreview && (
        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center">
          <button 
            onClick={handleDownload}
            className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white backdrop-blur-sm transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <div className="p-1.5 bg-white/20 rounded-lg text-white backdrop-blur-sm">
            <Maximize2 className="w-4 h-4" />
          </div>
        </div>
      )}
    </div>
  );
}

function MediaPreviewModal({ url, type, onClose }: { url: string; type: 'image' | 'video'; onClose: () => void }) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `mchat_full_${type}_${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Header */}
        <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-center text-white bg-gradient-to-b from-black/80 to-transparent z-10 transition-colors">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-90">
              <X className="w-6 h-6 shadow-sm" />
            </button>
            <div>
              <h3 className="font-bold text-sm tracking-tight uppercase tracking-widest">Full Quality Preview</h3>
              <p className="text-[10px] opacity-60 font-black uppercase tracking-tighter">Original Source</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={(e) => { e.stopPropagation(); handleDownload(); }}
              className="px-6 py-3 bg-[#25D366] hover:bg-[#128C7E] rounded-full transition-all flex items-center gap-2 shadow-xl shadow-green-500/20 active:scale-95"
            >
              <Download className="w-5 h-5 text-white" />
              <span className="text-xs font-black uppercase text-white tracking-widest">Save to Device</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="flex-1 w-full h-full flex items-center justify-center p-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
        {type === 'image' ? (
          <img 
            src={url} 
            className="w-full h-full object-contain shadow-[0_40px_80px_rgba(0,0,0,0.6)] rounded-sm" 
            alt="Full size preview"
          />
        ) : (
          <video 
            src={url} 
            className="w-full h-full object-contain shadow-[0_40px_80px_rgba(0,0,0,0.6)] rounded-sm" 
            controls 
            autoPlay 
          />
        )}
      </motion.div>
    </motion.div>
  );
}

const COMMON_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

function ReactionsList({ reactions, onReact, currentUserUid }: { reactions: any; onReact: (emoji: string) => void; currentUserUid: string }) {
  if (!reactions || Object.keys(reactions).length === 0) return null;

  const counts: { [emoji: string]: number } = {};
  const users: { [emoji: string]: string[] } = {};
  
  Object.entries(reactions).forEach(([uid, emoji]: [string, any]) => {
    counts[emoji] = (counts[emoji] || 0) + 1;
    if (!users[emoji]) users[emoji] = [];
    users[emoji].push(uid);
  });

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(counts).map(([emoji, count]) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors border",
            reactions[currentUserUid] === emoji 
              ? "bg-blue-50 border-blue-200 text-blue-600" 
              : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
          )}
        >
          <span>{emoji}</span>
          <span>{count}</span>
        </button>
      ))}
    </div>
  );
}

const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-300 dark:bg-yellow-600/50 dark:text-white rounded-sm px-0.5 no-underline border-b-2 border-yellow-500 shadow-sm">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function UploadProgressTray({ items }: { items: any[] }) {
  return null; // Hidden for real-time feel
}

export function ChatWindow({ chat, currentUser, onBack }: { chat: any; currentUser: any; onBack?: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<any[]>([]);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [sendAsFile, setSendAsFile] = useState(true);
  const [searchPage, setSearchPage] = useState(1);
  const SEARCH_PAGE_SIZE = 10;
  const SEARCH_CONTEXT_SIZE = 2;

  // monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Persist and load offline queue
  useEffect(() => {
    const savedQueue = localStorage.getItem(`offline_queue_${chat.id}`);
    if (savedQueue) {
      setOfflineQueue(JSON.parse(savedQueue));
    }
  }, [chat.id]);

  useEffect(() => {
    localStorage.setItem(`offline_queue_${chat.id}`, JSON.stringify(offlineQueue));
  }, [offlineQueue, chat.id]);

  // Process offline queue when back online
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      const processQueue = async () => {
        const queueCopy = [...offlineQueue];
        setOfflineQueue([]); // Clear queue before processing to avoid duplicates
        
        for (const item of queueCopy) {
          if (item.type === 'text') {
            await actualSendMessage(item.text);
          } else {
            console.warn("Offline media resend not fully implemented due to storage constraints");
          }
        }
      };
      processQueue();
    }
  }, [isOnline, offlineQueue, chat.id]);

  const actualSendMessage = async (text: string) => {
    const chatRef = doc(db, 'chats', chat.id);
    const messagesRef = collection(db, 'chats', chat.id, 'messages');
    
    const replyData = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      senderId: replyingTo.senderId,
      type: replyingTo.type || 'text'
    } : null;

    await addDoc(messagesRef, {
      text,
      senderId: currentUser.uid,
      timestamp: serverTimestamp(),
      readBy: [currentUser.uid],
      reactions: {},
      replyTo: replyData
    });

    await updateDoc(chatRef, {
      lastMessage: { text, senderId: currentUser.uid },
      updatedAt: serverTimestamp()
    });
  };
  const [newGroupName, setNewGroupName] = useState(chat.name || '');
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (chat.type === 'dm') {
      const otherId = chat.participants.find((p: string) => p !== currentUser.uid);
      if (otherId) {
        const unsub = onSnapshot(doc(db, 'users', otherId), (snap) => {
          setOtherUser(snap.data());
        });
        return unsub;
      }
    }
  }, [chat.id, chat.type, currentUser.uid]);

  useEffect(() => {
    if (!chat.id) return;

    const q = query(
      collection(db, 'chats', chat.id, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return unsub;
  }, [chat.id]);

  // Listen for typing users
  useEffect(() => {
    if (!chat.id) return;
    const unsub = onSnapshot(collection(db, 'chats', chat.id, 'typing'), (snap) => {
      const typing = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((u: any) => u.id !== currentUser.uid && u.isTyping);
      setTypingUsers(typing);
    });
    return unsub;
  }, [chat.id, currentUser.uid]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Read Receipts Logic
  useEffect(() => {
    if (!messages.length || !chat.id || !isOnline) return;

    const markAsRead = async () => {
      const unreadMessages = messages.filter(msg => 
        msg.senderId !== currentUser.uid && 
        (!msg.readBy || !msg.readBy.includes(currentUser.uid))
      );

      if (unreadMessages.length === 0) return;

      // Update messages to be marked as read
      for (const msg of unreadMessages) {
        try {
          const msgRef = doc(db, 'chats', chat.id, 'messages', msg.id);
          await updateDoc(msgRef, {
            readBy: arrayUnion(currentUser.uid)
          });
        } catch (e) {
          // Silently fail for read receipts to avoid spamming errors if permission denied
        }
      }
    };

    markAsRead();
  }, [messages, chat.id, currentUser.uid, isOnline]);

  const updateTypingStatus = async (isTyping: boolean) => {
    if (!chat.id) return;
    try {
      const typingRef = doc(db, 'chats', chat.id, 'typing', currentUser.uid);
      if (isTyping) {
        await setDoc(typingRef, { isTyping: true, lastUpdate: serverTimestamp() });
      } else {
        await setDoc(typingRef, { isTyping: false, lastUpdate: serverTimestamp() });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `chats/${chat.id}/typing/${currentUser.uid}`);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Set typing to true
    updateTypingStatus(true);

    // Clear previous timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Set new timeout to clear typing
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 3000);
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Your browser does not support audio recording.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudio({ 
          blob: audioBlob, 
          url, 
          duration: recordDuration 
        });
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone error:", err);
      // Optional: Add a more user-friendly notification
    }
  };

  const stopRecording = (cancel = false) => {
    if (mediaRecorderRef.current && isRecording) {
      if (cancel) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const finalizeVoiceMessage = () => {
    if (!recordedAudio) return;
    const duration = recordedAudio.duration;
    const mimeType = recordedAudio.blob.type || 'audio/webm';
    const extension = mimeType.split('/')[1]?.split(';')[0] || 'webm';
    const file = new File([recordedAudio.blob], `voice_${Date.now()}.${extension}`, { type: mimeType });
    processFiles([file], duration);
    discardVoiceMessage();
  };

  const discardVoiceMessage = () => {
    if (recordedAudio?.url) {
      URL.revokeObjectURL(recordedAudio.url);
    }
    setRecordedAudio(null);
    setIsAudioPlaying(false);
  };

  const toggleAudioPlayback = () => {
    if (!audioPlaybackRef.current) return;
    if (isAudioPlaying) {
      audioPlaybackRef.current.pause();
    } else {
      audioPlaybackRef.current.play();
    }
    setIsAudioPlaying(!isAudioPlaying);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    processFiles(files);
  };

  const processFiles = async (files: File[], voiceDuration?: number) => {
    if (files.length === 0) return;

    setUploading(true);

    const generateThumbnail = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        if (file.type.startsWith('image/')) {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            const maxDim = 1200; // Increased resolution for "preview" quality while uploading
            let w = img.width;
            let h = img.height;
            if (w > h) { h = (h/w) * maxDim; w = maxDim; }
            else { w = (w/h) * maxDim; h = maxDim; }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.85)); // Good quality thumbnail
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve('');
          };
          img.src = url;
          return;
        }

        if (!file.type.startsWith('video/')) {
          resolve('');
          return;
        }
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        const url = URL.createObjectURL(file);
        video.src = url;
        
        const timeout = setTimeout(() => {
          video.src = '';
          URL.revokeObjectURL(url);
          resolve('');
        }, 10000);

        video.onloadedmetadata = () => {
          video.currentTime = 0.5;
        };
        video.onseeked = () => {
          clearTimeout(timeout);
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let w = video.videoWidth;
          let h = video.videoHeight;
          if (w > h) { h = (h/w) * maxDim; w = maxDim; }
          else { w = (w/h) * maxDim; h = maxDim; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumb = canvas.toDataURL('image/jpeg', 0.85);
          URL.revokeObjectURL(url);
          resolve(thumb);
        };
        video.onerror = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          resolve('');
        };
      });
    };

    const compressImage = async (file: File): Promise<File> => {
      if (!file.type.startsWith('image/')) return file;
      
      // Speed check: Very small files don't need compression and can be sent instantly
      if (file.size < 0.5 * 1024 * 1024) {
        return file;
      }

      return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        const timeout = setTimeout(() => {
          img.src = '';
          URL.revokeObjectURL(url);
          resolve(file); 
        }, 8000);

        img.onload = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          const canvas = document.createElement('canvas');
          // Maintain "Full Size" as requested by user
          const w = img.width;
          const h = img.height;

          // If it's already a JPEG and resolution is reasonable, don't re-compress and risk quality loss
          if (file.type === 'image/jpeg' && file.size < 5 * 1024 * 1024) {
            resolve(file);
            return;
          }

          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) { resolve(file); return; }
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.98); // 98% Ultra-High quality encoding for professional sharpness
        };
        img.onerror = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          resolve(file);
        };
        img.src = url;
      });
    };

    // Direct processing for speed
    for (const rawFile of files) {
      const MAX_SIZE = 100 * 1024 * 1024; // 100MB
      const isTooLarge = rawFile.size > MAX_SIZE;
      const isUnsupported = !rawFile.type.startsWith('image/') && !rawFile.type.startsWith('video/') && !rawFile.type.startsWith('audio/');

      const msgRef = doc(collection(db, 'chats', chat.id, 'messages'));
      const msgId = msgRef.id;
      
      const type: 'image' | 'video' | 'audio' = rawFile.type.startsWith('video/') ? 'video' : (rawFile.type.startsWith('audio/') ? 'audio' : 'image');
      const localPreviewUrl = URL.createObjectURL(rawFile);
      const currentDuration = type === 'audio' ? (voiceDuration || recordedAudio?.duration || 0) : undefined;

      // 1. Instant UI update - SHOW LOCALLY IMMEDIATELY
      setPendingMedia(prev => [...prev, { 
        id: msgId, 
        progress: 5, 
        mediaUrl: localPreviewUrl, 
        size: rawFile.size, 
        type,
        status: (isTooLarge || isUnsupported) ? 'error' : 'uploading',
        errorMessage: isTooLarge ? 'File too large (Max 100MB)' : isUnsupported ? 'Unsupported file format' : undefined,
        duration: currentDuration
      }]);

      if (isTooLarge || isUnsupported) {
        // Create an error record in Firestore so it's persisted across refreshes
        (async () => {
          try {
            await setDoc(msgRef, {
              type: type,
              fileName: rawFile.name,
              senderId: currentUser.uid,
              timestamp: serverTimestamp(),
              status: 'error',
              errorMessage: isTooLarge ? 'File too large (Max 100MB)' : 'Unsupported file format',
              readBy: [currentUser.uid],
              reactions: {},
              size: rawFile.size,
              tempId: msgId
            });
          } catch (e) {}
        })();
        continue;
      }
      
      // 2. Process in background
      (async () => {
        try {
          // Generate thumbnail for instant feel
          const thumbnailData = await generateThumbnail(rawFile);
          
          // Image compression logic
          let fileToUpload = rawFile;
          if (!sendAsFile && type === 'image') {
            fileToUpload = await compressImage(rawFile);
          }

          // Update local preview state
          setPendingMedia(prev => prev.map(m => m.id === msgId ? { ...m, thumbnail: thumbnailData, forceFile: sendAsFile, size: fileToUpload.size } : m));

          // 3. Create Firestore Record
          await setDoc(msgRef, {
            type: type, // Keep original type so it renders correctly, even if sent lossless
            fileName: rawFile.name,
            senderId: currentUser.uid,
            timestamp: serverTimestamp(),
            status: 'uploading',
            readBy: [currentUser.uid],
            reactions: {},
            size: fileToUpload.size,
            thumbnail: thumbnailData,
            duration: currentDuration || null,
            tempId: msgId,
            isLossless: sendAsFile // Track if it was sent without compression
          });

          // 4. Upload to storage
          const extension = fileToUpload.name.split('.').pop() || (type === 'audio' ? 'webm' : 'bin');
          const storageRef = ref(storage, `chats/${chat.id}/${msgId}.${extension}`);
          const uploadTask = uploadBytesResumable(storageRef, fileToUpload, { contentType: fileToUpload.type });

          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setPendingMedia(prev => prev.map(m => 
                m.id === msgId ? { ...m, progress: Math.max(progress, 5) } : m
              ));
            },
            async (error) => {
              console.error("Upload failed:", error);
              let errorText = 'Upload failed';
              if (error.code === 'storage/quota-exceeded') errorText = 'Storage quota exceeded';
              else if (error.code === 'storage/unauthorized') errorText = 'Permission denied';
              else if (error.code === 'storage/retry-limit-exceeded') errorText = 'Network timeout';
              else if (!navigator.onLine) errorText = 'Waiting for network...';
              
              setPendingMedia(prev => prev.map(m => 
                m.id === msgId ? { ...m, status: 'error', errorMessage: errorText } : m
              ));

              try {
                await updateDoc(msgRef, { 
                  status: 'error',
                  errorMessage: errorText
                });
              } catch (err) {}
              
              // We don't remove immediately so user can see it
              setTimeout(() => {
                 URL.revokeObjectURL(localPreviewUrl);
              }, 10000);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                
                await updateDoc(msgRef, {
                  mediaUrl: downloadURL,
                  status: 'sent',
                  timestamp: serverTimestamp()
                });

                await updateDoc(doc(db, 'chats', chat.id), {
                  lastMessage: { 
                    text: type === 'image' ? '📷 Photo' : type === 'video' ? '🎥 Video' : '🎤 Voice message', 
                    senderId: currentUser.uid,
                    timestamp: serverTimestamp()
                  },
                  updatedAt: serverTimestamp()
                });

                // Clean up
                setTimeout(() => {
                  URL.revokeObjectURL(localPreviewUrl);
                  setPendingMedia(prev => prev.filter(m => m.id !== msgId));
                }, 800);
              } catch (err) {
                console.error("Finalize error:", err);
              }
            }
          );
        } catch (err) {
          console.error("Processing error:", err);
          setPendingMedia(prev => prev.filter(m => m.id !== msgId));
          URL.revokeObjectURL(localPreviewUrl);
        }
      })();
    }

    setUploading(false);
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const text = newMessage.trim();
    const replyData = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      senderId: replyingTo.senderId,
      type: replyingTo.type
    } : null;

    setNewMessage('');
    setReplyingTo(null);
    updateTypingStatus(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (!isOnline) {
      const offlineMsg = {
        id: `offline-${Date.now()}`,
        type: 'text',
        text,
        senderId: currentUser.uid,
        timestamp: { toDate: () => new Date() },
        isOffline: true
      };
      setOfflineQueue(prev => [...prev, offlineMsg]);
      return;
    }

    try {
      await actualSendMessage(text);
    } catch (error) {
      console.error("Send error:", error);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string, currentReactions: any) => {
    try {
      const reactions = { ...(currentReactions || {}) };
      if (reactions[currentUser.uid] === emoji) {
        delete reactions[currentUser.uid];
      } else {
        reactions[currentUser.uid] = emoji;
      }
      
      const msgRef = doc(db, 'chats', chat.id, 'messages', messageId);
      await updateDoc(msgRef, { reactions });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `chats/${chat.id}/messages/${messageId}`);
    }
  };

  const handleUpdateGroupName = async () => {
    if (!newGroupName.trim() || newGroupName === chat.name) {
      setIsEditingName(false);
      return;
    }
    try {
      await updateDoc(doc(db, 'chats', chat.id), {
        name: newGroupName,
        updatedAt: serverTimestamp()
      });
      setIsEditingName(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `chats/${chat.id}`);
    }
  };

  const searchNewMembers = async () => {
    if (memberSearchTerm.trim().length < 2) return;
    setSearchingMembers(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '>=', memberSearchTerm.toLowerCase()),
        where('username', '<=', memberSearchTerm.toLowerCase() + '\uf8ff'),
        limit(10)
      );
      const snap = await getDocs(q);
      const results = snap.docs
        .map(doc => doc.data())
        .filter(u => !chat.participants.includes(u.uid));
      setMemberSearchResults(results);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingMembers(false);
    }
  };

  const addParticipant = async (user: any) => {
    try {
      await updateDoc(doc(db, 'chats', chat.id), {
        participants: arrayUnion(user.uid),
        updatedAt: serverTimestamp()
      });
      setMemberSearchResults(prev => prev.filter(u => u.uid !== user.uid));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `chats/${chat.id}`);
    }
  };

  const getStatusText = () => {
    if (chat.type === 'group') return `${chat.participants?.length || 0} members`;
    if (!otherUser) return 'Offline';
    if (otherUser.isOnline) return 'Online';
    if (otherUser.lastSeen) {
      const date = otherUser.lastSeen.toDate ? otherUser.lastSeen.toDate() : new Date(otherUser.lastSeen);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) return `Last seen today at ${format(date, 'HH:mm')}`;
      return `Last seen on ${format(date, 'MMM d, HH:mm')}`;
    }
    return 'Offline';
  };

  return (
    <div 
      className="flex-1 flex flex-col h-full bg-[#efe7dd] dark:bg-[#0b141a] relative overflow-hidden"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Background Pattern - WhatsApp style */}
      <div 
        className="absolute inset-0 opacity-[0.06] dark:opacity-[0.03] pointer-events-none z-0" 
        style={{ 
          backgroundImage: `url("https://www.transparenttextures.com/patterns/pinstriped-suit.png")`,
          filter: 'invert(1)'
        }} 
      />

      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-[#25D366]/20 backdrop-blur-sm border-4 border-dashed border-[#25D366] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white dark:bg-[#111b21] p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-[#25D366] rounded-full flex items-center justify-center text-white">
                <Download className="w-10 h-10 animate-bounce" />
              </div>
              <h2 className="text-xl font-bold dark:text-white">Drop to send media</h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="p-2 pt-4 pb-3 border-b dark:border-gray-800 flex items-center justify-between bg-[#f0f2f5] dark:bg-[#202c33] sticky top-0 z-30 shadow-sm transition-colors">
        <div className="flex items-center gap-2 flex-1 overflow-hidden min-w-0">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors mr-1 text-[#54656f] dark:text-[#aebac1]"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}

          {isSearchingMessages ? (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '100%', opacity: 1 }}
              className="flex-1 flex items-center gap-2 px-2"
            >
              <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg flex items-center px-3 gap-2 border border-gray-100 dark:border-none shadow-sm">
                <Search className="w-4 h-4 text-[#54656f] dark:text-[#aebac1]" />
                <input 
                  autoFocus
                  type="text"
                  placeholder="Search messages..."
                  value={messageSearchTerm}
                  onChange={(e) => {
                    setMessageSearchTerm(e.target.value);
                    setSearchPage(1);
                  }}
                  className="w-full py-1.5 text-sm bg-transparent border-none outline-none text-[#111b21] dark:text-[#e9edef]"
                />
                <button 
                  onClick={() => {
                    setIsSearchingMessages(false);
                    setMessageSearchTerm('');
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                   <X className="w-4 h-4 text-[#54656f] dark:text-[#aebac1]" />
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              <div 
                className="relative shrink-0 cursor-pointer group"
                onClick={() => setShowGroupInfo(true)}
              >
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden ring-2 ring-transparent group-hover:ring-[#25D366] transition-all p-0.5 shadow-sm">
                   <div className="w-full h-full rounded-full overflow-hidden border border-white dark:border-gray-800">
                      {chat.type === 'dm' ? (
                        <img 
                          src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.participants?.find((p: string) => p !== currentUser.uid)}`} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#f0f2f5] dark:bg-[#202c33] text-[#00a884]">
                          <Users className="w-6 h-6" />
                        </div>
                      )}
                   </div>
                </div>
                {chat.type === 'dm' && otherUser?.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#25D366] rounded-full border-2 border-[#f0f2f5] dark:border-[#202c33]" />
                )}
              </div>
              <div 
                className="flex flex-col min-w-0 cursor-pointer overflow-hidden ml-1"
                onClick={() => setShowGroupInfo(true)}
              >
                <h3 className="font-bold text-[15px] md:text-[16px] text-[#111b21] dark:text-[#e9edef] truncate leading-tight">
                  {chat.type === 'dm' ? (otherUser?.displayName || 'Chat') : chat.name}
                </h3>
                <p className="text-[10px] md:text-[11px] text-[#667781] dark:text-[#8696a0] font-bold truncate leading-none mt-0.5 opacity-80 uppercase tracking-tight">
                  {getStatusText()}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0 pr-2">
          {!isSearchingMessages && (
            <>
              <button 
                onClick={() => setIsSearchingMessages(true)}
                className="p-2 md:p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-all text-[#54656f] dark:text-[#aebac1] hover:text-[#00a884]"
              >
                <Search className="w-5 h-5 md:w-5 md:h-5" />
              </button>
            </>
          )}
          <button 
            onClick={() => setShowGroupInfo(true)}
            className="p-2 md:p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-all text-[#54656f] dark:text-[#aebac1]"
          >
            <MoreVertical className="w-5 h-5 md:w-5 md:h-5" />
          </button>
        </div>
      </div>


      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 z-10 relative scrollbar-hide">
        {(() => {
          let allMessages = [...messages, ...offlineQueue];
          
          // Add pending media that haven't reached Firestore yet
          const firestoreIds = new Set(messages.map(m => m.id));
          const firestoreTempIds = new Set(messages.map(m => m.tempId).filter(Boolean));
          
          const virtualPendingMessages = pendingMedia
            .filter(p => !firestoreIds.has(p.id) && !firestoreTempIds.has(p.id))
            .map(p => ({
              id: p.id,
              type: p.type,
              senderId: currentUser.uid,
              timestamp: { toDate: () => new Date() },
              status: 'uploading',
              isVirtual: true,
              mediaUrl: p.mediaUrl,
              thumbnail: p.thumbnail,
              size: p.size,
              duration: p.duration
            }));

          allMessages = [...allMessages, ...virtualPendingMessages].sort((a, b) => {
            const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : Date.now());
            const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : Date.now());
            return timeA - timeB;
          });

          if (messageSearchTerm.trim()) {
            const term = messageSearchTerm.toLowerCase();
            const matchingIndices = allMessages.reduce((acc: number[], msg, idx) => {
              if (msg.text?.toLowerCase().includes(term)) acc.push(idx);
              return acc;
            }, []);

            const totalResults = matchingIndices.length;
            const totalPages = Math.ceil(totalResults / SEARCH_PAGE_SIZE);
            
            if (totalResults === 0) {
              return (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 animate-in fade-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-[#111b21] rounded-full flex items-center justify-center">
                    <Search className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="text-sm font-medium">No messages found matching "{messageSearchTerm}"</p>
                  <button 
                    onClick={() => setMessageSearchTerm('')}
                    className="text-[#00a884] text-xs font-bold uppercase hover:underline"
                  >
                    Clear search
                  </button>
                </div>
              );
            }

            const startIndex = (searchPage - 1) * SEARCH_PAGE_SIZE;
            const currentPageMatches = matchingIndices.slice(startIndex, startIndex + SEARCH_PAGE_SIZE);

            return (
              <div className="space-y-8 pb-20">
                <div className="bg-[#00a884]/10 p-3 rounded-xl border border-[#00a884]/20 flex items-center justify-between sticky top-0 bg-[#efe7dd]/90 dark:bg-[#0b141a]/90 backdrop-blur-md z-30 shadow-sm">
                  <span className="text-xs font-bold text-[#00a884] uppercase tracking-wider">
                    Found {totalResults} {totalResults === 1 ? 'match' : 'matches'}
                  </span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-4">
                      <button 
                        disabled={searchPage === 1}
                        onClick={() => setSearchPage(p => Math.max(1, p - 1))}
                        className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                         <ChevronLeft className="w-5 h-5 text-[#00a884]" />
                      </button>
                      <span className="text-xs font-black text-[#667781] dark:text-[#8696a0] tabular-nums">
                        Page {searchPage} of {totalPages}
                      </span>
                      <button 
                        disabled={searchPage === totalPages}
                        onClick={() => setSearchPage(p => Math.min(totalPages, p + 1))}
                        className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                         <ChevronRight className="w-5 h-5 text-[#00a884]" />
                      </button>
                    </div>
                  )}
                </div>

                {currentPageMatches.map((matchIdx, groupIdx) => {
                  const start = Math.max(0, matchIdx - SEARCH_CONTEXT_SIZE);
                  const end = Math.min(allMessages.length - 1, matchIdx + SEARCH_CONTEXT_SIZE);
                  const contextMessages = allMessages.slice(start, end + 1);

                  return (
                    <div key={`group-${matchIdx}`} className="space-y-1 relative">
                       <div className="absolute -left-4 top-0 bottom-0 w-1 bg-[#00a884]/20 rounded-full" />
                       <p className="text-[10px] font-black uppercase text-[#00a884] tracking-widest pl-2 mb-2 italic flex items-center gap-2">
                          <Check className="w-3 h-3" /> Result {startIndex + groupIdx + 1}
                       </p>
                       {contextMessages.map((msg, idx) => {
                          const isMe = msg.senderId === currentUser.uid;
                          const msgDate = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date();
                          const isMatch = msg.text?.toLowerCase().includes(term);

                          return (
                            <div key={msg.id || `${matchIdx}-${idx}`} className={cn(
                              "flex flex-col animate-in fade-in slide-in-from-left-2 duration-300",
                              isMe ? "items-end" : "items-start"
                            )}>
                              <div className={cn(
                                "relative p-2 rounded-2xl shadow-sm text-sm transition-all",
                                isMe ? "bg-[#dcf8c6] dark:bg-[#005c4b]" : "bg-white dark:bg-[#202c33]",
                                isMatch ? "ring-2 ring-[#25D366] ring-offset-2 dark:ring-offset-[#0b141a] scale-[1.02] shadow-lg z-10" : "opacity-60 scale-95"
                              )}>
                                {msg.text && (
                                  <p className="whitespace-pre-wrap">
                                    <HighlightText text={msg.text} highlight={isMatch ? messageSearchTerm : ""} />
                                  </p>
                                )}
                                {msg.type && msg.type !== 'text' && (
                                   <div className="text-[10px] opacity-70 font-bold uppercase mt-1 italic">
                                     📎 Attachment: {msg.type}
                                   </div>
                                )}
                                <div className="text-[9px] mt-1 opacity-50 font-bold text-right">
                                  {format(msgDate, 'HH:mm')} • {isMe ? 'You' : 'Other'}
                                </div>
                              </div>
                            </div>
                          );
                       })}
                    </div>
                  );
                })}

                {totalPages > 1 && (
                   <div className="flex justify-center pt-4 sticky bottom-4 z-20">
                      <div className="bg-white dark:bg-[#202c33] px-6 py-2 rounded-full shadow-2xl border dark:border-gray-800 flex items-center gap-6">
                        <button 
                          disabled={searchPage === 1}
                          onClick={() => setSearchPage(p => Math.max(1, p - 1))}
                          className="text-[#00a884] font-bold text-sm disabled:opacity-30 flex items-center gap-1"
                        >
                          <ChevronLeft className="w-4 h-4" /> Previous
                        </button>
                        <span className="text-xs font-black text-gray-500">{searchPage} / {totalPages}</span>
                        <button 
                          disabled={searchPage === totalPages}
                          onClick={() => setSearchPage(p => Math.min(totalPages, p + 1))}
                          className="text-[#00a884] font-bold text-sm disabled:opacity-30 flex items-center gap-1"
                        >
                          Next <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                   </div>
                )}
              </div>
            );
          }

          if (allMessages.length === 0 && messageSearchTerm.trim()) {
            return (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-gray-100 dark:bg-[#111b21] rounded-full flex items-center justify-center">
                  <Search className="w-8 h-8 opacity-20" />
                </div>
                <p className="text-sm font-medium">No messages found matching "{messageSearchTerm}"</p>
                <button 
                  onClick={() => setMessageSearchTerm('')}
                  className="text-[#00a884] text-xs font-bold uppercase hover:underline"
                >
                  Clear search
                </button>
              </div>
            );
          }

          return allMessages.map((msg, idx) => {
            const isMe = msg.senderId === currentUser.uid;
            const msgDate = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date();
            const prevMsg = idx > 0 ? allMessages[idx - 1] : null;
            const prevMsgDate = prevMsg?.timestamp?.toDate ? prevMsg.timestamp.toDate() : null;
            
            const showDateSeparator = !prevMsgDate || msgDate.toDateString() !== prevMsgDate.toDateString();
            const isFirstInSequence = !prevMsg || prevMsg.senderId !== msg.senderId || showDateSeparator;
            const pending = msg.isVirtual ? pendingMedia.find(p => p.id === msg.id) : pendingMedia.find(p => p.id === msg.id || (msg.tempId && p.id === msg.tempId));

            return (
              <div key={msg.id || idx} className="flex flex-col group">
                {showDateSeparator && (
                  <div className="flex justify-center my-4 sticky top-0 z-20">
                    <span className="bg-[#f0f2f5] px-4 py-1 rounded-lg text-[12.5px] text-[#667781] shadow-sm font-medium uppercase tracking-wide border border-gray-100">
                      {msgDate.toDateString() === new Date().toDateString() ? 'Today' : format(msgDate, 'MMMM d, yyyy')}
                    </span>
                  </div>
                )}
                <div className={cn(
                  "flex relative animate-in fade-in slide-in-from-bottom-2 duration-300",
                  isMe ? "self-end" : "self-start",
                  msg.type && msg.type !== 'text' ? "w-full max-w-[95%]" : "max-w-[92%] md:max-w-[85%] lg:max-w-[80%]",
                  isFirstInSequence ? "mt-4" : "mt-0.5",
                  msg.isOffline && "opacity-70"
                )}>
                  <div className={cn(
                    "relative p-1 md:p-1.5 rounded-2xl shadow-md min-w-[120px] transition-all",
                    isMe ? "bg-[#dcf8c6] dark:bg-[#005c4b] dark:text-[#e9edef] rounded-tr-none" : "bg-white dark:bg-[#202c33] dark:text-[#e9edef] rounded-tl-none border border-gray-100/50 dark:border-none",
                    msg.type && msg.type !== 'text' ? "w-full" : ""
                  )}>
                      {isFirstInSequence && isMe && (
                        <div className="absolute top-0 right-[-8px] w-0 h-0 border-l-[10px] border-l-[#dcf8c6] dark:border-l-[#005c4b] border-b-[10px] border-b-transparent" />
                      )}
                      {isFirstInSequence && !isMe && (
                        <div className="absolute top-0 left-[-8px] w-0 h-0 border-r-[10px] border-r-white dark:border-r-[#202c33] border-b-[10px] border-b-transparent" />
                      )}

                      {/* Reply To Preview */}
                      {msg.replyTo && (
                        <div className="mb-2 p-2 bg-black/5 dark:bg-white/5 border-l-4 border-[#00a884] rounded flex flex-col gap-0.5 text-[11px] opacity-80 cursor-pointer hover:bg-black/10 transition-colors">
                          <span className="font-black text-[#00a884]">
                             {msg.replyTo.senderId === currentUser.uid ? 'You' : (chat.type === 'dm' ? otherUser?.displayName : 'Member')}
                          </span>
                          <p className="truncate italic">
                            {msg.replyTo.type && msg.replyTo.type !== 'text' ? `📎 Attachment` : msg.replyTo.text}
                          </p>
                        </div>
                      )}

                      {msg.text && <p className="whitespace-pre-wrap px-1 text-[15px]">{msg.text}</p>}
                      {msg.type && msg.type !== 'text' && (
                <div className="relative group w-full">
                  <MediaMessage 
                    type={msg.type || 'image'} 
                    url={pending?.mediaUrl || msg.mediaUrl} 
                    thumbnail={pending?.thumbnail || msg.thumbnail}
                    onPreview={(url, type) => setPreviewMedia({ url, type })} 
                    isLocalPreview={!!pending}
                    duration={msg.duration}
                    status={msg.status}
                    progress={pending?.progress}
                    errorMessage={msg.errorMessage || pending?.errorMessage}
                    isMe={isMe}
                    timestamp={msg.timestamp}
                    onDelete={() => deleteDoc(doc(db, 'chats', chat.id, 'messages', msg.id))}
                    isLossless={msg.isLossless}
                  />
                </div>
                      )}
                    
                    <div className="flex items-center justify-end gap-1 mt-1 px-1">
                      <span className="text-[10px] text-[#667781] dark:text-[#8696a0] uppercase font-bold opacity-70">
                        {format(msgDate, 'HH:mm')}
                      </span>
                      {isMe && (
                        <div className="flex">
                          {msg.isOffline ? (
                            <span className="text-[9px] text-[#8696a0] italic">Waiting for network...</span>
                          ) : (msg.status === 'uploading' || msg.isVirtual) ? (
                            <Check className="w-3 h-3 text-[#8696a0] opacity-50" />
                          ) : (() => {
                            const isRead = chat.participants?.every((p: string) => msg.readBy?.includes(p));
                            return (
                              <div className="relative flex items-center">
                                <Check className={cn("w-3 h-3 -mr-1.5 transition-colors duration-300", isRead ? "text-[#34b7f1]" : "text-[#8696a0]")} />
                                <Check className={cn("w-3 h-3 transition-colors duration-300", isRead ? "text-[#34b7f1]" : "text-[#8696a0]")} />
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={cn(
                    "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center gap-1 bg-white dark:bg-[#111b21] shadow-xl border border-gray-100 dark:border-gray-800 rounded-full px-1.5 py-1",
                    isMe ? "-left-2 -translate-x-full" : "-right-2 translate-x-full"
                  )}>
                    <button 
                      onClick={() => setReplyingTo(msg)}
                      className="hover:scale-110 transition-transform p-1 text-gray-400 hover:text-[#00a884]"
                      title="Reply"
                    >
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </button>
                    <div className="w-[1px] h-4 bg-gray-100 dark:bg-gray-800 mx-1" />
                    {COMMON_REACTIONS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(msg.id, emoji, msg.reactions)}
                        className="hover:scale-150 transition-transform px-0.5 text-lg leading-none"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={cn("mt-0.5", isMe ? "items-end" : "items-start")}>
                  <ReactionsList 
                    reactions={msg.reactions} 
                    onReact={(emoji) => toggleReaction(msg.id, emoji, msg.reactions)}
                    currentUserUid={currentUser.uid}
                  />
                </div>
              </div>
            );
          });
        })()}

        {/* Typing indicator */}
        {typingUsers.length > 0 && !messageSearchTerm.trim() && (
          <div className="mr-auto">
            <div className="bg-white dark:bg-[#202c33] text-gray-500 dark:text-[#8696a0] text-xs italic p-2 rounded-xl flex items-center gap-2 shadow-sm border dark:border-none">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-[#25D366] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-[#25D366] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-[#25D366] rounded-full animate-bounce"></span>
              </div>
              <span className="font-bold">
                {chat.type === 'group' 
                  ? `${typingUsers.length} people are typing...` 
                  : 'Typing...'}
              </span>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t dark:border-gray-800 relative z-10 transition-colors">
        <AnimatePresence>
          {pendingMedia.length > 0 && <UploadProgressTray items={pendingMedia} />}
        </AnimatePresence>
        
        {/* Quality Controls */}
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Quality</div>
          <button 
             type="button"
             onClick={() => setSendAsFile(false)}
             className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5",
                !sendAsFile ? "bg-[#00a884] text-white shadow-lg" : "bg-white dark:bg-[#111b21] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 border dark:border-none"
             )}
           >
             {!sendAsFile && <Check className="w-3 h-3" />}
             Standard
           </button>
           <button 
             type="button"
             onClick={() => setSendAsFile(true)}
             className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5",
                sendAsFile ? "bg-blue-600 text-white shadow-lg" : "bg-white dark:bg-[#111b21] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 border dark:border-none"
             )}
           >
             {sendAsFile && <Check className="w-3 h-3" />}
             Original Quality
           </button>
        </div>

        {replyingTo && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-2 p-3 bg-white dark:bg-[#111b21] border-l-4 border-[#00a884] rounded-lg shadow-sm flex items-center justify-between"
          >
            <div className="flex flex-col gap-0.5 overflow-hidden">
               <span className="text-[11px] font-black text-[#00a884] uppercase">
                 Replying to {replyingTo.senderId === currentUser.uid ? 'yourself' : (chat.type === 'dm' ? otherUser?.displayName : 'Member')}
               </span>
               <p className="text-xs text-gray-500 truncate italic">
                 {replyingTo.type && replyingTo.type !== 'text' ? '📎 Attachment' : replyingTo.text}
               </p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400">
               <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        <form onSubmit={sendMessage} className="flex items-center gap-3">
          <input 
            type="file" 
            hidden 
            ref={fileInputRef} 
            onChange={(e) => processFiles(Array.from(e.target.files || []))}
            accept="image/*,video/*,audio/*"
            multiple
          />
          <div className="flex items-center gap-1">
            {!isRecording && !recordedAudio && (
              <>
                <button type="button" className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <Smile className="w-6 h-6 text-[#54656f] dark:text-[#aebac1]" />
                </button>
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <Paperclip className="w-6 h-6 text-[#54656f] dark:text-[#aebac1]" />
                </button>
              </>
            )}
          </div>
          
          <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg px-4 py-1 flex items-center shadow-sm border border-gray-100 dark:border-none transition-colors overflow-hidden">
            {isRecording ? (
              <div className="flex-1 flex items-center justify-between py-2 text-[#00a884] font-bold">
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm font-mono">{formatDuration(recordDuration)}</span>
                 </div>
                 <div className="flex items-center gap-4">
                    <button 
                      type="button" 
                      onClick={() => stopRecording(true)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-red-500 transition-colors"
                      title="Discard"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <span className="text-[11px] text-gray-400 uppercase opacity-50 tracking-widest animate-pulse">Recording...</span>
                 </div>
              </div>
            ) : recordedAudio ? (
              <div className="flex-1 flex items-center gap-3 py-1">
                <button 
                  type="button"
                  onClick={toggleAudioPlayback}
                  className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-white"
                >
                  {isAudioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    {isAudioPlaying && (
                      <motion.div 
                        className="h-full bg-[#00a884]"
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: recordedAudio.duration, ease: 'linear' }}
                      />
                    )}
                  </div>
                  <span className="text-xs font-mono text-gray-500">{formatDuration(recordedAudio.duration)}</span>
                </div>
                <button 
                  type="button" 
                  onClick={discardVoiceMessage}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <audio 
                  ref={audioPlaybackRef} 
                  src={recordedAudio.url} 
                  onEnded={() => setIsAudioPlaying(false)}
                  className="hidden"
                />
              </div>
            ) : (
              <input 
                type="text" 
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Type a message"
                className="flex-1 bg-transparent border-none outline-none py-2 text-[15px] text-[#111b21] dark:text-[#e9edef]"
              />
            )}
          </div>

          {isRecording ? (
            <button 
              type="button"
              onClick={() => stopRecording(false)}
              className="p-3 bg-red-500 text-white rounded-full transition-all shadow-lg hover:scale-110 active:scale-95"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          ) : recordedAudio ? (
            <button 
              type="button"
              onClick={finalizeVoiceMessage}
              className="p-3 bg-[#00a884] text-white rounded-full transition-all shadow-lg hover:scale-110 active:scale-95"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          ) : newMessage.trim() ? (
            <button 
              type="submit"
              className="p-3 bg-[#00a884] text-white rounded-full transition-all shadow-lg hover:scale-110 active:scale-95"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          ) : (
            <button 
              type="button"
              onClick={startRecording}
              className="p-3 bg-[#54656f] dark:bg-[#aebac1] text-white rounded-full transition-all hover:scale-110 active:scale-95 shadow-md"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </form>
      </div>

      <AnimatePresence>
        {previewMedia && (
          <MediaPreviewModal 
            url={previewMedia.url} 
            type={previewMedia.type} 
            onClose={() => setPreviewMedia(null)} 
          />
        )}
        {showGroupInfo && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute inset-0 z-50 bg-[#f0f2f5] flex flex-col"
          >
            <div className="p-4 bg-white border-b flex items-center gap-4 shadow-sm">
              <button onClick={() => setShowGroupInfo(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft className="w-6 h-6 text-[#54656f]" />
              </button>
              <h2 className="font-bold text-lg text-[#111b21]">Group Info</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="flex flex-col items-center gap-4 py-8 bg-white rounded-xl shadow-sm">
                <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center border-4 border-gray-50">
                  <Users className="w-16 h-16 text-[#00a884]" />
                </div>
                <div className="text-center w-full px-6">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="flex-1 bg-gray-50 border-none rounded-lg p-2 text-center font-bold outline-none ring-2 ring-[#00a884]"
                        autoFocus
                      />
                      <button onClick={handleUpdateGroupName} className="p-2 bg-[#00a884] text-white rounded-lg">
                        <Check className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <h2 className="text-2xl font-bold text-[#111b21]">{chat.name}</h2>
                      {chat.createdBy === currentUser.uid && (
                        <button onClick={() => setIsEditingName(true)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-gray-500 mt-1 uppercase tracking-widest font-bold">Group • {chat.participants.length} Members</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#00a884] uppercase tracking-wider">Members</h3>
                  <button 
                    onClick={() => setSearchingMembers(true)}
                    className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Member
                  </button>
                </div>

                {searchingMembers || memberSearchTerm ? (
                  <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text" 
                        value={memberSearchTerm}
                        onChange={(e) => setMemberSearchTerm(e.target.value)}
                        onKeyUp={(e) => e.key === 'Enter' && searchNewMembers()}
                        placeholder="Search for users to add..."
                        className="w-full bg-gray-50 border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#00a884] outline-none"
                      />
                      <button 
                        onClick={searchNewMembers} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#00a884]"
                      >
                        Search
                      </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {memberSearchResults.map((u) => (
                        <div key={u.uid} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} className="w-8 h-8 rounded-full" alt="" />
                            <span className="text-sm font-medium">{u.displayName}</span>
                          </div>
                          <button 
                            onClick={() => addParticipant(u)}
                            className="text-xs font-bold text-[#00a884] border border-[#00a884] px-3 py-1 rounded-full hover:bg-[#00a884] hover:text-white transition-all underline decoration-transparent hover:no-underline"
                          >
                            Add
                          </button>
                        </div>
                      ))}
                      {memberSearchTerm && memberSearchResults.length === 0 && !searchingMembers && (
                        <p className="text-center text-xs text-gray-400 py-2">No users found or already in group</p>
                      )}
                    </div>
                    {memberSearchTerm && (
                      <button 
                        onClick={() => { setMemberSearchTerm(''); setMemberSearchResults([]); }}
                        className="w-full text-xs font-bold text-gray-400 py-2"
                      >
                        Cancel Search
                      </button>
                    )}
                  </div>
                ) : null}

                <div className="bg-white rounded-xl shadow-sm divide-y">
                  {/* Note: This assumes we have user profiles for all participants cached or fetched. 
                      For real-time consistency, we might need a useGroupMembers hook.
                      For now, we'll show just the UIDs or a simple list. */}
                  {chat.participants.map((uid: string) => (
                    <div key={uid} className="flex items-center gap-3 p-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-[#111b21]">User {uid.slice(0, 5)}...</p>
                        {uid === chat.createdBy && <span className="text-[10px] bg-[#dcf8c6] text-[#075e54] font-bold px-2 py-0.5 rounded-full uppercase">Creator</span>}
                        {uid === currentUser.uid && <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full uppercase ml-1">You</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
