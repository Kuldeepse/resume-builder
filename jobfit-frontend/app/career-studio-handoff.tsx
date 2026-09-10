'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'cognitwist-career-studio-context';

function setControlledValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function CareerStudioHandoff() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/') return;

    let context: { targetRole?: string; jobDescription?: string } | null = null;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      context = raw ? JSON.parse(raw) : null;
    } catch {
      context = null;
    }
    if (!context?.targetRole && !context?.jobDescription) return;

    const hydrate = () => {
      const roleInput = document.querySelector<HTMLInputElement>('input[placeholder^="e.g. Senior Technical Programme Manager"]');
      const jdInput = document.querySelector<HTMLTextAreaElement>('textarea[placeholder^="Paste the complete job description"]');
      if (context?.targetRole && roleInput) setControlledValue(roleInput, context.targetRole);
      if (context?.jobDescription && jdInput) setControlledValue(jdInput, context.jobDescription);
      if ((!context?.targetRole || roleInput) && (!context?.jobDescription || jdInput)) {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    };

    hydrate();
    const timers = [80, 300, 800].map((delay) => window.setTimeout(hydrate, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [pathname]);

  return null;
}
