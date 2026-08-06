'use client';

import { useEffect, type ReactNode } from 'react';

type InterviewContext = {
  role?: string;
  jobDescription?: string;
  interviewType?: 'hr' | 'behavioural' | 'technical';
};

function setControlledValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function LiveInterviewLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    let context: InterviewContext = {};

    try {
      const stored = window.sessionStorage.getItem('cognitwist-live-interview-context');
      if (stored) context = JSON.parse(stored) as InterviewContext;
    } catch {
      context = {};
    }

    const params = new URLSearchParams(window.location.search);
    const role = params.get('role') || context.role || '';
    const interviewType = (params.get('type') || context.interviewType || '') as InterviewContext['interviewType'];
    const jobDescription = context.jobDescription || '';

    if (!role && !jobDescription && !interviewType) return;

    const applyContext = () => {
      const roleInput = document.querySelector<HTMLInputElement>('input[placeholder="Enter the exact job title…"]');
      const descriptionInput = document.querySelector<HTMLTextAreaElement>('textarea[placeholder^="Paste the role requirements"]');

      if (roleInput && role) setControlledValue(roleInput, role);
      if (descriptionInput && jobDescription) setControlledValue(descriptionInput, jobDescription);

      if (interviewType) {
        const labels: Record<NonNullable<InterviewContext['interviewType']>, string> = {
          hr: 'Initial HR screening',
          behavioural: 'Behavioural interview',
          technical: 'Technical interview',
        };
        const targetLabel = labels[interviewType];
        const stageButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
          button.textContent?.includes(targetLabel),
        );
        stageButton?.click();
      }
    };

    const timers = [100, 350, 800].map((delay) => window.setTimeout(applyContext, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return children;
}
