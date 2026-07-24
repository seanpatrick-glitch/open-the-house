import { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, or
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMessageTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function MessagingView({ orgUsers }) {
  const { userProfile } = useAuth();
  const uid   = userProfile?.uid;
  const orgId = userProfile?.orgId;

  const [threads, setThreads]           = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages]         = useState([]);
  const [newMessage, setNewMessage]     = useState('');
  const [showNewThread, setShowNewThread] = useState(false);
  const [newSubject, setNewSubject]     = useState('');
  const [newRecipientUid, setNewRecipientUid] = useState('');
  const [sending, setSending]           = useState(false);
  const [loading, setLoading]           = useState(true);
  const messagesEndRef = useRef(null);

  // Load threads where current user is a participant
  useEffect(() => {
    if (!orgId || !uid) return;

    const qA = query(
      collection(db, 'organizations', orgId, 'threads'),
      where('participantA', '==', uid),
      orderBy('lastMessageAt', 'desc')
    );
    const qB = query(
      collection(db, 'organizations', orgId, 'threads'),
      where('participantB', '==', uid),
      orderBy('lastMessageAt', 'desc')
    );

    const threadMap = {};

    const unsubA = onSnapshot(qA, snap => {
      snap.docs.forEach(d => { threadMap[d.id] = { id: d.id, ...d.data() }; });
      setThreads(Object.values(threadMap).sort((a, b) =>
        (b.lastMessageAt?.toMillis?.() ?? 0) - (a.lastMessageAt?.toMillis?.() ?? 0)
      ));
      setLoading(false);
    });

    const unsubB = onSnapshot(qB, snap => {
      snap.docs.forEach(d => { threadMap[d.id] = { id: d.id, ...d.data() }; });
      setThreads(Object.values(threadMap).sort((a, b) =>
        (b.lastMessageAt?.toMillis?.() ?? 0) - (a.lastMessageAt?.toMillis?.() ?? 0)
      ));
      setLoading(false);
    });

    return () => { unsubA(); unsubB(); };
  }, [orgId, uid]);

  // Load messages for selected thread
  useEffect(() => {
    if (!selectedThread || !orgId) return;
    const q = query(
      collection(db, 'organizations', orgId, 'threads', selectedThread.id, 'messages'),
      orderBy('sentAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    // Mark thread as read
    const readField = selectedThread.participantA === uid ? 'participantARead' : 'participantBRead';
    updateDoc(doc(db, 'organizations', orgId, 'threads', selectedThread.id), {
      [readField]: true,
    }).catch(() => {});

    return () => unsub();
  }, [selectedThread, orgId, uid]);

  async function handleSendMessage() {
    if (!newMessage.trim() || !selectedThread) return;
    setSending(true);
    const body = newMessage.trim();
    setNewMessage('');
    try {
      await addDoc(
        collection(db, 'organizations', orgId, 'threads', selectedThread.id, 'messages'),
        { senderUid: uid, body, sentAt: serverTimestamp(), readAt: null }
      );
      const otherRead = selectedThread.participantA === uid ? 'participantBRead' : 'participantARead';
      const myRead    = selectedThread.participantA === uid ? 'participantARead' : 'participantBRead';
      await updateDoc(doc(db, 'organizations', orgId, 'threads', selectedThread.id), {
        lastMessageAt:      serverTimestamp(),
        lastMessagePreview: body.slice(0, 80),
        [otherRead]:        false,
        [myRead]:           true,
      });
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setSending(false);
    }
  }

  async function handleCreateThread() {
    if (!newSubject.trim() || !newRecipientUid) return;
    setSending(true);
    try {
      const threadRef = await addDoc(
        collection(db, 'organizations', orgId, 'threads'),
        {
          orgId,
          participantA:        uid,
          participantB:        newRecipientUid,
          subject:             newSubject.trim(),
          createdAt:           serverTimestamp(),
          lastMessageAt:       serverTimestamp(),
          lastMessagePreview:  '',
          broadcastId:         null,
          participantARead:    true,
          participantBRead:    false,
        }
      );
      setShowNewThread(false);
      setNewSubject('');
      setNewRecipientUid('');
      // Select the new thread
      setSelectedThread({ id: threadRef.id, participantA: uid, participantB: newRecipientUid, subject: newSubject.trim() });
    } catch (err) {
      console.error('Create thread error:', err);
    } finally {
      setSending(false);
    }
  }

  const getOtherParticipant = (thread) => {
    const otherUid = thread.participantA === uid ? thread.participantB : thread.participantA;
    return orgUsers.find(u => u.uid === otherUid);
  };

  const isUnread = (thread) => {
    if (thread.participantA === uid) return !thread.participantARead;
    return !thread.participantBRead;
  };

  return (
    <div className="flex h-full max-h-[calc(100vh-120px)] bg-white border border-gray-200 rounded-xl overflow-hidden">

      {/* Thread list */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Messages</h2>
          <button
            onClick={() => setShowNewThread(true)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            New
          </button>
        </div>

        {showNewThread && (
          <div className="p-4 border-b border-gray-200 space-y-2 bg-gray-50">
            <select value={newRecipientUid} onChange={e => setNewRecipientUid(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select recipient...</option>
              {orgUsers.filter(u => u.uid !== uid).map(u => (
                <option key={u.uid} value={u.uid}>{u.email}</option>
              ))}
            </select>
            <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)}
              placeholder="Subject"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex gap-2">
              <button onClick={handleCreateThread} disabled={sending || !newSubject.trim() || !newRecipientUid}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-lg transition-colors">
                Start
              </button>
              <button onClick={() => setShowNewThread(false)}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {loading ? (
            <p className="p-4 text-xs text-gray-400">Loading...</p>
          ) : threads.length === 0 ? (
            <p className="p-4 text-xs text-gray-400">No messages yet.</p>
          ) : (
            threads.map(thread => {
              const other   = getOtherParticipant(thread);
              const unread  = isUnread(thread);
              const selected = selectedThread?.id === thread.id;
              return (
                <button key={thread.id} onClick={() => setSelectedThread(thread)}
                  className={`w-full text-left p-4 transition-colors ${selected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs truncate ${unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {other?.email || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400 flex-shrink-0">{formatTime(thread.lastMessageAt)}</p>
                  </div>
                  <p className={`text-xs mt-0.5 truncate ${unread ? 'text-gray-700' : 'text-gray-400'}`}>
                    {thread.subject}
                  </p>
                  {thread.lastMessagePreview && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{thread.lastMessagePreview}</p>
                  )}
                  {unread && <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Message thread */}
      {selectedThread ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-900">{selectedThread.subject}</p>
            <p className="text-xs text-gray-400">
              {getOtherParticipant(selectedThread)?.email || 'Unknown'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => {
              const isMine = msg.senderUid === uid;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-xl px-3 py-2 ${isMine ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                    <p className="text-sm leading-relaxed">{msg.body}</p>
                    <p className={`text-xs mt-1 ${isMine ? 'text-indigo-200' : 'text-gray-400'}`}>
                      {formatMessageTime(msg.sentAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
                placeholder="Type a message..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400">Select a conversation.</p>
        </div>
      )}
    </div>
  );
}
