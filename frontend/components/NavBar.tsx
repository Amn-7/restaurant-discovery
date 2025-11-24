'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent
} from 'react';

const primaryLinks = [
  { href: '/', label: 'Live Feed', icon: '📡' },
  { href: '/menu', label: 'Menu', icon: '🍽️' },
  { href: '/cart', label: 'Cart', icon: '🛒' },
  { href: '/analytics', label: 'Analytics', icon: '📊' }
];

const adminLinks = [
  { href: '/admin', label: 'Admin' },
  { href: '/admin/orders', label: 'Order History' },
  { href: '/admin/qr', label: 'QR Codes' }
];

const FONT_STACK =
  'var(--font-inter, "Inter"), "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';

const STORAGE_KEY = 'guest.tableNumber';

export default function NavBar() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState<string | null>(null);

  const isTableActive = pathname.startsWith('/t/');

  const syncTableNumber = useCallback((value: string | null) => {
    setTableNumber(value && value.trim() ? value.trim() : null);
  }, []);

  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      syncTableNumber(stored);
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        syncTableNumber(event.newValue);
      }
    };

    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      syncTableNumber(detail || null);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('table-number-change', handleCustom as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('table-number-change', handleCustom as EventListener);
    };
  }, [syncTableNumber]);

  const storeTableNumber = useCallback((value: string | null) => {
    if (typeof window === 'undefined') return;
    if (value && value.trim()) {
      const trimmed = value.trim();
      window.localStorage.setItem(STORAGE_KEY, trimmed);
      window.dispatchEvent(
        new CustomEvent('table-number-change', { detail: trimmed })
      );
      syncTableNumber(trimmed);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent('table-number-change', { detail: '' })
      );
      syncTableNumber(null);
    }
  }, [syncTableNumber]);

  const promptForTable = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const entry = window.prompt('Enter your table number or code:');
    if (!entry) return null;
    const trimmed = entry.trim();
    if (!trimmed) return null;
    storeTableNumber(trimmed);
    return trimmed;
  }, [storeTableNumber]);

  const navigateToTable = useCallback(
    (target?: string | null) => {
      const table = target ?? tableNumber ?? promptForTable();
      if (!table) return;
      router.push(`/t/${encodeURIComponent(table)}`);
    },
    [promptForTable, router, tableNumber]
  );

  const handleTableClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (event.shiftKey) {
        const updated = promptForTable();
        if (updated) {
          navigateToTable(updated);
        }
        return;
      }
      navigateToTable();
    },
    [navigateToTable, promptForTable]
  );

  const handleTableContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (!tableNumber) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof window !== 'undefined' && window.confirm('Clear saved table?')) {
        storeTableNumber(null);
      }
    },
    [storeTableNumber, tableNumber]
  );

  const desktopLinks = useMemo(() => {
    const allLinks = [...primaryLinks, ...adminLinks];
    return allLinks.map((link) => {
      const isActive =
        pathname === link.href ||
        (link.href !== '/' && pathname.startsWith(link.href));
      return (
        <Link
          key={`desktop-${link.href}`}
          href={link.href}
          data-active={isActive ? 'true' : 'false'}
          className="app-nav__link"
        >
          {link.label}
        </Link>
      );
    });
  }, [pathname]);

  const tableLabel = tableNumber ? `Table ${tableNumber}` : 'My Table';

  return (
    <>
      <nav className="app-nav frosted" data-open={open ? 'true' : 'false'}>
        <Link href="/" className="app-nav__brand">
          <span aria-hidden>🍽️</span>
          <span className="app-nav__title" style={{ fontFamily: FONT_STACK }}>
            Order Discovery
          </span>
          <span className="app-nav__badge" style={{ fontFamily: FONT_STACK }}>
            Live
          </span>
        </Link>
        <button
          type="button"
          className="app-nav__toggle"
          aria-expanded={open}
          aria-label="Toggle navigation menu"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="app-nav__links" data-open={open ? 'true' : 'false'}>
          <div className="app-nav__links-list">{desktopLinks}</div>
          <div className="app-nav__links-actions">
            <Link
              href="/scan"
              className="app-nav__link app-nav__button"
              data-active={pathname.startsWith('/scan') ? 'true' : 'false'}
              title="Open camera to scan your table QR"
            >
              📷 Scan
            </Link>
            <button
              type="button"
              className="app-nav__link app-nav__button"
              data-active={isTableActive ? 'true' : 'false'}
              onClick={handleTableClick}
              onContextMenu={handleTableContextMenu}
              title="Click to open your table. Shift-click to set a different table. Right-click to clear."
            >
              🪑 {tableLabel}
            </button>
          </div>
        </div>
      </nav>
      <nav className="app-nav-mobile" aria-label="Primary navigation">
        <Link
          href="/"
          data-active={pathname === '/' ? 'true' : 'false'}
          className="app-nav-mobile__link"
        >
          <span aria-hidden>📡</span>
          <span>Feed</span>
        </Link>
        <Link
          href="/menu"
          data-active={pathname.startsWith('/menu') ? 'true' : 'false'}
          className="app-nav-mobile__link"
        >
          <span aria-hidden>🍽️</span>
          <span>Menu</span>
        </Link>
        <Link
          href="/scan"
          data-active={pathname.startsWith('/scan') ? 'true' : 'false'}
          className="app-nav-mobile__link"
        >
          <span aria-hidden>📷</span>
          <span>Scan</span>
        </Link>
        <button
          type="button"
          className="app-nav-mobile__link app-nav-mobile__button"
          data-active={isTableActive ? 'true' : 'false'}
          onClick={handleTableClick}
          onContextMenu={handleTableContextMenu}
          title="Tap to open your table. Long-press/shift-click to change."
        >
          <span aria-hidden>🪑</span>
          <span>{tableNumber ? `Table ${tableNumber}` : 'My Table'}</span>
        </button>
        <Link
          href="/analytics"
          data-active={pathname.startsWith('/analytics') ? 'true' : 'false'}
          className="app-nav-mobile__link"
        >
          <span aria-hidden>📊</span>
          <span>Insights</span>
        </Link>
      </nav>
    </>
  );
}
