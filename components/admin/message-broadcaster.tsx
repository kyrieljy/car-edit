
'use client';
import { StyledSelect } from "@/components/ui/styled-select";


import { useState } from 'react';
import { Send, Users, Tag, Crown, UserCheck } from 'lucide-react';
import type { BroadcastTarget } from '@/lib/types';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessageBroadcaster() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<BroadcastTarget>('all');
  const [planId, setPlanId] = useState('free');
  const [tag, setTag] = useState('');
  const [userIds, setUserIds] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number } | null>(null);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required');
      return;
    }
    setSending(true);
    setError('');
    setResult(null);

    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        target,
        ...(target === 'plan' ? { planId } : {}),
        ...(target === 'tag' ? { tag: tag.trim() } : {}),
        ...(target === 'users' ? { userIds: userIds.split(',').map((id) => id.trim()).filter(Boolean) } : {}),
      };

      const res = await fetch('/api/admin/messages/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json() as { sent: number };
        setResult(data);
        setTitle('');
        setBody('');
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error || 'Send failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="analytics-page">
      <div className="analytics-chart-card">
        <div className="analytics-chart-header">
          <h3>Broadcast Message</h3>
        </div>
        <div className="analytics-chart-body" style={{ padding: '24px' }}>
          <div className="broadcast-form">
            <label className="broadcast-label">
              <span>Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Message title"
                className="broadcast-input"
              />
            </label>

            <label className="broadcast-label">
              <span>Body</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message content"
                rows={4}
                className="broadcast-textarea"
              />
            </label>

            <div className="broadcast-target">
              <span>Target</span>
              <div className="analytics-range-selector">
                <button className={target === 'all' ? 'selected' : ''} onClick={() => setTarget('all')}>
                  <Users size={14} /> All
                </button>
                <button className={target === 'plan' ? 'selected' : ''} onClick={() => setTarget('plan')}>
                  <Crown size={14} /> Plan
                </button>
                <button className={target === 'tag' ? 'selected' : ''} onClick={() => setTarget('tag')}>
                  <Tag size={14} /> Tag
                </button>
                <button className={target === 'users' ? 'selected' : ''} onClick={() => setTarget('users')}>
                  <UserCheck size={14} /> Users
                </button>
              </div>
            </div>

            {target === 'plan' && (
              <label className="broadcast-label">
                <span>Plan ID</span>
                <StyledSelect value={planId} onChange={(e) => setPlanId(e.target.value)} className="broadcast-input">
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="max">Max</option>
                </StyledSelect>
              </label>
            )}

            {target === 'tag' && (
              <label className="broadcast-label">
                <span>Tag</span>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="e.g. vip"
                  className="broadcast-input"
                />
              </label>
            )}

            {target === 'users' && (
              <label className="broadcast-label">
                <span>User IDs (comma separated)</span>
                <textarea
                  value={userIds}
                  onChange={(e) => setUserIds(e.target.value)}
                  placeholder="user_1, user_2, ..."
                  rows={2}
                  className="broadcast-textarea"
                />
              </label>
            )}

            {error && <div className="broadcast-error">{error}</div>}
            {result && <div className="broadcast-success">Sent to {result.sent} users</div>}

            <button
              className="broadcast-send-btn"
              onClick={handleSend}
              disabled={sending}
            >
              <Send size={16} />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
