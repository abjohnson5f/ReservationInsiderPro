import React, { useEffect } from 'react';
import { Info, X, AlertTriangle } from 'lucide-react';

interface NotificationProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  type?: 'info' | 'warning';
}

const Notification: React.FC<NotificationProps> = ({ message, isVisible, onClose, type = 'info' }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 5000); // Auto dismiss after 5s
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-slideUp">
      <div className={`
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md min-w-[320px] max-w-md
        ${type === 'warning' 
          ? 'bg-slate-900/95 border-amber-500/50 text-amber-50' 
          : 'bg-slate-900/95 border-slate-700 text-slate-200'}
      `}>
        {type === 'warning' ? (
             <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        ) : (
             <Info className="w-5 h-5 text-blue-400 shrink-0" />
        )}
        
        <p className="text-sm font-medium flex-grow leading-tight">{message}</p>
        
        <button 
          onClick={onClose} 
          className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-500 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Notification;