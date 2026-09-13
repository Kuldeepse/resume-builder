import type { ReactNode } from 'react';
import VoiceAnswerGuide from './voice-answer-guide';

export default function LiveInterviewLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <VoiceAnswerGuide />
      {children}
    </>
  );
}
