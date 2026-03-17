import React from 'react';

export default function InfoTooltip({ text }) {
  return (
    <span className="group relative inline-flex items-center">
      <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 text-[10px] font-semibold leading-none text-blue-400 cursor-help">
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-56 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 text-[11px] leading-relaxed text-slate-700 shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}
