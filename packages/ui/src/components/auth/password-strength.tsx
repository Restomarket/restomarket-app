import * as React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PasswordStrengthProps {
  password: string;
}

type StrengthLevel = 'weak' | 'medium' | 'strong';

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  {
    label: 'At least 8 characters',
    test: pwd => pwd.length >= 8,
  },
  {
    label: 'Contains uppercase letter',
    test: pwd => /[A-Z]/.test(pwd),
  },
  {
    label: 'Contains lowercase letter',
    test: pwd => /[a-z]/.test(pwd),
  },
  {
    label: 'Contains number',
    test: pwd => /[0-9]/.test(pwd),
  },
];

function calculateStrength(password: string): StrengthLevel {
  const metRequirements = requirements.filter(req => req.test(password));
  const count = metRequirements.length;

  if (count <= 1) return 'weak';
  if (count <= 3) return 'medium';
  return 'strong';
}

const strengthColors: Record<StrengthLevel, string> = {
  weak: 'bg-destructive',
  medium: 'bg-yellow-500',
  strong: 'bg-green-500',
};

const strengthWidths: Record<StrengthLevel, string> = {
  weak: 'w-1/3',
  medium: 'w-2/3',
  strong: 'w-full',
};

const strengthLabels: Record<StrengthLevel, string> = {
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
};

function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = calculateStrength(password);

  if (!password) return null;

  return (
    <div className="space-y-2">
      {/* Strength meter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Password strength</span>
          <span
            className={cn(
              'font-medium',
              strength === 'weak' && 'text-destructive',
              strength === 'medium' && 'text-yellow-600',
              strength === 'strong' && 'text-green-600',
            )}
          >
            {strengthLabels[strength]}
          </span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300',
              strengthColors[strength],
              strengthWidths[strength],
            )}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-1 text-xs">
        {requirements.map((req, index) => {
          const isMet = req.test(password);
          return (
            <li
              key={index}
              className={cn(
                'flex items-center gap-2',
                isMet ? 'text-green-600' : 'text-muted-foreground',
              )}
            >
              {isMet ? <Check className="size-3 shrink-0" /> : <X className="size-3 shrink-0" />}
              <span>{req.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { PasswordStrength };
