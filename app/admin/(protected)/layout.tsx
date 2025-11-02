import { ReactNode } from 'react';

type Props = { children: ReactNode };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function AdminProtectedLayout({ children }: Props) {
  return <>{children}</>;
}
