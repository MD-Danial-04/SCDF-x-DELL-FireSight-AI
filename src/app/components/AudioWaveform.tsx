import { useEffect, useRef } from "react";
import { cn } from "./ui/utils";

interface AudioWaveformProps {
  /**
   * Live input stream to visualise. When omitted (e.g. demo / timer-only
   * recording), the bars fall back to a smooth simulated animation so the UI
   * still feels alive.
   */
  stream?: MediaStream | null;
  /** Whether a recording is currently active. Bars rest flat when false. */
  active: boolean;
  /** When paused, bars settle to a low idle line. */
  paused?: boolean;
  /** Number of bars to render. */
  barCount?: number;
  className?: string;
  barClassName?: string;
}

const MIN_SCALE = 0.12;

export function AudioWaveform({
  stream,
  active,
  paused = false,
  barCount = 28,
  className,
  barClassName,
}: AudioWaveformProps) {
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);

  // Build the Web Audio analyser graph whenever we have a live stream.
  useEffect(() => {
    if (!active || !stream) return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    void ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(analyser.frequencyBinCount);

    return () => {
      source.disconnect();
      analyser.disconnect();
      void ctx.close().catch(() => {});
      analyserRef.current = null;
      dataRef.current = null;
    };
  }, [stream, active]);

  // Single render loop drives the bars from either real or simulated data.
  useEffect(() => {
    const bars = barRefs.current;

    if (!active) {
      bars.forEach((bar) => {
        if (bar) bar.style.transform = `scaleY(${MIN_SCALE})`;
      });
      return;
    }

    const startedAt = performance.now();

    const render = (now: number) => {
      const analyser = analyserRef.current;
      const data = dataRef.current;

      if (paused) {
        bars.forEach((bar) => {
          if (bar) bar.style.transform = `scaleY(${MIN_SCALE})`;
        });
      } else if (analyser && data) {
        analyser.getByteFrequencyData(data);
        // Skip the highest bins, which are mostly empty for speech.
        const usableBins = Math.floor(data.length * 0.7);
        for (let i = 0; i < bars.length; i++) {
          const bar = bars[i];
          if (!bar) continue;
          const idx = Math.floor((i / bars.length) * usableBins);
          const value = data[idx] / 255;
          const scaled = Math.max(MIN_SCALE, Math.min(1, value * 1.4));
          bar.style.transform = `scaleY(${scaled})`;
        }
      } else {
        // Organic, flicker-free idle motion from layered sine waves.
        const t = (now - startedAt) / 1000;
        for (let i = 0; i < bars.length; i++) {
          const bar = bars[i];
          if (!bar) continue;
          const a = Math.sin(t * 5 + i * 0.5) * 0.5 + 0.5;
          const b = Math.sin(t * 3.3 + i * 0.9) * 0.5 + 0.5;
          const scaled = Math.max(MIN_SCALE, Math.min(1, a * 0.6 + b * 0.4));
          bar.style.transform = `scaleY(${scaled})`;
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, paused]);

  return (
    <div
      className={cn("flex h-10 items-center justify-center gap-[3px]", className)}
      role="img"
      aria-label={active ? "Audio input level" : undefined}
      aria-hidden={!active}
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          className={cn(
            "h-full w-[3px] rounded-full bg-primary/80 transition-transform duration-75 ease-out will-change-transform",
            barClassName
          )}
          style={{ transform: `scaleY(${MIN_SCALE})` }}
        />
      ))}
    </div>
  );
}
