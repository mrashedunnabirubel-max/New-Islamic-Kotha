
import React from 'react';
import { Message } from '../types';

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl shadow-md relative ${
          isUser
            ? 'bg-emerald-100 text-emerald-950 rounded-tr-none'
            : 'bg-white/95 text-slate-900 rounded-tl-none border border-emerald-50'
        }`}
      >
        <p className="text-[16px] leading-relaxed whitespace-pre-wrap font-medium">{message.text}</p>
        <div className="flex items-center justify-end mt-2 space-x-1">
          <span className="text-[10px] text-slate-500 font-bold opacity-70">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && (
            <i className="fas fa-check-double text-[10px] text-emerald-500"></i>
          )}
        </div>
        
        {/* Decorative tail */}
        <div 
          className={`absolute top-0 w-0 h-0 border-[10px] border-transparent ${
            isUser 
              ? 'right-[-10px] border-t-emerald-100' 
              : 'left-[-10px] border-t-white/95'
          }`}
        />
      </div>
    </div>
  );
};

export default ChatBubble;
