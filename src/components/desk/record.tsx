"use client";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";
import { clock, formatSize } from "@/media/recipe";
import { MAX_AUDIO_BYTES, MAX_VIDEO_BYTES } from "@/media/files";
import { cn } from "@/lib/utils";

export type RecordMode = "mic" | "camera" | "screen";

export const RECORD_MODES: { id: RecordMode; label: string; icon: IconName }[] =
  [
    { id: "mic", label: "Voice", icon: "mic" },
    { id: "camera", label: "Camera", icon: "camera" },
    { id: "screen", label: "Screen", icon: "screen" },
  ];

export function recordModes(): RecordMode[] {
  if (
    typeof window === "undefined" ||
    typeof MediaRecorder === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  )
    return [];
  return "getDisplayMedia" in navigator.mediaDevices
    ? ["mic", "camera", "screen"]
    : ["mic", "camera"];
}

const VIDEO_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];
const AUDIO_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];
const pickType = (list: string[]) =>
  list.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

function fileName(type: string, audioOnly: boolean): string {
  const d = new Date(),
    p = (n: number) => String(n).padStart(2, "0");
  const ext = type.includes("mp4")
    ? audioOnly
      ? "m4a"
      : "mp4"
    : type.includes("ogg")
      ? "ogg"
      : audioOnly
        ? "weba"
        : "webm";
  return `recording-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
}

function why(e: unknown, mode: RecordMode): string {
  const name = (e as Error)?.name;
  const what =
    mode === "mic" ? "microphone" : mode === "camera" ? "camera" : "screen";
  if (name === "NotAllowedError" || name === "SecurityError")
    return `The ${what} was blocked. Allow it in the address bar, then try again.`;
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return `No ${what} was found.`;
  if (name === "NotReadableError") return `The ${what} is busy in another app.`;
  return `Couldn't start the ${what}.`;
}

type Phase = "asking" | "ready" | "recording" | "error";

export function Recorder({
  mode,
  onDone,
  onCancel,
}: {
  mode: RecordMode;
  onDone: (file: File) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(
    mode === "screen" ? "ready" : "asking",
  );
  const [error, setError] = useState<string | null>(null);
  const [withMic, setWithMic] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [level, setLevel] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const extra = useRef<MediaStream[]>([]);
  const audioCtx = useRef<AudioContext | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const audioOnly = mode === "mic";
  const limit = audioOnly ? MAX_AUDIO_BYTES : MAX_VIDEO_BYTES;

  const release = () => {
    if (rec.current?.state === "recording") rec.current.stop();
    [stream.current, ...extra.current].forEach((s) =>
      s?.getTracks().forEach((t) => t.stop()),
    );
    stream.current = null;
    extra.current = [];
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
  };
  useEffect(
    () => () => {
      if (rec.current) {
        rec.current.ondataavailable = null;
        rec.current.onstop = null;
      }
      release();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [],
  );

  const attach = (s: MediaStream) => {
    stream.current = s;
    if (preview.current && s.getVideoTracks().length) {
      preview.current.srcObject = s;
      preview.current.play().catch(() => {});
    }
    if (s.getAudioTracks().length) {
      const ctx = audioCtx.current ?? new AudioContext();
      audioCtx.current = ctx;
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx
        .createMediaStreamSource(new MediaStream(s.getAudioTracks()))
        .connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        if (!audioCtx.current) return;
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        requestAnimationFrame(tick);
      };
      tick();
    }
  };

  useEffect(() => {
    if (mode === "screen") return;
    let live = true;
    navigator.mediaDevices
      .getUserMedia(
        mode === "mic"
          ? { audio: { echoCancellation: true, noiseSuppression: true } }
          : {
              audio: true,
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user",
              },
            },
      )
      .then((s) => {
        if (!live) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        attach(s);
        setPhase("ready");
      })
      .catch((e) => {
        if (live) {
          setError(why(e, mode));
          setPhase("error");
        }
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const start = (s: MediaStream) => {
    const type = pickType(audioOnly ? AUDIO_TYPES : VIDEO_TYPES);
    const r = new MediaRecorder(s, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    let size = 0;
    r.ondataavailable = (e) => {
      if (!e.data.size) return;
      chunks.push(e.data);
      size += e.data.size;
      setBytes(size);
      if (size > limit * 0.95 && r.state === "recording") r.stop(); // stay under the editor's limit
    };
    r.onstop = () => {
      const blobType = (
        r.mimeType ||
        type ||
        (audioOnly ? "audio/webm" : "video/webm")
      ).split(";")[0];
      const file = new File(chunks, fileName(blobType, audioOnly), {
        type: blobType,
      });
      release();
      if (file.size) done.current(file);
      else {
        setError("Nothing was recorded.");
        setPhase("error");
      }
    };
    s.getVideoTracks().forEach((t) =>
      t.addEventListener("ended", () => {
        if (r.state === "recording") r.stop();
      }),
    );
    rec.current = r;
    r.start(1000);
    const t0 = Date.now();
    setSeconds(0);
    const timer = window.setInterval(() => {
      if (r.state !== "recording") window.clearInterval(timer);
      else setSeconds((Date.now() - t0) / 1000);
    }, 250);
    setPhase("recording");
  };

  const startScreen = async () => {
    setPhase("asking");
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      const mic = withMic
        ? await navigator.mediaDevices
            .getUserMedia({ audio: true })
            .catch(() => null)
        : null;
      const sources = [screen, mic].filter(
        (s): s is MediaStream => !!s && s.getAudioTracks().length > 0,
      );
      let out: MediaStream;
      if (sources.length > 1) {
        const ctx = new AudioContext();
        audioCtx.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        sources.forEach((s) => ctx.createMediaStreamSource(s).connect(dest));
        out = new MediaStream([
          ...screen.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);
      } else {
        out = new MediaStream([
          ...screen.getVideoTracks(),
          ...(sources[0]?.getAudioTracks() ?? []),
        ]);
      }
      extra.current = [screen, ...(mic ? [mic] : [])];
      attach(out);
      start(out);
    } catch (e) {
      setError(
        (e as Error)?.name === "NotAllowedError"
          ? "Screen sharing was cancelled."
          : why(e, "screen"),
      );
      setPhase("error");
    }
  };

  const title =
    mode === "mic"
      ? "Record your voice"
      : mode === "camera"
        ? "Record from the camera"
        : "Record the screen";
  const bars = 12;
  return (
    <section
      aria-label={title}
      className="flex w-full max-w-[640px] flex-col items-center gap-4"
    >
      <h2 className="m-0 font-display text-[clamp(28px,3.4vw,40px)] font-extrabold tracking-[-0.03em]">
        {title}
      </h2>

      {!audioOnly && (
        <div
          className={cn(
            "relative aspect-video w-full overflow-hidden rounded-[18px] border-2 border-edge bg-film",
            phase !== "recording" && phase !== "ready" && "opacity-60",
          )}
        >
          <video
            ref={preview}
            muted
            playsInline
            className={cn(
              "h-full w-full object-contain",
              mode === "camera" && "-scale-x-100",
            )}
          />
          {phase === "ready" && mode === "screen" && (
            <p className="absolute inset-0 m-0 grid place-items-center p-6 text-center text-[15px] font-extrabold text-ill-oat">
              The browser will ask which screen, window or tab to record.
            </p>
          )}
        </div>
      )}
      {(audioOnly || phase === "recording") && (
        <div aria-hidden="true" className="flex h-14 items-center gap-1.5">
          {Array.from({ length: bars }, (_, i) => {
            const on = level * bars > Math.abs(i - bars / 2) * 2;
            return (
              <span
                key={i}
                className={cn(
                  "w-2 rounded-full transition-[height] duration-75",
                  on ? "bg-accent" : "bg-mat-chip",
                )}
                style={{ height: on ? 14 + level * 42 : 10 }}
              />
            );
          })}
        </div>
      )}

      {phase === "recording" && (
        <p
          role="status"
          className="m-0 flex items-center gap-2.5 font-display text-[40px] font-extrabold tabular-nums leading-none"
        >
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-pulse rounded-full bg-[#e5484d]"
          />
          {clock(seconds)}
          <span className="font-ui text-base font-extrabold text-on-mat-soft">
            {formatSize(bytes)}
          </span>
        </p>
      )}
      {phase === "asking" && (
        <p
          role="status"
          className="m-0 font-hand text-[26px] font-bold text-accent"
        >
          waiting for permission…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="m-0 max-w-md rounded-2xl bg-card-on-mat px-4 py-2.5 text-center text-[15px] font-extrabold text-on-card-on-mat"
        >
          {error}
        </p>
      )}

      {phase === "ready" && mode === "screen" && (
        <label className="flex min-h-tap cursor-pointer items-center gap-2.5 text-[15px] font-extrabold">
          <input
            type="checkbox"
            checked={withMic}
            onChange={(e) => setWithMic(e.target.checked)}
            className="h-5 w-5 accent-[var(--accent)]"
          />
          also record my microphone
        </label>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {phase === "ready" && (
          <button
            type="button"
            onClick={() =>
              mode === "screen"
                ? startScreen()
                : stream.current && start(stream.current)
            }
            className="inline-flex min-h-[52px] items-center gap-2.5 rounded-button border-2 border-ill-line bg-accent pl-4 pr-6 text-[17px] font-extrabold text-on-accent shadow-on-mat"
          >
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 rounded-full bg-[#e5484d]"
            />
            {mode === "screen" ? "Choose & record" : "Start recording"}
          </button>
        )}
        {phase === "recording" && (
          <button
            type="button"
            onClick={() => rec.current?.stop()}
            className="inline-flex min-h-[52px] items-center gap-2.5 rounded-button border-2 border-ill-line bg-accent pl-4 pr-6 text-[17px] font-extrabold text-on-accent shadow-on-mat"
          >
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 rounded-[3px] bg-on-accent"
            />
            Stop & edit
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (rec.current) {
              rec.current.onstop = null;
            }
            release();
            onCancel();
          }}
          className="inline-flex min-h-[52px] items-center gap-2 rounded-button border-2 border-on-mat bg-transparent px-5 text-[17px] font-extrabold text-on-mat"
        >
          <Icon name="close" strokeWidth={2.6} />
          {phase === "recording" ? "Discard" : "Cancel"}
        </button>
      </div>
      <p className="m-0 inline-flex items-center gap-2 font-hand text-[22px] font-bold text-accent">
        <Icon name="home" size={20} />
        recorded on this device
      </p>
    </section>
  );
}
