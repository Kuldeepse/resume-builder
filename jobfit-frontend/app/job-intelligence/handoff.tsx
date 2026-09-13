'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'cognitwist-job-intelligence-prefill';

function setControlledValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function JobIntelligenceHandoff() {
  useEffect(() => {
    let context: { targetRole?: string; location?: string } | null = null;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      context = raw ? JSON.parse(raw) : null;
    } catch {
      context = null;
    }
    if (!context?.targetRole && !context?.location) return;

    const hydrate = () => {
      const roleInput = document.querySelector<HTMLInputElement>('input[placeholder="e.g. Product Manager"]');
      const locationInput = document.querySelector<HTMLInputElement>('input[placeholder="e.g. UK / London / Remote"]');
      if (context?.targetRole && roleInput) setControlledValue(roleInput, context.targetRole);
      if (context?.location && locationInput) setControlledValue(locationInput, context.location);
      if ((!context?.targetRole || roleInput) && (!context?.location || locationInput)) {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    };

    hydrate();
    const timers = [80, 300, 800].map((delay) => window.setTimeout(hydrate, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return null;
}
