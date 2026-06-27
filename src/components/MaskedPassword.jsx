import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { env } from '../lib/env.js';

export default function MaskedPassword({ value, className = '' }) {
  const [visible, setVisible] = useState(false);
  const canReveal = env.showPasswordsInUi || env.isDev;

  if (!value) return <span className={className}>—</span>;
  if (!canReveal) return <span className={className}>••••••••</span>;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="font-mono text-xs">{visible ? value : '••••••••'}</span>
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
}
