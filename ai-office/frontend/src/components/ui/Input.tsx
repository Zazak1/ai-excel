import { cn } from '../../lib/utils';

import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
}

export const Input = ({ icon, className, ...props }: InputProps) => {
  return (
    <div className="relative w-full">
      {icon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          {icon}
        </div>
      )}
      <input
        className={cn(
          'w-full bg-slate-50 border border-slate-200 rounded-lg text-sm',
          'focus:ring-2 focus:ring-[#1337ec] focus:border-[#1337ec] focus:bg-white',
          'placeholder:text-slate-400 transition-colors',
          icon ? 'pl-10 pr-4 py-2' : 'px-4 py-2',
          className
        )}
        {...props}
      />
    </div>
  );
};
