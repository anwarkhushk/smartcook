import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useTimer — countdown timer hook
 *
 * Provides: remaining seconds, running/finished state,
 * and start/pause/resume/reset controls.
 * Plays a beep sound when the timer reaches zero.
 */
export default function useTimer() {
  const [remaining, setRemaining] = useState(0);   // seconds left
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const intervalRef = useRef(null);

  // Clear the interval on unmount
  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  // Core countdown effect
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          // Timer done!
          clearInterval(intervalRef.current);
          setIsRunning(false);
          setIsFinished(true);
          playBeep();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  /** Start a new countdown from the given number of seconds */
  const start = useCallback((seconds) => {
    clearInterval(intervalRef.current);
    setRemaining(seconds);
    setIsFinished(false);
    setIsRunning(true);
  }, []);

  /** Pause the countdown */
  const pause = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
  }, []);

  /** Resume a paused countdown */
  const resume = useCallback(() => {
    if (remaining > 0 && !isRunning) {
      setIsRunning(true);
    }
  }, [remaining, isRunning]);

  /** Reset the timer to zero */
  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    setRemaining(0);
    setIsRunning(false);
    setIsFinished(false);
  }, []);

  return { remaining, isRunning, isFinished, start, pause, resume, reset };
}

/**
 * Play a short beep using the Web Audio API.
 * No external audio files needed.
 */
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.frequency.value = 800;  // Hz
    oscillator.type = 'square';
    gain.gain.value = 0.3;             // not too loud

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    // Play three short beeps
    setTimeout(() => { gain.gain.value = 0; }, 200);
    setTimeout(() => { gain.gain.value = 0.3; }, 350);
    setTimeout(() => { gain.gain.value = 0; }, 550);
    setTimeout(() => { gain.gain.value = 0.3; }, 700);
    setTimeout(() => { gain.gain.value = 0; }, 900);
    setTimeout(() => {
      oscillator.stop();
      ctx.close();
    }, 1000);
  } catch (e) {
    // Fallback: if Web Audio fails, just log it
    console.warn('Could not play beep:', e);
  }
}

