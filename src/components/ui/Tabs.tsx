"use client";

import { useState } from "react";

type TabItem = { key: string; label: string };

type Props = {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (key: string) => void;
  className?: string;
};

/** Segmented control แบบ underline active-state (รองรับ scroll แนวนอนถ้ารายการเยอะ) ตาม docs/design.md */
export default function Tabs({ items, value, defaultValue, onChange, className = "" }: Props) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.key);
  const active = value ?? internal;

  const select = (key: string) => {
    onChange?.(key);
    if (value === undefined) setInternal(key);
  };

  return (
    <div className={`flex gap-4 overflow-x-auto border-b border-border ${className}`}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => select(item.key)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-1 pb-2 text-sm font-semibold transition-colors ${
              isActive ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
