'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { safeLocalStorage } from '@/lib/safeStorage';

type BarcodeDetectorResult = { rawValue?: string };
type BarcodeDetectorOptions = { formats?: string[] };
type BarcodeDetectorLike = {
  new (options?: BarcodeDetectorOptions): {
    detect: (source: HTMLVideoElement | CanvasImageSource) => Promise<BarcodeDetectorResult[]>;
  };
};
type BarcodeDetectorInstance = InstanceType<BarcodeDetectorLike>;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorLike;
  }
}

const STORAGE_KEY = 'guest.tableNumber';

type ScanState = 'idle' | 'starting' | 'scanning' | 'done' | 'unsupported';

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const [state, setState] = useState<ScanState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const stopScanning = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setState((prev) => (prev === 'unsupported' ? prev : 'idle'));
  }, []);

  const storeTableNumber = useCallback((value: string) => {
    if (typeof window === 'undefined') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    safeLocalStorage.set(STORAGE_KEY, trimmed);
    window.dispatchEvent(new CustomEvent('table-number-change', { detail: trimmed }));
  }, []);

  const handlePayload = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      let targetTable: string | null = null;
      try {
        const parsed = new URL(trimmed);
        const match = parsed.pathname.match(/\/t\/([^/]+)/);
        if (match?.[1]) {
          targetTable = decodeURIComponent(match[1]);
        } else if (parsed.searchParams.has('table')) {
          targetTable = parsed.searchParams.get('table');
        }
        if (parsed.protocol.startsWith('http')) {
          // Fallback: open the URL if we can't detect table slug
          if (!targetTable) {
            window.location.href = parsed.toString();
            return;
          }
        }
      } catch {
        // Not a URL – treat as table code
        targetTable = trimmed.replace(/^table\s*/i, '');
      }

      if (targetTable && targetTable.trim()) {
        storeTableNumber(targetTable);
        router.push(`/t/${encodeURIComponent(targetTable.trim())}`);
        setResult(`Opening table ${targetTable}`);
        setState('done');
        stopScanning();
        return;
      }
      setResult(trimmed);
      setState('done');
      stopScanning();
    },
    [router, stopScanning, storeTableNumber]
  );

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const startScanning = useCallback(async () => {
    setError(null);
    setResult(null);
    if (typeof window === 'undefined' || typeof window.BarcodeDetector !== 'function') {
      setState('unsupported');
      setError('Camera scanning is not supported on this browser. Please use your device camera or enter the table manually.');
      return;
    }
    try {
      setState('starting');
      const DetectorCtor = window.BarcodeDetector;
      const detector = detectorRef.current || new DetectorCtor({ formats: ['qr_code'] });
      detectorRef.current = detector;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState('scanning');

      const scan = async () => {
        if (!videoRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            if (typeof raw === 'string' && raw.trim()) {
              handlePayload(raw);
              return;
            }
          }
        } catch (err) {
          console.error('Scan error', err);
        }
        rafRef.current = requestAnimationFrame(scan);
      };
      scan();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to access camera');
      setState('idle');
      stopScanning();
    }
  }, [handlePayload, stopScanning]);

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">Scan your table</span>
        <h1 className="hero__title">Point your camera at the QR code</h1>
        <p className="hero__text">
          We&apos;ll detect the table automatically so you can start ordering in seconds. If the scanner isn&apos;t supported on
          your device, you can still use your phone camera or enter the table number manually via the My Table button.
        </p>
      </section>

      <section className="card card--stacked" style={{ gap: 'var(--space-md)' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', borderRadius: 'var(--radius-lg)', background: '#000', minHeight: 220 }}
        />
        <div className="page" style={{ gap: 'var(--space-sm)' }}>
          <button
            className="btn btn--primary"
            type="button"
            onClick={startScanning}
            disabled={state === 'scanning'}
            style={{ width: '100%', minHeight: 48 }}
          >
            {state === 'scanning' ? 'Scanning…' : 'Start scanning'}
          </button>
          {state === 'scanning' ? (
            <button className="btn btn--ghost" type="button" onClick={stopScanning} style={{ width: '100%', minHeight: 48 }}>
              Stop camera
            </button>
          ) : null}
        </div>
        {result ? <p className="muted">Last result: {result}</p> : null}
        {error ? (
          <div role="alert" className="alert alert--error">
            {error}
          </div>
        ) : null}
      </section>
    </div>
  );
}
