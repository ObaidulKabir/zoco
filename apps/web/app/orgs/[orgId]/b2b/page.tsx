'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface B2bConnection {
  id: string;
  senderOrgId: string;
  senderUserId: string;
  receiverOrgId: string;
  introMessage: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  partnerOrgName?: string;
}

export default function B2bConnectionsPage() {
  const { orgId } = useParams() as { orgId: string };
  const router = useRouter();
  const [connections, setConnections] = useState<B2bConnection[]>([]);
  const [activeTab, setActiveTab] = useState<'connected' | 'incoming' | 'outgoing' | 'blocked'>('connected');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Send request modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [targetOrgId, setTargetOrgId] = useState('');
  const [introMessage, setIntroMessage] = useState('');
  const [sending, setSending] = useState(false);

  const fetchConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/v1/b2b/connections`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-org-id': orgId,
        },
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setConnections(data.data);
      } else {
        setError(data.error?.message || 'Failed to load connections');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [orgId]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetOrgId.trim() || !introMessage.trim()) return;

    setSending(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/v1/b2b/connections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-org-id': orgId,
        },
        body: JSON.stringify({
          receiverOrgId: targetOrgId.trim(),
          introMessage: introMessage.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('Connection request sent successfully!');
        setShowSendModal(false);
        setTargetOrgId('');
        setIntroMessage('');
        fetchConnections();
      } else {
        setError(data.error?.message || data.message || 'Failed to send request');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async (connectionId: string) => {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/v1/b2b/connections/${connectionId}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-org-id': orgId,
        },
      });
      if (res.ok) {
        setSuccessMessage('Connection accepted!');
        fetchConnections();
      } else {
        const data = await res.json();
        setError(data.error?.message || 'Failed to accept connection');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    }
  };

  const handleReject = async (connectionId: string) => {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/v1/b2b/connections/${connectionId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-org-id': orgId,
        },
      });
      if (res.ok) {
        setSuccessMessage('Connection request rejected');
        fetchConnections();
      } else {
        const data = await res.json();
        setError(data.error?.message || 'Failed to reject connection');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    }
  };

  const handleBlock = async (connectionId: string) => {
    if (!confirm('Are you sure you want to block this organization? They will not be able to send you future connection requests.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/v1/b2b/connections/${connectionId}/block`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-org-id': orgId,
        },
      });
      if (res.ok) {
        setSuccessMessage('Organization blocked');
        fetchConnections();
      } else {
        const data = await res.json();
        setError(data.error?.message || 'Failed to block organization');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect from this partner organization? Active cross-org chats will be archived.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/v1/b2b/connections/${connectionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-org-id': orgId,
        },
      });
      if (res.ok) {
        setSuccessMessage('Partner organization disconnected');
        fetchConnections();
      } else {
        const data = await res.json();
        setError(data.error?.message || 'Failed to disconnect');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    }
  };

  const connectedList = connections.filter((c) => c.status === 'accepted');
  const incomingList = connections.filter((c) => c.status === 'pending' && c.receiverOrgId === orgId);
  const outgoingList = connections.filter((c) => c.status === 'pending' && c.senderOrgId === orgId);
  const blockedList = connections.filter((c) => c.status === 'blocked');

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Top Bar */}
      <header className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link
            href={`/orgs/${orgId}/channels`}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
          >
            &larr; Back to Channels
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <h1 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
            <span>B2B Partner Network</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              External Connect
            </span>
          </h1>
        </div>

        <button
          onClick={() => setShowSendModal(true)}
          className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition shadow-sm flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Connect New Partner
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 max-w-5xl w-full mx-auto space-y-6">
        {/* Banner Alert */}
        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-200 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">&times;</button>
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-lg text-xs text-emerald-200 flex items-center justify-between">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">&times;</button>
          </div>
        )}

        {/* Feature Overview Card */}
        <div className="bg-gradient-to-r from-emerald-950/30 to-slate-900 border border-emerald-900/30 rounded-xl p-5 flex items-start justify-between">
          <div className="space-y-1 max-w-2xl">
            <h2 className="text-sm font-semibold text-slate-100">Zero Vendor Lock-in B2B Collaboration</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Connect directly with verified external partner organizations. Exchange end-to-end encrypted direct messages
              and collaborate in shared external channels while keeping internal organization spaces completely isolated.
            </p>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-[11px] text-slate-400">Free Tier Limit</span>
            <span className="text-xs font-semibold text-emerald-400">10 requests / day</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 gap-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('connected')}
            className={`pb-2.5 transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === 'connected'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Connected Partners
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {connectedList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('incoming')}
            className={`pb-2.5 transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === 'incoming'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Incoming Requests
            {incomingList.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-semibold">
                {incomingList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('outgoing')}
            className={`pb-2.5 transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === 'outgoing'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Outgoing Requests
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {outgoingList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('blocked')}
            className={`pb-2.5 transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === 'blocked'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Blocked
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {blockedList.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-500">Loading partner connections...</div>
        ) : (
          <div className="space-y-3">
            {/* Connected Partners */}
            {activeTab === 'connected' && (
              connectedList.length === 0 ? (
                <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="text-xs font-medium text-slate-300">No active partner connections yet</div>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Send a connection request to an external vendor, customer, or partner to start cross-organization communication.
                  </p>
                  <button
                    onClick={() => setShowSendModal(true)}
                    className="mt-2 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition"
                  >
                    Send First Connection Request
                  </button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {connectedList.map((conn) => {
                    const partnerOrgId = conn.senderOrgId === orgId ? conn.receiverOrgId : conn.senderOrgId;
                    return (
                      <div
                        key={conn.id}
                        className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400 font-semibold text-sm">
                            {partnerOrgId.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-semibold text-slate-100">
                                Organization: {partnerOrgId}
                              </h3>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                External Partner
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              &ldquo;{conn.introMessage}&rdquo;
                            </p>
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              Connected on {new Date(conn.acceptedAt || conn.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link
                            href={`/orgs/${orgId}/messenger`}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 transition"
                          >
                            Send Direct Message
                          </Link>
                          <button
                            onClick={() => handleDisconnect(conn.id)}
                            className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/50 text-[11px] font-medium text-red-300 border border-red-900/40 transition"
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Incoming Requests */}
            {activeTab === 'incoming' && (
              incomingList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">No incoming connection requests</div>
              ) : (
                <div className="grid gap-3">
                  {incomingList.map((conn) => (
                    <div
                      key={conn.id}
                      className="bg-slate-900/70 border border-amber-900/30 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-950/50 border border-amber-800/40 flex items-center justify-center text-amber-400 font-semibold text-sm">
                          IN
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-semibold text-slate-100">
                              Sender Org: {conn.senderOrgId}
                            </h3>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                              Pending Review
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1 bg-slate-950/60 px-2.5 py-1 rounded border border-slate-800/60 max-w-lg">
                            &ldquo;{conn.introMessage}&rdquo;
                          </p>
                          <span className="text-[10px] text-slate-500 block mt-1">
                            Received on {new Date(conn.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAccept(conn.id)}
                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] font-medium text-white transition"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleReject(conn.id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleBlock(conn.id)}
                          className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/50 text-[11px] font-medium text-red-300 border border-red-900/40 transition"
                        >
                          Block
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Outgoing Requests */}
            {activeTab === 'outgoing' && (
              outgoingList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">No outgoing connection requests</div>
              ) : (
                <div className="grid gap-3">
                  {outgoingList.map((conn) => (
                    <div
                      key={conn.id}
                      className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 font-semibold text-sm">
                          OUT
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-semibold text-slate-100">
                              Recipient Org: {conn.receiverOrgId}
                            </h3>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-medium">
                              Awaiting Approval
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                            &ldquo;{conn.introMessage}&rdquo;
                          </p>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Sent on {new Date(conn.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDisconnect(conn.id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-400 transition"
                      >
                        Cancel Request
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Blocked Organizations */}
            {activeTab === 'blocked' && (
              blockedList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">No blocked organizations</div>
              ) : (
                <div className="grid gap-3">
                  {blockedList.map((conn) => (
                    <div
                      key={conn.id}
                      className="bg-slate-900/70 border border-red-950/40 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-red-950/50 border border-red-900/40 flex items-center justify-center text-red-400 font-semibold text-sm">
                          &times;
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold text-slate-100">
                            Blocked Organization: {conn.receiverOrgId === orgId ? conn.senderOrgId : conn.receiverOrgId}
                          </h3>
                          <span className="text-[10px] text-slate-500">
                            Blocked on {new Date(conn.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDisconnect(conn.id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Send Connection Request Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-slate-100">Send B2B Connection Request</h2>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSendRequest} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Target Organization ID / Slug</label>
                <input
                  type="text"
                  placeholder="e.g. tokyo-corp or org UUID"
                  value={targetOrgId}
                  onChange={(e) => setTargetOrgId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-slate-300">Introduction Message</label>
                  <span className="text-[10px] text-slate-500">{introMessage.length}/500</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Explain why your organizations should connect..."
                  value={introMessage}
                  onChange={(e) => setIntroMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                  required
                />
              </div>

              <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-lg text-[11px] text-slate-400">
                <span className="text-emerald-400 font-medium">Free Tier Notice:</span> Organizations can send up to 10 connection requests per day. Partner organizations must accept before direct messaging is enabled.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending || !targetOrgId.trim() || !introMessage.trim()}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-medium text-white transition flex items-center gap-1.5"
                >
                  {sending ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
