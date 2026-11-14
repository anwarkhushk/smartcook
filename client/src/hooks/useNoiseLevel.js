import { useState, useEffect, useRef } from 'react';
import {
  NOISE_HIGH_THRESHOLD,
  NOISE_LOW_THRESHOLD,
  NOISE_HOLD_MS,
} from '../config.js';

/**
 * useNoiseLevel — measures ambient room volume locally using Web Audio API.
 *
 * Uses AudioContext + AnalyserNode to compute the root-mean-square (RMS)
 * volume on a 0–100 scale.
 *
 * PRIVACY: Audio is analyzed strictly in real-time memory. Nothing is
 * ever recorded, stored, or uploaded.
 *
 * Includes hysteresis so a brief sound (e.g. setting down a spoon) does
 * not cause the UI to flicker into "Noisy Room" mode.
 *
 * @param {boolean} enabled — Whether to monitor microphone volume
 */
export default function useNoiseLevel(enabled = true) {
  const [volume, setVolume] = useState(0);          // 0 to 100
  const [isNoisy, setIsNoisy] = useState(false);    // smoothed noisy flag
  const [simulatedNoisy, setSimulatedNoisy] = useState(false); // manual override for viva/demo

  const highSinceRef = useRef(null);
  const lowSinceRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setVolume(0);
      setIsNoisy(false);
      return;
    }

    let audioCtx = null;
    let stream = null;
    let intervalId = null;
    let cancelled = false;

    async function startMeter() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false, // keep raw ambient room level measurable
          },
          video: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Sample volume 4 times per second (every 250ms)
        intervalId = setInterval(() => {
          analyser.getByteTimeDomainData(dataArray);

          // Compute RMS amplitude from waveform (centered at 128)
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const centered = (dataArray[i] - 128) / 128;
            sumSquares += centered * centered;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          const scaledVolume = Math.min(100, Math.round(rms * 260));
          setVolume(scaledVolume);

          // Hysteresis logic for isNoisy
          const now = Date.now();
          if (scaledVolume >= NOISE_HIGH_THRESHOLD) {
            lowSinceRef.current = null;
            if (!highSinceRef.current) {
              highSinceRef.current = now;
            } else if (now - highSinceRef.current >= NOISE_HOLD_MS) {
              setIsNoisy(true);
            }
          } else if (scaledVolume <= NOISE_LOW_THRESHOLD) {
            highSinceRef.current = null;
            if (!lowSinceRef.current) {
              lowSinceRef.current = now;
            } else if (now - lowSinceRef.current >= NOISE_HOLD_MS) {
              setIsNoisy(false);
            }
          }
        }, 250);
      } catch (_err) {
        // If mic is denied or unavailable, fail silently (VoiceStatus already informs the user)
      }
    }

    startMeter();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [enabled]);

  return {
    volume: simulatedNoisy ? 75 : volume,
    isNoisy: simulatedNoisy || isNoisy,
    simulatedNoisy,
    setSimulatedNoisy,
  };
}
