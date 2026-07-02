"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Square, SkipBack, SkipForward, Volume2,
  Plus, ChevronDown, ChevronUp, Music, X
} from "lucide-react";
import { playSound } from "@/lib/sounds";
import { addActivityEvent } from "@/components/jarvis/activity-feed";

interface Track {
  file: File;
  name: string;
  url: string;
}

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playTrackByIndexRef = useRef<(idx: number) => void>(() => {});

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [vizData, setVizData] = useState<Uint8Array>(new Uint8Array(32));

  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] : null;

  // Create audio element on mount
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      // Auto-advance
      setCurrentIndex((prev) => {
        if (prev < tracks.length - 1) {
          const next = prev + 1;
          setTimeout(() => playTrackByIndexRef.current(next), 100);
          return next;
        }
        return prev;
      });
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
    }, []);

  // Visualizer loop
  const startVizLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteFrequencyData(data);
      setVizData(new Uint8Array(data.slice(0, 32)));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const stopVizLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setVizData(new Uint8Array(32));
  }, []);

  // Connect audio to analyser (one-time, per audio element)
  const ensureAnalyser = useCallback(() => {
    if (analyserRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;

    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch {
      // Already connected or not supported
    }
  }, []);

  const playTrackByIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= tracks.length) return;
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentIndex(idx);
    audio.src = tracks[idx].url;
    audio.play().then(() => {
      setIsPlaying(true);
      ensureAnalyser();
      startVizLoop();
      addActivityEvent({ severity: "info", category: "media", message: `Воспроизведение: ${tracks[idx].name.length > 35 ? tracks[idx].name.slice(0, 35) + "..." : tracks[idx].name}` });
    }).catch(() => {
      // Autoplay blocked
    });
  }, [tracks, ensureAnalyser, startVizLoop]);

  // Keep ref in sync for the onEnded handler
  useEffect(() => { playTrackByIndexRef.current = playTrackByIndex; }, [playTrackByIndex]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      stopVizLoop();
    } else {
      ensureAnalyser();
      audio.play().then(() => {
        setIsPlaying(true);
        startVizLoop();
      }).catch(() => {});
    }
  }, [isPlaying, currentTrack, ensureAnalyser, startVizLoop, stopVizLoop]);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    stopVizLoop();
  }, [stopVizLoop]);

  const skipPrev = useCallback(() => {
    if (currentTime > 3) {
      audioRef.current!.currentTime = 0;
      return;
    }
    if (currentIndex > 0) playTrackByIndex(currentIndex - 1);
  }, [currentTime, currentIndex, playTrackByIndex]);

  const skipNext = useCallback(() => {
    if (currentIndex < tracks.length - 1) playTrackByIndex(currentIndex + 1);
  }, [currentIndex, tracks.length, playTrackByIndex]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
  }, [duration]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    playSound("activate");

    const newTracks: Track[] = Array.from(files)
      .filter((f) => f.type.startsWith("audio/") || /\.(mp3|wav|ogg|flac|m4a|aac|wma|opus)$/i.test(f.name))
      .map((f) => ({
        file: f,
        name: f.name.replace(/\.[^/.]+$/, ""),
        url: URL.createObjectURL(f),
      }));

    if (newTracks.length === 0) return;

    setTracks((prev) => {
      const merged = [...prev, ...newTracks];
      // If no track is playing, start the first new one
      if (currentIndex < 0) {
        setTimeout(() => playTrackByIndex(prev.length), 50);
      }
      return merged;
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [currentIndex, playTrackByIndex]);

  const removeTrack = useCallback((idx: number) => {
    setTracks((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].url);
      next.splice(idx, 1);

      // Adjust current index
      if (idx < currentIndex) {
        setCurrentIndex((i) => i - 1);
      } else if (idx === currentIndex) {
        stopPlayback();
        setCurrentIndex(-1);
      }

      return next;
    });
  }, [currentIndex, stopPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVizLoop();
      tracks.forEach((t) => URL.revokeObjectURL(t.url));
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
    }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const maxViz = Math.max(255, ...vizData);

  return (
    <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm">
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />
      <div className="relative">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Audio System
            </span>
          </div>
          <button
            onClick={() => { playSound("click"); fileInputRef.current?.click(); }}
            className="flex items-center gap-1 rounded-md border jarvis-border-cyan bg-card/60 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-primary/80 transition hover:bg-primary/15 hover:text-primary"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {tracks.length === 0 ? (
          /* Empty state */
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary/20 py-6"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") fileInputRef.current?.click(); }}
          >
            <Music className="h-6 w-6 text-primary/30" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              No tracks loaded
            </span>
            <span className="font-mono text-[9px] text-muted-foreground/50">
              Click or drag audio files
            </span>
          </div>
        ) : (
          <>
            {/* Track name */}
            <div className="mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary anim-pulse-glow" />
              <span className="flex-1 truncate font-mono text-[11px] text-foreground">
                {currentTrack?.name ?? "No selection"}
              </span>
              {currentTrack && (
                <span className="font-mono text-[9px] text-primary/60">
                  {currentIndex + 1}/{tracks.length}
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div
              className="group relative mb-2 h-2 w-full cursor-pointer overflow-hidden rounded-full bg-primary/10"
              onClick={handleSeek}
              role="slider"
              aria-valuenow={currentTime}
              aria-valuemin={0}
              aria-valuemax={duration}
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ boxShadow: "0 0 8px oklch(0.85 0.19 193 / 60%)" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background opacity-0 transition-opacity group-hover:opacity-100"
                style={{ left: `${progress}%` }}
              />
            </div>

            {/* Time row */}
            <div className="mb-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>{fmtTime(currentTime)}</span>
              <span>{fmtTime(duration)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => { playSound("click"); skipPrev(); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border jarvis-border-cyan bg-card/60 text-primary/80 transition hover:bg-primary/15 hover:text-primary"
                disabled={tracks.length < 2}
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { playSound("click"); togglePlay(); }}
                className="flex h-10 w-10 items-center justify-center rounded-lg border jarvis-border-cyan bg-primary/15 text-primary transition hover:bg-primary/25 hover:jarvis-box-glow"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <button
                onClick={() => { playSound("click"); skipNext(); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border jarvis-border-cyan bg-card/60 text-primary/80 transition hover:bg-primary/15 hover:text-primary"
                disabled={tracks.length < 2}
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { playSound("click"); stopPlayback(); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border jarvis-border-cyan bg-card/60 text-primary/80 transition hover:bg-primary/15 hover:text-primary"
              >
                <Square className="h-3 w-3" />
              </button>
              <div className="ml-2 flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-primary/60" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-primary/20 accent-primary"
                />
              </div>
            </div>

            {/* Visualizer */}
            {isPlaying && (
              <div className="mt-3 flex h-8 items-end justify-center gap-[2px]">
                {Array.from(vizData).map((v, i) => {
                  const h = Math.max(4, (v / maxViz) * 100);
                  return (
                    <motion.div
                      key={i}
                      className="w-[3px] flex-shrink-0 rounded-t-sm bg-primary"
                      style={{
                        height: `${h}%`,
                        boxShadow: `0 0 4px oklch(0.85 0.19 193 / 50%)`,
                        opacity: 0.4 + (v / maxViz) * 0.6,
                      }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.05 }}
                    />
                  );
                })}
              </div>
            )}

            {/* Playlist toggle */}
            {tracks.length > 1 && (
              <button
                onClick={() => { playSound("click"); setShowPlaylist((v) => !v); }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 border-t jarvis-border-cyan pt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground transition hover:text-primary"
              >
                {showPlaylist ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Playlist ({tracks.length})
              </button>
            )}

            {/* Playlist */}
            <AnimatePresence>
              {showPlaylist && tracks.length > 1 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-1 max-h-40 overflow-y-auto jarvis-scroll"
                >
                  <div className="space-y-0.5 pt-1">
                    {tracks.map((track, i) => (
                      <div
                        key={track.url}
                        className={`group flex items-center gap-2 rounded px-2 py-1 font-mono text-[10px] transition cursor-pointer ${
                          i === currentIndex
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                        }`}
                        onClick={() => { playSound("click"); playTrackByIndex(i); }}
                      >
                        <span className="w-4 text-right text-[9px] opacity-50">
                          {i === currentIndex && isPlaying ? "▶" : i + 1}
                        </span>
                        <span className="flex-1 truncate">{track.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); playSound("click"); removeTrack(i); }}
                          className="h-4 w-4 flex-shrink-0 opacity-0 transition group-hover:opacity-60 hover:!opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}