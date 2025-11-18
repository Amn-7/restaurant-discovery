'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';

export default function AdminQRPage() {
  const [count, setCount] = useState(20);
  const tables = useMemo(() => Array.from({ length: count }, (_, i) => i + 1), [count]);

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">Guest onboarding</span>
        <h1 className="hero__title">QR codes for every table</h1>
        <p className="hero__text">
          Export scannable codes that launch guests directly into their personalised table view.
        </p>
      </section>

      <section className="control-bar">
        <label className="labelled-control control-bar__spacer">
          Tables
          <input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Number of tables"
          />
        </label>
        <button className="btn btn--primary" type="button" onClick={() => window.print()}>
          Print
        </button>
      </section>

      <div className="grid grid--cols-auto">
        {tables.map((t) => (
          <article key={t} className="card card--interactive card--centered">
            <div className="card__title">Table {t}</div>
            <Image
              src={`/api/qr?table=${t}`}
              alt={`QR for table ${t}`}
              width={200}
              height={200}
              unoptimized
            />
            <p className="muted">Scan to jump straight to your table view</p>
          </article>
        ))}
      </div>
    </div>
  );
}
