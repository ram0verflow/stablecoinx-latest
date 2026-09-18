import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };

export const LoadingSpinner: React.FC<Props> = ({ size = 'md', text }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12">
    <Loader2 className={`${sizes[size]} text-indigo-400 animate-spin`} />
    {text && <p className="text-sm text-slate-500">{text}</p>}
  </div>
);

export const InlineSpinner: React.FC = () => (
  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin inline" />
);
