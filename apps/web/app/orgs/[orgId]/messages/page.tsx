'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ConversationSummary {
  id: string;
  orgId: string;
  type: string;
  otherParticipant?: {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
    presence?: string;
  };
  lastMessage?: {
    id: string;
    senderId: string;
    contentCiphertext: string;
    contentType: string;
    createdAt: string;
  };
  unreadCount: number;
  updatedAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  contentCiphertext: string;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  reactions?: Array<{ id: string; emoji: string; userId: string }>;
  receipts?: Array<{ id: string; status: 'delivered' | 'read'; userId: string }>;
  createdAt: string;
}

interface OrgMember {
  userId: string;
  email: string;
  role: string;
  title?: string;
}

export default function MessagesPage() {
  const { orgId } = useParams() as { orgId: string };
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('zoqo_access_token') : null;

  const authHeaders = {
    Authorization: `Bearer ${token || ''}`,
    'X-Org-Id': orgId,
    'Content-Type': 'application/json',
  };

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    // Fetch active user profile and conversations
    Promise.all([
      fetch('/v1/messenger/conversations', { headers: authHeaders }).then((r) => r.json()),
      fetch(`/v1/orgs/${orgId}/members`, { headers: authHeaders }).then((r) => r.json()),
      fetch(`/v1/orgs/${orgId}/profile`, { headers: authHeaders }).then((r) => r.json()),
    ])
      .then(([convRes, memRes, profRes]) => {
        if (convRes.success) {
          setConversations(convRes.data);
          if (convRes.data.length > 0 && !activeConvId) {
            setActiveConvId(convRes.data[0].id);
          }
        }
        if (memRes.success) setMembers(memRes.data);
        if (profRes.success && profRes.data.userId) setCurrentUserId(profRes.data.userId);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token]);

  useEffect(() => {
    if (!activeConvId) return;

    fetch(`/v1/messenger/conversations/${activeConvId}/messages`, { headers: authHeaders })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setMessages(res.data);
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      })
      .catch(console.error);
  }, [activeConvId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeConvId || sending) return;

    setSending(true);
    // Symmetric envelope simulation (base64 encoded ciphertext for MVP)
    const contentCiphertext = btoa(unescape(encodeURIComponent(text)));

    try {
      const res = await fetch(`/v1/messenger/conversations/${activeConvId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          contentCiphertext,
          envelopeIv: 'mock_iv',
          envelopeTag: 'mock_tag',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, data.data]);
        setText('');
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleStartDm = async (recipientId: string) => {
    try {
      const res = await fetch('/v1/messenger/conversations/dm', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ recipientId }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewModal(false);
        setActiveConvId(data.data.id);
        // Refresh conversations
        const listRes = await fetch('/v1/messenger/conversations', { headers: authHeaders }).then((r) => r.json());
        if (listRes.success) setConversations(listRes.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const decodeCiphertext = (cipher: string, isDeleted: boolean) => {
    if (isDeleted) return 'This message was deleted';
    try {
      return decodeURIComponent(escape(atob(cipher)));
    } catch {
      return cipher;
    }
  };

  const handleReaction = async (msgId: string, emoji: string) => {
    try {
      await fetch(`/v1/messenger/messages/${msgId}/reactions`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ emoji }),
      });
      // Refresh messages
      const res = await fetch(`/v1/messenger/conversations/${activeConvId}/messages`, { headers: authHeaders }).then((r) => r.json());
      if (res.success) setMessages(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f8fafc' }}>
      {/* Sidebar Navigation */}
      <div style={{ width: '320px', borderRight: '1px solid #e2e8f0', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Direct Messages</h2>
            <Link href={`/orgs/${orgId}`} style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none' }}>
              ← Back to Org
            </Link>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            + New DM
          </button>
        </div>

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
              No direct messages yet. Click "+ New DM" to start communicating.
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              const peer = conv.otherParticipant;
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: isActive ? '#f0f9ff' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  {/* Avatar & Presence */}
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '15px',
                      }}
                    >
                      {peer?.displayName ? peer.displayName[0].toUpperCase() : 'U'}
                    </div>
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '0',
                        right: '0',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: peer?.presence === 'online' ? '#22c55e' : peer?.presence === 'dnd' ? '#ef4444' : '#94a3b8',
                        border: '2px solid #ffffff',
                      }}
                    />
                  </div>

                  {/* Summary */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                        {peer?.displayName || `User ${peer?.userId?.slice(0, 8)}`}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span
                          style={{
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            borderRadius: '10px',
                            padding: '2px 6px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '2px',
                        }}
                      >
                        {decodeCiphertext(conv.lastMessage.contentCiphertext, false)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Conversation Chat View */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeConvId ? (
          <>
            {/* Chat Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Direct Conversation</h3>
                <span style={{ fontSize: '12px', color: '#16a34a' }}>● End-to-End Encrypted</span>
              </div>
            </div>

            {/* Messages Stream */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.map((msg) => {
                const isMine = msg.senderId === currentUserId;
                const isRead = msg.receipts?.some((r) => r.status === 'read');
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isMine ? 'flex-end' : 'flex-start',
                      maxWidth: '65%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMine ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '12px',
                        backgroundColor: isMine ? '#0284c7' : '#ffffff',
                        color: isMine ? '#ffffff' : '#1e293b',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        border: isMine ? 'none' : '1px solid #e2e8f0',
                        fontSize: '14px',
                        lineHeight: 1.4,
                      }}
                    >
                      {msg.isDeleted ? (
                        <i style={{ color: isMine ? '#e0f2fe' : '#94a3b8' }}>This message was deleted</i>
                      ) : (
                        decodeCiphertext(msg.contentCiphertext, false)
                      )}
                      {msg.isEdited && !msg.isDeleted && (
                        <span style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.7 }}>(edited)</span>
                      )}
                    </div>

                    {/* Reactions & Receipts */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMine && <span>{isRead ? '✓✓ (Read)' : '✓✓ (Delivered)'}</span>}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {msg.reactions.map((r) => (
                            <span key={r.id} style={{ backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '1px 4px' }}>
                              {r.emoji}
                            </span>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => handleReaction(msg.id, '👍')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                        title="React with 👍"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => handleReaction(msg.id, '❤️')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                        title="React with ❤️"
                      >
                        ❤️
                      </button>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <form onSubmit={handleSendMessage} style={{ padding: '16px 24px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="Type an encrypted message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: sending || !text.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  opacity: sending || !text.trim() ? 0.6 : 1,
                }}
              >
                {sending ? 'Encrypting...' : 'Send'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            Select a conversation or start a new direct message
          </div>
        )}
      </div>

      {/* New DM Modal */}
      {showNewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', width: '420px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Start a Direct Message</h3>
              <button onClick={() => setShowNewModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '18px' }}>
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {members.filter((m) => m.userId !== currentUserId).map((member) => (
                <div
                  key={member.userId}
                  onClick={() => handleStartDm(member.userId)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#f0f9ff')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{member.email}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{member.role}</div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 600 }}>Message →</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
