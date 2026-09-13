'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'cognitwist-career-studio-context';

export default function LegacyStudioHandoff() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(STORAGE_KEY)) {
        window.location.replace('/studio');
      }
    } catch {
      // Ignore unavailable session storage and keep Career Copilot usable.
    }
  }, []);

  return null;
}
