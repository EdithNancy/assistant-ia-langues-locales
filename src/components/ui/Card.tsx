import React from 'react';

type CardProps<T extends React.ElementType> = {
  as?: T;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

/** Carte de l'app : fond clair, arrondi 3xl, ombre douce, fin liseré. */
export const Card = <T extends React.ElementType = 'div'>({ as, className = '', children, ...rest }: CardProps<T>) => {
  const Tag = (as ?? 'div') as React.ElementType;
  return (
    <Tag
      className={`bg-surface-container-lowest rounded-3xl shadow-soft border border-surface-container/60 ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
};
