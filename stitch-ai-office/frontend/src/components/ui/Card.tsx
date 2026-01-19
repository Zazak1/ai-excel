import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card = ({ children, className, hover = false }: CardProps) => {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200',
        hover && 'hover:border-blue-300 hover:shadow-lg hover:shadow-blue-50 transition-all cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className }: { children: ReactNode; className?: string }) => {
  return <div className={cn('p-5', className)}>{children}</div>;
};

export const CardContent = ({ children, className }: { children: ReactNode; className?: string }) => {
  return <div className={cn('px-5 pb-5', className)}>{children}</div>;
};
