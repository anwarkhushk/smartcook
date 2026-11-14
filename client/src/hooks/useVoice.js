import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useVoice — custom hook for voice input (SpeechRecognition) and
 * text-to-speech (speechSynthesis).
 *
 * SpeechRecognition runs in continuous mode and auto-restarts if it
 * stops unexpectedly (Chrome sometimes does this after silence).
 *
 * IMPORTANT: while the app is speaking (TTS), recognition is paused
 * so the mic doesn't hear the app's own voice. Listening resumes
 * 500ms after the utterance ends.
 *
 * Privacy: no audio is recorded or uploaded by this app.
 * The browser sends audio to its own cloud speech service.
 */
export default function useVoice() {
  // --- State ---
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');       // last final result
  const [interimText, setInterimText] = useState('');      // live partial result
  const [transcriptId, setTranscriptId] = useState(0);     // bumped on each new final result
  const [error, setError] = useState(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // --- Refs ---
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);  // low-level: should recognition auto-restart right now?
  const userWantsListenRef = useRef(false); // user-level: did the user enable listening?
  const resumeTimerRef = useRef(null);     // timeout ID for resuming after speech

  // Check browser support
  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // --- Set up SpeechRecognition once on mount ---
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;       // keep listening until we stop
    recognition.interimResults = true;   // show partial results live
    recognition.lang = 'en-US';

    // --- Event handlers ---

    recognition.onresult = (event) => {
      let finalText = '';
      let interimResult = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimResult += result[0].transcript;
        }
      }

      // Update interim text (shown live in the UI)
      setInterimText(interimResult);

      // If we got a final result, store it and bump the ID
      if (finalText) {
        setTranscript(finalText.trim().toLowerCase());
        setTranscriptId((prev) => prev + 1);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError(
          'Microphone access was denied. Please allow mic access in your browser settings and reload.'
        );
        shouldListenRef.current = false;
        userWantsListenRef.current = false;
        setIsListening(false);
      } else if (event.error === 'no-speech') {
        // Normal — user was quiet. Don't show an error.
      } else if (event.error === 'aborted') {
        // We aborted intentionally (stopListening or pausing for TTS). Ignore.
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Chrome sometimes stops recognition after silence.
      // Auto-restart if we still want to listen.
      if (shouldListenRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Already running — ignore
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    // Cleanup on unmount
    return () => {
      shouldListenRef.current = false;
      userWantsListenRef.current = false;
      clearTimeout(resumeTimerRef.current);
      recognition.abort();
    };
  }, [isSupported]);

  // --- Controls ---

  /** Start continuous listening */
  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    userWantsListenRef.current = true;
    shouldListenRef.current = true;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      // Already running — just update state
      setIsListening(true);
    }
  }, []);

  /** Stop listening (user toggled mic off) */
  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    userWantsListenRef.current = false;
    shouldListenRef.current = false;
    clearTimeout(resumeTimerRef.current);
    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  /**
   * Speak text aloud using the browser's TTS engine.
   *
   * While speaking, recognition is PAUSED so the mic doesn't
   * hear the app's own voice. Listening resumes 500ms after
   * the utterance ends (only if the user had listening enabled).
   */
  const speak = useCallback(
    (text) => {
      if (!ttsEnabled || !('speechSynthesis' in window)) return;

      // Cancel any pending resume and any ongoing speech
      clearTimeout(resumeTimerRef.current);
      window.speechSynthesis.cancel();

      // Pause recognition while speaking
      if (recognitionRef.current && shouldListenRef.current) {
        shouldListenRef.current = false;
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Not running — fine
        }
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95; // slightly slower for clarity while cooking

      // Resume listening 500ms after speaking ends
      const resumeAfterSpeech = () => {
        if (userWantsListenRef.current) {
          resumeTimerRef.current = setTimeout(() => {
            shouldListenRef.current = true;
            try {
              recognitionRef.current.start();
              setIsListening(true);
            } catch (e) {
              // Already running — fine
            }
          }, 500);
        }
      };

      utterance.onend = resumeAfterSpeech;
      utterance.onerror = resumeAfterSpeech; // also resume on TTS error

      window.speechSynthesis.speak(utterance);
    },
    [ttsEnabled]
  );

  /** Toggle text-to-speech on/off */
  const toggleTts = useCallback(() => {
    setTtsEnabled((prev) => {
      if (prev) window.speechSynthesis.cancel(); // stop any current speech
      return !prev;
    });
  }, []);

  return {
    isSupported,
    isListening,
    transcript,       // the last final recognized text (lowercase)
    interimText,      // current partial recognition (shown live)
    transcriptId,     // increments on each new final result (used as useEffect trigger)
    error,
    ttsEnabled,
    startListening,
    stopListening,
    speak,
    toggleTts,
  };
}
