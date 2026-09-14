import type { ReactNode } from 'react';
import PresenceCoach from './presence-coach';

export default function LiveInterviewLayout({ children }: { children: ReactNode }) {
  return <>{children}<PresenceCoach /></>;
}
