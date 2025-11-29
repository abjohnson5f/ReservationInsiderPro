/**
 * Notification Settings Component
 * 
 * Manage Telegram and other notification settings
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Send,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MessageSquare,
  Smartphone,
  Mail,
  Settings,
  Play,
  Square,
  Zap,
} from 'lucide-react';

const API_BASE = 'http://localhost:3000/api/notifications';

interface NotificationStatus {
  telegram: {
    botToken: boolean;
    chatId: boolean;
    polling: boolean;
    ready: boolean;
  };
  services: {
    telegram: boolean;
    email: boolean;
    sms: boolean;
  };
}

const NotificationSettings: React.FC = () => {
  const [status, setStatus] = useState<NotificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testMessage, setTestMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      if (data.success) {
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch notification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Test notification sent successfully!');
      } else {
        alert('Failed to send test notification: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to send test:', error);
      alert('Failed to send test notification');
    } finally {
      setSending(false);
    }
  };

  const sendCustomMessage = async () => {
    if (!testMessage.trim()) return;
    
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/telegram/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage }),
      });
      const data = await res.json();
      if (data.success) {
        setTestMessage('');
        alert('Message sent!');
      } else {
        alert('Failed: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to send:', error);
    } finally {
      setSending(false);
    }
  };

  const togglePolling = async (start: boolean) => {
    try {
      await fetch(`${API_BASE}/polling/${start ? 'start' : 'stop'}`, { method: 'POST' });
      fetchStatus();
    } catch (error) {
      console.error('Failed to toggle polling:', error);
    }
  };

  const sendDailySummary = async () => {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/daily-summary`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Daily summary sent!');
      }
    } catch (error) {
      console.error('Failed to send summary:', error);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-8 text-center">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Loading notification settings...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/20 rounded-lg">
            <Bell className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Notification Settings</h3>
            <p className="text-xs text-slate-500">Configure alerts & notifications</p>
          </div>
        </div>
        <button
          onClick={fetchStatus}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Service Status */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: 'Telegram', icon: Send, enabled: status?.services.telegram, color: 'blue' },
            { name: 'Email', icon: Mail, enabled: status?.services.email, color: 'emerald' },
            { name: 'SMS', icon: Smartphone, enabled: status?.services.sms, color: 'amber' },
          ].map(service => (
            <div
              key={service.name}
              className={`p-4 rounded-lg border ${
                service.enabled
                  ? 'bg-slate-800/50 border-slate-700'
                  : 'bg-slate-900/30 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <service.icon className={`w-5 h-5 ${service.enabled ? `text-${service.color}-400` : 'text-slate-600'}`} />
                {service.enabled ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-600" />
                )}
              </div>
              <div className="text-sm font-medium text-white">{service.name}</div>
              <div className="text-xs text-slate-500">
                {service.enabled ? 'Connected' : 'Not configured'}
              </div>
            </div>
          ))}
        </div>

        {/* Telegram Configuration */}
        {status?.telegram && (
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
            <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-400" />
              Telegram Configuration
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Bot Token</span>
                {status.telegram.botToken ? (
                  <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">
                    Configured
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded">
                    Missing
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Chat ID</span>
                {status.telegram.chatId ? (
                  <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">
                    Configured
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded">
                    Missing
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Command Polling</span>
                <div className="flex items-center gap-2">
                  {status.telegram.polling ? (
                    <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded flex items-center gap-1">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-slate-600/20 text-slate-400 rounded">
                      Stopped
                    </span>
                  )}
                  <button
                    onClick={() => togglePolling(!status.telegram.polling)}
                    className={`p-1.5 rounded ${
                      status.telegram.polling
                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    {status.telegram.polling ? (
                      <Square className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            {!status.telegram.ready && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400">
                  <strong>Setup Required:</strong> Add these to your .env file:
                </p>
                <code className="block mt-2 text-xs text-slate-300 bg-slate-900 p-2 rounded">
                  TELEGRAM_BOT_TOKEN=your_bot_token<br />
                  TELEGRAM_CHAT_ID=your_chat_id
                </code>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
          <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Quick Actions
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={sendTestNotification}
              disabled={!status?.telegram.ready || sending}
              className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium"
            >
              <Bell className="w-4 h-4" />
              Send Test
            </button>
            <button
              onClick={sendDailySummary}
              disabled={!status?.telegram.ready || sending}
              className="flex items-center justify-center gap-2 p-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              Daily Summary
            </button>
          </div>
        </div>

        {/* Custom Message */}
        {status?.telegram.ready && (
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
            <h4 className="text-sm font-medium text-white mb-4">Send Custom Message</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
              />
              <button
                onClick={sendCustomMessage}
                disabled={!testMessage.trim() || sending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg text-sm font-medium"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Notification Types */}
        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
          <h4 className="text-sm font-medium text-white mb-4">Notification Types</h4>
          <div className="space-y-2 text-sm">
            {[
              { name: 'Drop Warnings', desc: '5 min & 1 min before reservation drops' },
              { name: 'Acquisition Success', desc: 'When a reservation is acquired' },
              { name: 'Listing Notifications', desc: 'When listed on AppointmentTrader' },
              { name: 'Sale Confirmations', desc: 'When a reservation is sold' },
              { name: 'Transfer Reminders', desc: 'Pending transfer deadlines' },
              { name: 'Daily Summary', desc: 'End of day stats' },
            ].map(type => (
              <div key={type.name} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <div className="text-white">{type.name}</div>
                  <div className="text-xs text-slate-500">{type.desc}</div>
                </div>
                <div className="w-10 h-5 bg-emerald-500/30 rounded-full flex items-center px-1">
                  <div className="w-3 h-3 bg-emerald-400 rounded-full ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;

