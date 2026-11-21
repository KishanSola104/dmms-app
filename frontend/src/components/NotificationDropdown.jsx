import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Clock, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/common/notifications');
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.warn('[Notifications] Failed to fetch:', err.message);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.put(`/common/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[Notifications] Error marking read:', err.message);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/common/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[Notifications] Error marking all read:', err.message);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />;
      case 'warning':
      case 'alert':
        return <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in duration-150">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-800 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No notifications yet.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item._id}
                  className={`p-3.5 flex items-start space-x-3 transition-colors ${
                    item.isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/50 hover:bg-blue-50'
                  }`}
                >
                  {getTypeIcon(item.type)}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${item.isRead ? 'text-slate-700' : 'text-slate-900 font-bold'}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">
                      {item.message}
                    </p>
                    <div className="flex items-center space-x-2 mt-1.5 text-[10px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  {!item.isRead && (
                    <button
                      onClick={(e) => markAsRead(item._id, e)}
                      title="Mark as read"
                      className="text-slate-400 hover:text-blue-600 p-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
