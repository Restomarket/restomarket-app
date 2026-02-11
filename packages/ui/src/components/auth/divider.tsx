import * as React from 'react';
import { cn } from '../../lib/utils';

interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  text?: string;
}

function Divider({ text = 'Or', className, ...props }: DividerProps) {
  return (
    <div className={cn('relative flex items-center', className)} {...props}>
      <div className="flex-grow border-t border-muted-foreground/20" />
      {text && (
        <span className="mx-4 flex-shrink text-xs text-muted-foreground uppercase">{text}</span>
      )}
      <div className="flex-grow border-t border-muted-foreground/20" />
    </div>
  );
}

export { Divider };
