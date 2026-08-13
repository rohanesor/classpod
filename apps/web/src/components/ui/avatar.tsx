'use client';

import React from 'react';
import { User as UserIcon } from 'lucide-react';

interface AvatarProps {
  name?: string;
  avatarUrl?: string | null;
  role?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showRoleBadge?: boolean;
  className?: string;
}

export function UserAvatar({
  name = '',
  avatarUrl = null,
  role,
  size = 'md',
  showRoleBadge = false,
  className = '',
}: AvatarProps) {
  const sizeMap = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-xl',
    '2xl': 'h-24 w-24 text-3xl',
  };

  const getInitials = (fullName: string) => {
    if (!fullName) return 'CP';
    const parts = fullName.trim().split(/\s+/);
    const first = parts[0] || 'C';
    const last = parts[parts.length - 1] || 'P';
    if (parts.length === 1) return first.slice(0, 2).toUpperCase();
    return ((first[0] || 'C') + (last[0] || 'P')).toUpperCase();
  };

  const initials = getInitials(name);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name || 'User avatar'}
          className={`${sizeMap[size]} rounded-full object-cover border-2 border-border shadow-sm`}
        />
      ) : (
        <div
          className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-blue-500/20 text-primary font-bold flex items-center justify-center border-2 border-primary/20 shadow-sm`}
        >
          {initials || <UserIcon className="h-1/2 w-1/2" />}
        </div>
      )}

      {showRoleBadge && role && (
        <span
          className={`absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase border shadow-sm ${
            role.toUpperCase() === 'TEACHER'
              ? 'bg-primary text-primary-foreground border-primary/40'
              : 'bg-emerald-600 text-white border-emerald-500/40'
          }`}
        >
          {role.toUpperCase() === 'TEACHER' ? 'T' : 'S'}
        </span>
      )}
    </div>
  );
}
