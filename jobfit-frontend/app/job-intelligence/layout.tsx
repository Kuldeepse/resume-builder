import JobIntelligenceHandoff from './handoff';

export default function JobIntelligenceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <JobIntelligenceHandoff />
      {children}
    </>
  );
}
