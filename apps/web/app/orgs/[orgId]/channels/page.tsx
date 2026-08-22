'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ChannelSummary {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  topic?: string;
  description?: string;
  type: 'public' | 'private' | 'announcement' | 'shared';
  memberCount: number;
  isMember: boolean;
  archivedAt?: string;
}

interface ChannelMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  content: string;
  threadId?: string;
  replyCount?: number;
  isBroadcast?: boolean;
  attachments?: Array<{
    id: string;
    filename: string;
    sizeBytes: number;
    mimeType: string;
    scanStatus: 'pending' | 'clean' | 'infected';
    url?: string;
  }>;
  reactions?: Array<{ emoji: string; count: number; userIds: string[] }>;
  createdAt: string;
}

export default function ChannelsPage() {
  const { orgId } = useParams() as { orgId: string };
  const router = useRouter();
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChannelSummary | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [threadRoot, setThreadRoot] = useState<ChannelMessage | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChannelMessage[]>([]);
  const [text, setText] = useState('');
  const [threadText, setThreadText] = useState('');
  const [broadcastThread, setBroadcastThread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTopic, setNewChannelTopic] = useState('');
  const [newChannelType, setNewChannelType] = useState<'public' | 'private' | 'announcement'>('public');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('zoqo_access_token') : null;

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadChannels();
  }, [orgId, token]);

  const loadChannels = async () => {
    try {
      const res = await fetch(`http://localhost:3000/v1/channels`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Org-Id': orgId },
      });
      const data = await res.json();
      if (data.success) {
        setChannels(data.data);
        if (data.data.length > 0 && !activeChannel) {
          selectChannel(data.data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectChannel = async (channel: ChannelSummary) => {
    setActiveChannel(channel);
    setThreadRoot(null);
    try {
      const res = await fetch(`http://localhost:3000/v1/channels/${channel.slug}/messages`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Org-Id': orgId },
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openThread = async (msg: ChannelMessage) => {
    setThreadRoot(msg);
    try {
      const res = await fetch(`http://localhost:3000/v1/channels/messages/${msg.id}/thread`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Org-Id': orgId },
      });
      const data = await res.json();
      if (data.success) {
        setThreadMessages(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeChannel) return;

    const content = text;
    setText('');

    try {
      const res = await fetch(`http://localhost:3000/v1/channels/${activeChannel.slug}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Org-Id': orgId,
        },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, data.data]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendThreadMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadText.trim() || !threadRoot || !activeChannel) return;

    const content = threadText;
    setThreadText('');

    try {
      const res = await fetch(`http://localhost:3000/v1/channels/${activeChannel.slug}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Org-Id': orgId,
        },
        body: JSON.stringify({
          content,
          threadId: threadRoot.id,
          isBroadcast: broadcastThread,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setThreadMessages((prev) => [...prev, data.data]);
        if (broadcastThread) {
          setMessages((prev) => [...prev, data.data]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannel) return;
    setUploading(true);

    try {
      const urlRes = await fetch(`http://localhost:3000/v1/media/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Org-Id': orgId,
        },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });
      const urlData = await urlRes.json();
      if (!urlData.success) return;

      const { fileId, uploadUrl } = urlData.data;

      // Confirm upload and trigger anti-malware scan
      const confRes = await fetch(`http://localhost:3000/v1/media/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Org-Id': orgId,
        },
        body: JSON.stringify({ fileId }),
      });
      const confData = await confRes.json();

      // Post message with confirmed file attachment
      await fetch(`http://localhost:3000/v1/channels/${activeChannel.slug}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Org-Id': orgId,
        },
        body: JSON.stringify({
          content: `Shared file: ${file.name}`,
          attachmentFileIds: [fileId],
        }),
      });

      selectChannel(activeChannel);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    try {
      const res = await fetch(`http://localhost:3000/v1/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Org-Id': orgId,
        },
        body: JSON.stringify({
          name: newChannelName,
          topic: newChannelTopic,
          type: newChannelType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewChannelName('');
        setNewChannelTopic('');
        loadChannels();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderContentWithMentions = (content: string) => {
    const parts = content.split(/(@\w+|@here|@channel)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="bg-indigo-900/60 text-indigo-300 font-semibold px-1.5 py-0.5 rounded text-sm">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading Zoqo Channels...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      {/* Channels Sidebar */}
      <div className="w-64 border-r border-slate-800 bg-slate-900/90 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg text-indigo-400"># Channels</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            title="Create Channel"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 py-1">Channels</div>
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => selectChannel(ch)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm transition ${
                activeChannel?.id === ch.id
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <span className="text-slate-400">
                  {ch.type === 'private' ? '🔒' : ch.type === 'announcement' ? '📢' : ch.type === 'shared' ? '🌐' : '#'}
                </span>
                <span className="truncate">{ch.name}</span>
              </div>
              {ch.type === 'shared' && (
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1 rounded">
                  B2B
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <Link href={`/orgs/${orgId}/messages`} className="hover:text-indigo-400">
            💬 Direct Messages
          </Link>
          <Link href={`/orgs/${orgId}/settings`} className="hover:text-indigo-400">
            ⚙️ Settings
          </Link>
        </div>
      </div>

      {/* Main Channel Message Feed */}
      <div className="flex-1 flex flex-col bg-slate-950">
        {activeChannel ? (
          <>
            {/* Channel Header */}
            <div className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/40">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400 text-lg">
                    {activeChannel.type === 'private'
                      ? '🔒'
                      : activeChannel.type === 'announcement'
                      ? '📢'
                      : activeChannel.type === 'shared'
                      ? '🌐'
                      : '#'}
                  </span>
                  <h1 className="font-bold text-slate-100">{activeChannel.name}</h1>
                  {activeChannel.type === 'shared' && (
                    <span className="text-xs bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded-full font-medium">
                      Cross-Org Shared
                    </span>
                  )}
                </div>
                {activeChannel.topic && <p className="text-xs text-slate-400">{activeChannel.topic}</p>}
              </div>
              <div className="text-xs text-slate-500">
                {activeChannel.memberCount || 1} {activeChannel.memberCount === 1 ? 'member' : 'members'}
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <p className="text-sm">This is the start of #{activeChannel.name}.</p>
                  <p className="text-xs mt-1">Send a message or @mention colleagues to begin collaboration.</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="group flex space-x-3 p-2 rounded-lg hover:bg-slate-900/50 transition">
                    <div className="w-8 h-8 rounded-full bg-indigo-800 flex items-center justify-center font-bold text-xs text-indigo-200">
                      {m.senderName?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline space-x-2">
                        <span className="font-semibold text-sm text-slate-200">{m.senderName || 'Member'}</span>
                        <span className="text-[11px] text-slate-500">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {m.isBroadcast && (
                          <span className="text-[10px] text-indigo-400 bg-indigo-950/60 px-1.5 rounded">
                            Thread broadcast
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-slate-300 leading-relaxed">
                        {renderContentWithMentions(m.content)}
                      </div>

                      {/* Attachments */}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {m.attachments.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center space-x-2 bg-slate-900 border border-slate-800 p-2 rounded-md text-xs"
                            >
                              <span>📎 {att.filename}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                  att.scanStatus === 'clean'
                                    ? 'bg-emerald-950 text-emerald-400'
                                    : att.scanStatus === 'infected'
                                    ? 'bg-rose-950 text-rose-400'
                                    : 'bg-amber-950 text-amber-400'
                                }`}
                              >
                                {att.scanStatus.toUpperCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Thread Replies Button */}
                      <div className="mt-2 flex items-center space-x-3 text-xs text-slate-400">
                        <button
                          onClick={() => openThread(m)}
                          className="hover:text-indigo-300 font-medium flex items-center space-x-1"
                        >
                          <span>💬</span>
                          <span>
                            {m.replyCount && m.replyCount > 0
                              ? `${m.replyCount} ${m.replyCount === 1 ? 'reply' : 'replies'}`
                              : 'Reply in thread'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input Box */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/30">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  id="media-file-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Upload attachment (S3/MinIO & ClamAV scan)"
                >
                  {uploading ? '⏳' : '📎'}
                </button>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Message #${activeChannel.name} (use @name, @channel, @here)`}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!text.trim()}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Select or create a channel to view conversation.
          </div>
        )}
      </div>

      {/* Threads Side Drawer */}
      {threadRoot && (
        <div className="w-80 border-l border-slate-800 bg-slate-900/95 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="h-14 border-b border-slate-800 px-4 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-200">Thread Discussion</h2>
            <button
              onClick={() => setThreadRoot(null)}
              className="text-slate-400 hover:text-slate-200 text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Root Message in Drawer */}
            <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <span className="font-bold text-xs text-indigo-400">{threadRoot.senderName || 'Member'}</span>
              <p className="mt-1 text-sm text-slate-200">{threadRoot.content}</p>
            </div>

            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Replies</div>

            {/* Replies List */}
            {threadMessages.map((tMsg) => (
              <div key={tMsg.id} className="p-2.5 rounded-md bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-xs text-slate-300">{tMsg.senderName || 'Member'}</span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(tMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-200">{renderContentWithMentions(tMsg.content)}</p>
              </div>
            ))}
          </div>

          {/* Thread Reply Input */}
          <div className="p-3 border-t border-slate-800 bg-slate-900">
            <form onSubmit={handleSendThreadMessage} className="space-y-2">
              <input
                type="text"
                value={threadText}
                onChange={(e) => setThreadText(e.target.value)}
                placeholder="Reply in thread..."
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-1.5 text-[11px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={broadcastThread}
                    onChange={(e) => setBroadcastThread(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Also send to channel</span>
                </label>
                <button
                  type="submit"
                  disabled={!threadText.trim()}
                  className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold"
                >
                  Reply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Create New Channel</h3>
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Channel Name</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. project-apollo"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Topic / Description</label>
                <input
                  type="text"
                  value={newChannelTopic}
                  onChange={(e) => setNewChannelTopic(e.target.value)}
                  placeholder="e.g. Apollo mission operations & metrics"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Channel Visibility</label>
                <select
                  value={newChannelType}
                  onChange={(e) => setNewChannelType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="public">Public - Anyone in the org can join</option>
                  <option value="private">Private - Only invited members</option>
                  <option value="announcement">Announcement - Only Admins/Managers can post</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
