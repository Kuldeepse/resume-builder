'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, Target } from 'lucide-react';

type FaceLike = { boundingBox?: { x?: number; y?: number; width?: number; height?: number } };
type FaceDetectorLike = { detect: (source: HTMLVideoElement) => Promise<FaceLike[]> };
type FaceDetectorCtor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getFaceDetector(): FaceDetectorCtor | undefined {
  return (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
}

export default function PresenceCoach() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetectorLike | null>(null);
  const timerRef = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [detectorSupported, setDetectorSupported] = useState(false);
  const [samples, setSamples] = useState<number[]>([]);
  const [facePresent, setFacePresent] = useState<boolean | null>(null);
  const [message, setMessage] = useState('Camera is off. Video stays in this browser and is not uploaded by this coach.');

  const score = useMemo(() => samples.length ? Math.round(samples.reduce((sum, item) => sum + item, 0) / samples.length) : null, [samples]);

  const stop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setEnabled(false);
    setFacePresent(null);
    setMessage('Camera is off. Video stays in this browser and is not uploaded by this coach.');
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    if (typeof navigator.mediaDevices === 'undefined') {
      setSupported(false);
      setMessage('Camera access is unavailable in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setEnabled(true);
      setSamples([]);
      const Detector = getFaceDetector();
      setDetectorSupported(Boolean(Detector));
      if (!Detector) {
        setMessage('Camera preview is active. Automated framing analytics are not supported by this browser.');
        return;
      }
      detectorRef.current = new Detector({ fastMode: true, maxDetectedFaces: 1 });
      setMessage('Presence coach is checking only face-in-frame and centering consistency.');
      timerRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        const detector = detectorRef.current;
        if (!video || !detector || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
        try {
          const faces = await detector.detect(video);
          const box = faces[0]?.boundingBox;
          if (!box) {
            setFacePresent(false);
            setSamples((items) => [...items.slice(-29), 35]);
            return;
          }
          setFacePresent(true);
          const x = Number(box.x || 0);
          const y = Number(box.y || 0);
          const width = Number(box.width || 0);
          const height = Number(box.height || 0);
          const faceCx = x + width / 2;
          const faceCy = y + height / 2;
          const dx = Math.abs(faceCx - video.videoWidth / 2) / Math.max(1, video.videoWidth / 2);
          const dy = Math.abs(faceCy - video.videoHeight / 2) / Math.max(1, video.videoHeight / 2);
          const areaRatio = (width * height) / Math.max(1, video.videoWidth * video.videoHeight);
          const sizePenalty = areaRatio < 0.05 ? 24 : areaRatio > 0.6 ? 18 : 0;
          const sample = clamp(100 - dx * 45 - dy * 35 - sizePenalty);
          setSamples((items) => [...items.slice(-29), sample]);
        } catch {
          // Native face detection can fail transiently on some browser/device combinations.
        }
      }, 1000);
    } catch {
      setSupported(false);
      setMessage('Camera permission was not granted or no camera is available.');
    }
  };

  return (
    <aside className="fixed bottom-20 right-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-xl)] md:bottom-5" aria-label="Optional camera presence coach">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Target className="h-4 w-4 text-[var(--accent-strong)]" /><div><p className="text-[10px] font-black uppercase tracking-wide">Presence coach</p><p className="text-[9px] text-[var(--ink-soft)]">Optional · local camera</p></div></div>
        {enabled ? <button type="button" onClick={stop} className="inline-flex items-center gap-1 rounded-lg border border-[var(--surface-border)] px-2 py-1.5 text-[9px] font-black"><Square className="h-3 w-3" /> Stop</button> : <button type="button" onClick={start} disabled={!supported} className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2 py-1.5 text-[9px] font-black text-white disabled:opacity-40"><Play className="h-3 w-3" /> Camera</button>}
      </div>
      {enabled && <video ref={videoRef} muted playsInline className="mt-3 aspect-video w-full rounded-xl bg-black object-cover" />}
      <div className="mt-2 flex items-center justify-between gap-3 text-[9px]">
        <span className="text-[var(--ink-soft)]">{message}</span>
        {detectorSupported && score != null ? <span className="shrink-0 rounded-full border border-[var(--surface-border)] px-2 py-1 font-black">Framing {score}</span> : null}
      </div>
      {detectorSupported && facePresent === false ? <p className="mt-2 text-[9px] font-semibold text-amber-700">Move back into frame before continuing.</p> : null}
      <p className="mt-2 text-[8px] leading-4 text-[var(--ink-soft)]">This does not infer emotion, confidence, personality or employability. Native framing analytics are shown only when your browser supports face detection.</p>
    </aside>
  );
}
