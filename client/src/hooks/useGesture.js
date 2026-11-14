import { useState, useEffect, useRef, useCallback } from 'react';
import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';
import {
  POSE_HOLD_MS,
  GESTURE_COOLDOWN_MS,
  SWIPE_WINDOW_MS,
  SWIPE_THRESHOLD_X,
  MIN_GESTURE_CONFIDENCE,
  FAR_HAND_SIZE_THRESHOLD,
  NEAR_HAND_SIZE_THRESHOLD,
} from '../config.js';

/**
 * useGesture — Hand gesture recognition hook using MediaPipe Tasks Vision.
 *
 * Detects:
 *  1. Static poses (via MediaPipe GestureRecognizer, held for POSE_HOLD_MS ~600ms):
 *     - Open_Palm → pauseTimer ("Pause / Resume Timer")
 *     - Thumb_Up  → markDone   ("Done")
 *  2. Dynamic swipes (tracked from wrist landmark[0].x over SWIPE_WINDOW_MS ~500ms):
 *     - Swipe Right → nextStep ("Next Step")
 *     - Swipe Left  → prevStep ("Previous Step")
 *
 * Also estimates user distance ("near" vs "far") from the apparent hand size
 * in the camera frame, and counts low-confidence/incomplete gesture failures
 * for the Phase 5 Adaptation Engine.
 *
 * PRIVACY: All video frames are processed locally inside the browser.
 * Video is never recorded, stored, or transmitted anywhere.
 */
export default function useGesture({ enabled = true, onGesture, onFailure }) {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [error, setError] = useState(null);
  const [activePose, setActivePose] = useState(null); // e.g. 'Open_Palm', 'Thumb_Up', 'Swipe_Right'
  const [holdProgress, setHoldProgress] = useState(0); // 0.0 to 1.0 for the progress ring
  const [distance, setDistance] = useState('near');   // 'near' | 'far'
  const [simulatedDistance, setSimulatedDistance] = useState(null); // null | 'near' | 'far'
  const [lowLight, setLowLight] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognizerRef = useRef(null);
  const animFrameRef = useRef(null);

  // Tracking refs for hold timer, cooldown, and wrist history
  const currentPoseRef = useRef({ name: null, startTime: 0 });
  const lastTriggerTimeRef = useRef(0);
  const wristHistoryRef = useRef([]); // Array of { x, t }
  const lowConfStreakRef = useRef(0);
  const distanceRef = useRef('near');

  // Keep latest callbacks in refs so the animation loop never uses stale closures
  const onGestureRef = useRef(onGesture);
  const onFailureRef = useRef(onFailure);
  useEffect(() => {
    onGestureRef.current = onGesture;
    onFailureRef.current = onFailure;
  }, [onGesture, onFailure]);

  // --- Initialize MediaPipe GestureRecognizer & Webcam ---
  useEffect(() => {
    if (!enabled || !cameraEnabled) {
      setIsCameraReady(false);
      setActivePose(null);
      setHoldProgress(0);
      return;
    }

    let stream = null;
    let cancelled = false;

    async function init() {
      try {
        setError(null);

        // 1. Request webcam stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // 2. Load MediaPipe Vision WASM & GestureRecognizer model
        if (!recognizerRef.current) {
          const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
          );

          if (cancelled) return;

          recognizerRef.current = await GestureRecognizer.createFromOptions(
            vision,
            {
              baseOptions: {
                modelAssetPath:
                  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
                delegate: 'GPU',
              },
              runningMode: 'VIDEO',
              numHands: 1,
            }
          );
        }

        if (!cancelled) {
          setIsCameraReady(true);
          startDetectionLoop();
        }
      } catch (err) {
        if (!cancelled) {
          if (
            err.name === 'NotAllowedError' ||
            err.name === 'PermissionDeniedError'
          ) {
            setError(
              'Camera access was denied. Hand gestures are disabled, but voice and touch still work.'
            );
          } else {
            setError(
              'Camera or gesture model unavailable. Voice and touch controls remain active.'
            );
          }
          setIsCameraReady(false);
        }
      }
    }

    function startDetectionLoop() {
      let lastVideoTime = -1;

      const detectFrame = () => {
        if (cancelled) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const recognizer = recognizerRef.current;

        if (
          video &&
          recognizer &&
          video.readyState >= 2 &&
          video.currentTime !== lastVideoTime
        ) {
          lastVideoTime = video.currentTime;
          const now = performance.now();

          let results = null;
          try {
            results = recognizer.recognizeForVideo(video, now);
          } catch (_e) {
            // Ignore transient frame errors
          }

          if (results) {
            drawLandmarks(canvas, results.landmarks);
            processHandResults(results, now);
          }
        }

        animFrameRef.current = requestAnimationFrame(detectFrame);
      };

      animFrameRef.current = requestAnimationFrame(detectFrame);
    }

    init();

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [enabled, cameraEnabled]);

  /**
   * Process landmarks and gesture classifications from a single video frame.
   */
  function processHandResults(results, now) {
    const hasHand = results.landmarks && results.landmarks.length > 0;

    if (!hasHand) {
      // If user was mid-hold and dropped their hand early (>220ms but <600ms), count as a gesture miss
      if (
        currentPoseRef.current.name &&
        now - currentPoseRef.current.startTime > 220
      ) {
        onFailureRef.current?.('incomplete_hold');
      }
      currentPoseRef.current = { name: null, startTime: 0 };
      setActivePose(null);
      setHoldProgress(0);
      return;
    }

    const hand = results.landmarks[0]; // 21 3D landmarks normalized [0..1]

    // --- 1. Estimate User Distance from Hand Size ---
    // Measure bounding-box diagonal of the hand in normalized frame coordinates
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const pt of hand) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    const handSpan = Math.hypot(maxX - minX, maxY - minY);

    // Hysteresis on distance so it doesn't flicker between near and far
    if (handSpan < FAR_HAND_SIZE_THRESHOLD && distanceRef.current !== 'far') {
      distanceRef.current = 'far';
      setDistance('far');
    } else if (
      handSpan > NEAR_HAND_SIZE_THRESHOLD &&
      distanceRef.current !== 'near'
    ) {
      distanceRef.current = 'near';
      setDistance('near');
    }

    // --- 2. Check Cooldown ---
    if (now - lastTriggerTimeRef.current < GESTURE_COOLDOWN_MS) {
      setHoldProgress(0);
      return;
    }

    // --- 3. Swipe Detection (Wrist X movement over SWIPE_WINDOW_MS) ---
    // Note: Video preview is mirrored, so moving physical hand RIGHT decreases raw pt.x
    const wristX = hand[0].x;
    const history = wristHistoryRef.current;
    history.push({ x: wristX, t: now });

    // Keep only points within SWIPE_WINDOW_MS (500ms)
    while (history.length > 0 && now - history[0].t > SWIPE_WINDOW_MS) {
      history.shift();
    }

    if (history.length >= 4) {
      const deltaX = wristX - history[0].x;
      // Mirrored camera: negative deltaX = user swiped RIGHT → nextStep
      if (deltaX <= -SWIPE_THRESHOLD_X) {
        wristHistoryRef.current = [];
        lastTriggerTimeRef.current = now;
        currentPoseRef.current = { name: null, startTime: 0 };
        setActivePose('Swipe Right → Next');
        setHoldProgress(1);
        onGestureRef.current?.({
          gesture: 'Swipe_Right',
          action: 'nextStep',
          label: '👉 Swipe Right → Next step',
        });
        return;
      }
      // Mirrored camera: positive deltaX = user swiped LEFT → prevStep
      if (deltaX >= SWIPE_THRESHOLD_X) {
        wristHistoryRef.current = [];
        lastTriggerTimeRef.current = now;
        currentPoseRef.current = { name: null, startTime: 0 };
        setActivePose('← Swipe Left (Back)');
        setHoldProgress(1);
        onGestureRef.current?.({
          gesture: 'Swipe_Left',
          action: 'prevStep',
          label: '👈 Swipe Left → Previous step',
        });
        return;
      }
    }

    // --- 4. Static Pose Detection (Open_Palm, Thumb_Up) ---
    const topGesture = results.gestures?.[0]?.[0];
    if (!topGesture) {
      setActivePose(null);
      setHoldProgress(0);
      return;
    }

    const { categoryName, score } = topGesture;

    // Track low-confidence detections for adaptation engine
    if (categoryName !== 'None' && score < MIN_GESTURE_CONFIDENCE) {
      lowConfStreakRef.current += 1;
      if (lowConfStreakRef.current >= 15) {
        lowConfStreakRef.current = 0;
        setLowLight(true);
        onFailureRef.current?.('low_confidence');
      }
      return;
    } else if (score >= MIN_GESTURE_CONFIDENCE) {
      lowConfStreakRef.current = 0;
      setLowLight(false);
    }

    // Map MediaPipe pose names to SmartCook actions
    const poseMap = {
      Open_Palm: {
        action: 'pauseTimer',
        label: '✋ Open Palm → Pause/Resume Timer',
        display: '✋ Open Palm (Pause)',
      },
      Thumb_Up: {
        action: 'markDone',
        label: '👍 Thumbs Up → Done',
        display: '👍 Thumbs Up (Done)',
      },
    };

    const mapped = poseMap[categoryName];
    if (!mapped) {
      currentPoseRef.current = { name: null, startTime: 0 };
      setActivePose(null);
      setHoldProgress(0);
      return;
    }

    // Check how long this static pose has been continuously held
    if (currentPoseRef.current.name !== categoryName) {
      currentPoseRef.current = { name: categoryName, startTime: now };
      setActivePose(mapped.display);
      setHoldProgress(0.05);
    } else {
      const elapsed = now - currentPoseRef.current.startTime;
      const progress = Math.min(1, elapsed / POSE_HOLD_MS);
      setActivePose(mapped.display);
      setHoldProgress(progress);

      if (elapsed >= POSE_HOLD_MS) {
        // Pose held long enough — fire action!
        lastTriggerTimeRef.current = now;
        currentPoseRef.current = { name: null, startTime: 0 };
        wristHistoryRef.current = [];
        setHoldProgress(1);
        onGestureRef.current?.({
          gesture: categoryName,
          action: mapped.action,
          label: mapped.label,
        });
      }
    }
  }

  /** Toggle camera on/off */
  const toggleCamera = useCallback(() => {
    setCameraEnabled((prev) => !prev);
  }, []);

  return {
    videoRef,
    canvasRef,
    isCameraReady,
    cameraEnabled,
    toggleCamera,
    error,
    activePose,
    holdProgress,
    distance: simulatedDistance || distance,
    simulatedDistance,
    setSimulatedDistance,
    lowLight,
  };
}

/**
 * Draw hand landmarks and finger connections onto the overlay canvas.
 */
function drawLandmarks(canvas, landmarksList) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!landmarksList || landmarksList.length === 0) return;

  const hand = landmarksList[0];

  // Draw dots on each of the 21 hand landmarks
  ctx.fillStyle = '#ff6b35';
  for (const pt of hand) {
    const x = pt.x * canvas.width;
    const y = pt.y * canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
  }
}
