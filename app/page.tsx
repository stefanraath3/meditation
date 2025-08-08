"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type TimerState = "idle" | "running" | "paused" | "finished";

function formatTime(totalMs: number): string {
  const clamped = Math.max(0, Math.floor(totalMs / 1000));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function createAudioContextOnce(): () => AudioContext {
  let ctx: AudioContext | null = null;
  return () => {
    if (!ctx) {
      const W = window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctor = W.AudioContext ?? W.webkitAudioContext;
      if (!Ctor) {
        throw new Error("Web Audio API not supported");
      }
      ctx = new Ctor();
    }
    return ctx;
  };
}

const getAudioContext = createAudioContextOnce();

function playChime(kind: "start" | "end") {
  // Gentle struck-bell style chime using simple FM + overtones
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const baseFreq = kind === "start" ? 660 : 528; // elegant, not harsh
  const overtoneRatios = kind === "start" ? [1, 2.01, 2.98] : [1, 1.5, 2.5];
  const totalDuration = kind === "start" ? 1.6 : 2.2;

  overtoneRatios.forEach((ratio, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const frequency = baseFreq * ratio;
    osc.type = index === 0 ? "sine" : "triangle";
    osc.frequency.value = frequency;

    // Slight FM for shimmer
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 5 + index * 0.75;
    lfoGain.gain.value = 0.4 + index * 0.15;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.0001, now);
    const attack = 0.01;
    gain.gain.exponentialRampToValueAtTime(0.7 / (index + 1), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + totalDuration);
    lfo.stop(now + totalDuration);
  });
}

export default function Home() {
  const [timerState, setTimerState] = React.useState<TimerState>("idle");
  const [unit, setUnit] = React.useState<"min" | "sec">("min");
  const [selectedValue, setSelectedValue] = React.useState<number>(10);
  const [remainingMs, setRemainingMs] = React.useState<number>(10 * 60_000);
  const endTimeRef = React.useRef<number | null>(null);
  const intervalRef = React.useRef<number | null>(null);
  const startAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const endAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = React.useRef<boolean>(false);

  const unitFactor = unit === "min" ? 60_000 : 1_000;
  const totalMs = selectedValue * unitFactor;
  const progress = Math.max(
    0,
    Math.min(100, ((totalMs - remainingMs) / totalMs) * 100 || 0)
  );

  React.useEffect(() => {
    if (timerState === "idle" || timerState === "finished") {
      setRemainingMs(selectedValue * unitFactor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue, unit]);

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  React.useEffect(() => {
    // Preload audio assets once
    const startA = new Audio("/start.mp3");
    startA.preload = "auto";
    const endA = new Audio("/end.mp3");
    endA.preload = "auto";
    startAudioRef.current = startA;
    endAudioRef.current = endA;
    return () => {
      startA.pause();
      endA.pause();
      startAudioRef.current = null;
      endAudioRef.current = null;
    };
  }, []);

  async function ensureAudioUnlocked() {
    if (audioUnlockedRef.current) return;
    try {
      if (startAudioRef.current) {
        startAudioRef.current.currentTime = 0;
        await startAudioRef.current.play();
        startAudioRef.current.pause();
        startAudioRef.current.currentTime = 0;
      }
      if (endAudioRef.current) {
        endAudioRef.current.currentTime = 0;
        await endAudioRef.current.play();
        endAudioRef.current.pause();
        endAudioRef.current.currentTime = 0;
      }
      audioUnlockedRef.current = true;
    } catch {
      // ignore; fallback will handle if needed
    }
  }

  async function playStartSound() {
    try {
      if (startAudioRef.current) {
        startAudioRef.current.currentTime = 0;
        await startAudioRef.current.play();
        return;
      }
    } catch {}
    try {
      playChime("start");
    } catch {}
  }

  async function playEndSound() {
    try {
      if (endAudioRef.current) {
        endAudioRef.current.currentTime = 0;
        await endAudioRef.current.play();
        return;
      }
    } catch {}
    try {
      playChime("end");
    } catch {}
  }

  function tick() {
    if (endTimeRef.current == null) return;
    const msLeft = Math.max(0, endTimeRef.current - Date.now());
    setRemainingMs(msLeft);
    if (msLeft <= 0) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      endTimeRef.current = null;
      setTimerState("finished");
      try {
        void playEndSound();
      } catch {}
    }
  }

  function startTimer() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    const duration = selectedValue * unitFactor;
    endTimeRef.current = Date.now() + duration;
    setRemainingMs(duration);
    setTimerState("running");
    void ensureAudioUnlocked().then(() => {
      void playStartSound();
    });
    intervalRef.current = window.setInterval(tick, 200);
  }

  function pauseTimer() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (endTimeRef.current != null) {
      const msLeft = Math.max(0, endTimeRef.current - Date.now());
      setRemainingMs(msLeft);
      endTimeRef.current = null;
    }
    setTimerState("paused");
  }

  function resumeTimer() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    endTimeRef.current = Date.now() + remainingMs;
    setTimerState("running");
    intervalRef.current = window.setInterval(tick, 200);
  }

  function resetTimer() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    endTimeRef.current = null;
    setTimerState("idle");
    setRemainingMs(selectedValue * unitFactor);
  }

  const isRunning = timerState === "running";
  const isIdle = timerState === "idle";
  const isPaused = timerState === "paused";
  const isFinished = timerState === "finished";

  return (
    <div className="min-h-dvh grid place-items-center p-6 sm:p-10">
      <main className="w-full max-w-md">
        <section
          aria-label="Meditation timer"
          className="rounded-2xl border border-border/70 bg-card/50 backdrop-blur-sm p-6 sm:p-8 shadow-[0_10px_30px_-10px_oklch(0.145_0_0_/_.2)]"
        >
          <header className="mb-6 sm:mb-8 flex items-center justify-between gap-3">
            <h1 className="text-lg sm:text-xl tracking-tight font-medium">
              Stillness
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {selectedValue} {unit === "min" ? "min" : "sec"}
              </span>
              <ToggleGroup
                type="single"
                value={unit}
                onValueChange={(val) => {
                  if (!val) return;
                  if (!(val === "min" || val === "sec")) return;
                  if (!(timerState === "idle" || timerState === "finished"))
                    return;
                  const prevFactor = unit === "min" ? 60_000 : 1_000;
                  const nextFactor = val === "min" ? 60_000 : 1_000;
                  const total = selectedValue * prevFactor;
                  const nextValue = Math.max(
                    val === "min" ? 1 : 5,
                    Math.round(total / nextFactor)
                  );
                  setUnit(val);
                  setSelectedValue(nextValue);
                  setRemainingMs(nextValue * nextFactor);
                }}
                className="ml-1"
                aria-label="Time unit"
              >
                <ToggleGroupItem value="min" aria-label="Minutes">
                  min
                </ToggleGroupItem>
                <ToggleGroupItem value="sec" aria-label="Seconds">
                  sec
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </header>

          <div className="mb-6 sm:mb-8 text-center">
            <p className="text-[56px] sm:text-[72px] leading-none font-light tabular-nums select-none">
              {formatTime(remainingMs)}
            </p>
            <div className="mt-5">
              <Progress value={progress} aria-label="Progress" />
            </div>
          </div>

          <div className="mb-6 sm:mb-8">
            <label htmlFor="duration" className="sr-only">
              Duration ({unit === "min" ? "minutes" : "seconds"})
            </label>
            <Slider
              id="duration"
              aria-label={`Duration in ${
                unit === "min" ? "minutes" : "seconds"
              }`}
              min={unit === "min" ? 1 : 10}
              max={unit === "min" ? 120 : 600}
              value={[selectedValue]}
              disabled={!(timerState === "idle" || timerState === "finished")}
              onValueChange={(v) => {
                const value = Array.isArray(v)
                  ? v[0]
                  : (v as unknown as number);
                setSelectedValue(value);
                if (isIdle || isFinished) setRemainingMs(value * unitFactor);
              }}
            />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              {unit === "min" ? (
                <>
                  <span>1</span>
                  <span>30</span>
                  <span>60</span>
                  <span>90</span>
                  <span>120</span>
                </>
              ) : (
                <>
                  <span>10</span>
                  <span>60</span>
                  <span>120</span>
                  <span>300</span>
                  <span>600</span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {isIdle && (
              <Button
                className="col-span-3 h-12 text-base"
                onClick={startTimer}
              >
                Start
              </Button>
            )}

            {isRunning && (
              <>
                <Button
                  variant="secondary"
                  className="h-12"
                  onClick={pauseTimer}
                >
                  Pause
                </Button>
                <Button variant="outline" className="h-12" onClick={resetTimer}>
                  Reset
                </Button>
                <span className="h-12 rounded-md grid place-items-center text-sm text-muted-foreground border border-transparent"></span>
              </>
            )}

            {isPaused && (
              <>
                <Button className="h-12" onClick={resumeTimer}>
                  Resume
                </Button>
                <Button variant="outline" className="h-12" onClick={resetTimer}>
                  Reset
                </Button>
                <span className="h-12 rounded-md grid place-items-center text-sm text-muted-foreground border border-transparent"></span>
              </>
            )}

            {isFinished && (
              <>
                <Button className="col-span-2 h-12" onClick={startTimer}>
                  Repeat
                </Button>
                <Button variant="outline" className="h-12" onClick={resetTimer}>
                  Done
                </Button>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            A minimalist meditation timer with gentle chimes.
          </p>
        </section>
      </main>
    </div>
  );
}
