import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function AuthSheetLayout({ children }: Props) {
  return <section className="auth-sheet">{children}</section>;
}
