import LiveInterviewV3 from './live-interview-v3';
import LiveInterviewRuntimeBridge from './live-interview-runtime-bridge';

export default function LiveInterviewPage() {
  return (
    <LiveInterviewRuntimeBridge>
      <LiveInterviewV3 />
    </LiveInterviewRuntimeBridge>
  );
}
