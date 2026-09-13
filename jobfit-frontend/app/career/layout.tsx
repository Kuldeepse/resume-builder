import LegacyStudioHandoff from './legacy-studio-handoff';

export default function CareerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <LegacyStudioHandoff />
      {children}
    </>
  );
}
