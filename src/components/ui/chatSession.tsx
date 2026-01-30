"use client";
import { useState, useEffect, useRef } from "react";
import * as faceapi from "face-api.js";
import {
  useVoiceAssistant,
  useTranscriptions,
  useLocalParticipant,
  BarVisualizer,
  useTracks,
  useDataChannel,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

interface ChatSessionProps {
  hasCamera: boolean;
  formData: {
    role: string;
    botName: string;
    userName: string;
    goal: string;
    totalTime: number;
  };
}

export default function ChatSessionUI({
  hasCamera,
  formData,
}: ChatSessionProps) {
  const { state, audioTrack } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [canActivate, setcanActivate] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [selectedLang, setSelectedLang] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");

  const [metricsState, setMetricsState] = useState<{
    llm: any;
    stt: any;
    vad: any;
  }>({
    llm: null,
    stt: null,
    vad: null,
  });

  type VoiceConfiguration = Record<string, Record<string, string[]>>;
  type LanguageConfiguration = Record<string, string>;
  const voiceData: VoiceConfiguration = {
    English: {
      "aura-2": [
        "amalthea",
        "andromeda",
        "apollo",
        "arcas",
        "aries",
        "asteria",
        "athena",
        "atlas",
        "aurora",
        "callista",
        "cora",
        "cordelia",
        "delia",
        "draco",
        "electra",
        "harmonia",
        "helena",
        "hera",
        "hermes",
        "hyperion",
        "iris",
        "janus",
        "juno",
        "jupiter",
        "luna",
        "mars",
        "minerva",
        "neptune",
        "odysseus",
        "ophelia",
        "orion",
        "orpheus",
        "pandora",
        "phoebe",
        "pluto",
        "saturn",
        "selene",
        "thalia",
        "theia",
        "vesta",
        "zeus",
      ],
    },
    Spanish: {
      "aura-2": [
        "sirio",
        "nestor",
        "carina",
        "celeste",
        "alvaro",
        "diana",
        "aquila",
        "selena",
        "estrella",
        "javier",
        "agustina",
        "antonia",
        "gloria",
        "luciano",
        "olivia",
        "silvia",
        "valerio",
      ],
    },
    German: {
      "aura-2": [
        "elara",
        "aurelia",
        "lara",
        "julius",
        "fabian",
        "kara",
        "viktoria",
      ],
    },
    French: { "aura-2": ["agathe", "hector"] },
    Dutch: {
      "aura-2": [
        "beatrix",
        "daphne",
        "cornelia",
        "sander",
        "hestia",
        "lars",
        "roman",
        "rhea",
        "leda",
      ],
    },
    Italian: {
      "aura-2": [
        "melia",
        "elio",
        "flavio",
        "maia",
        "cinzia",
        "cesare",
        "livia",
        "perseo",
        "dionisio",
        "demetra",
      ],
    },
    Japanese: { "aura-2": ["uzume", "ebisu", "fujin", "izanami", "ama"] },
  };
  const languageData: LanguageConfiguration = {
    English: "en",
    Spanish: "es",
    German: "de",
    French: "fr",
    Dutch: "nl",
    Italian: "it",
    Japanese: "ja",
  };

  const tracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: true }],
    { onlySubscribed: false }
  );

  // Find the track belonging to the local participant
  const localMicTrack = tracks.find((t) => t.participant.isLocal);
  // console.log(localMicTrack);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displaySizeRef = useRef({ width: 0, height: 0 });
  const emotionBuffer = useRef<faceapi.FaceExpressions[]>([]);
  const detectionCount = useRef(0);
  const totalAttempts = useRef(0);

  // 1. Create a reference for the bottom of the list
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 2. Helper function to scroll to the bottom
  const scrollToBottom = () => {
    // 'behavior: smooth' gives the animation effect
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // State Ref for access inside intervals/effects without dependencies
  const stateRef = useRef({
    elapsedSeconds: 0,
    latestEmo: null as faceapi.FaceExpressions | null,
    agentState: state, // Track agent state in ref
  });

  // Keep stateRef updated
  useEffect(() => {
    stateRef.current.agentState = state;
  }, [state]);

  const [realTimeEmo, setRealTimeEmo] =
    useState<faceapi.FaceExpressions | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Load models
  const options1 = new faceapi.TinyFaceDetectorOptions({
    inputSize: 512, // Must be a multiple of 32, e.g., 160, 224, 320, 416, 512.
    scoreThreshold: 0.5, // The confidence threshold.
  });
  const options2 = new faceapi.SsdMobilenetv1Options({
    minConfidence: 0.3,
    maxResults: 1,
  });
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Model Load Error:", err);
      }
    };
    loadModels();
  }, []);

  // Timer Logic
  useEffect(() => {
    if (!isAgentActive) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const newVal = prev + 1;
        stateRef.current.elapsedSeconds = newVal;
        return newVal;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isAgentActive]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = Math.min(
    (elapsedSeconds / formData.totalTime) * 100,
    100
  );

  // --- Metrics Handler ---
  useDataChannel("agent-metrics", (msg) => {
    try {
      const decoder = new TextDecoder();
      const payload = JSON.parse(decoder.decode(msg.payload));

      if (payload.type === "metrics") {
        const metric = payload.data;
        // console.log("New Metric:", metric);

        setMetricsState((prev) => {
          const newState = { ...prev };
          if (metric.type === "llm_metrics") newState.llm = metric;
          if (metric.type === "stt_metrics") newState.stt = metric;
          if (metric.type === "vad_metrics") newState.vad = metric;
          return newState;
        });
      }
    } catch (e) {
      console.error("Metrics parse error", e);
    }
  });

  // --- Handlers ---
  const activateAgent = () => {
    if (!localParticipant) return;
    setIsAgentActive(true);

    const payload = {
      type: "START_CHAT",
      payload: { ...formData, hasCamera },
    };
    const encoder = new TextEncoder();
    const encoded = encoder.encode(JSON.stringify(payload));

    // Reliable Start (3 attempts)
    const send = () =>
      localParticipant.publishData(encoded, { reliable: true });
    send();
    setTimeout(send, 1000);
    setTimeout(send, 2000);
  };

  const deactivateAgent = () => {
    setIsAgentActive(false);
    if (localParticipant) {
      const payload = { type: "STOP_CHAT" };
      const encoder = new TextEncoder();
      localParticipant.publishData(encoder.encode(JSON.stringify(payload)), {
        reliable: true,
      });
    }
  };

  // Helper: Send Sync Data
  const sendSyncData = () => {
    if (!localParticipant) return;
    const { elapsedSeconds: sec, latestEmo: emo } = stateRef.current;

    const emotionsStr = emo
      ? Object.entries(emo)
          .filter(([, v]) => v > 0.1) // Filter low confidence
          .map(([k, v]) => `${k}:${Math.round(v * 100)}%`)
          .join(", ")
      : "Neutral";

    const payload = {
      type: "metadata_sync",
      payload: {
        ...formData,
        hasCamera,
        emotions: emotionsStr,
        time_progress: `${formatTime(sec)} / ${formatTime(formData.totalTime)}`,
      },
    };

    const encoder = new TextEncoder();
    localParticipant.publishData(encoder.encode(JSON.stringify(payload)), {
      reliable: true,
    });
  };

  const handleVoiceChange = (m: string, v: string, l: string) => {
    if (m && v && l) {
      const payload = {
        type: "SET_VOICE",
        payload: {
          model: `${m}-${v}-${languageData[l]}`, // Format: [model]-[voice name]-[language]
        },
      };
      const encoder = new TextEncoder();
      localParticipant.publishData(encoder.encode(JSON.stringify(payload)), {
        reliable: true,
      });
    }
  };

  // 1. Face Detection Loop (OPTIMIZED: Runs every 1000ms instead of 200ms)

  useEffect(() => {
    if (!hasCamera || !modelsLoaded) return;
    let detectionInterval: NodeJS.Timeout;
    let stream: MediaStream;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current && canvasRef.current) {
              const displaySize = {
                width: videoRef.current.clientWidth,
                height: videoRef.current.clientHeight,
              };
              displaySizeRef.current = displaySize;
              faceapi.matchDimensions(canvasRef.current, displaySize);
            }
          };
        }
      } catch (e) {
        console.error("Camera error:", e);
        return;
      }

      // Reduced frequency to prevent CPU starvation (audio stutter)
      detectionInterval = setInterval(async () => {
        if (
          !videoRef.current ||
          videoRef.current.readyState !== 4 ||
          !canvasRef.current
        )
          return;

        totalAttempts.current++;
        // This is CPU heavy!
        const detections = await faceapi
          .detectSingleFace(videoRef.current, options2)
          .withFaceLandmarks()
          .withFaceExpressions();
        // console.log(detections);

        const ctx = canvasRef.current?.getContext("2d");
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (detections) {
          const resized = faceapi.resizeResults(
            detections,
            displaySizeRef.current
          );
          faceapi.draw.drawDetections(canvasRef.current, resized);

          setRealTimeEmo(detections.expressions); // Update UI
          stateRef.current.latestEmo = detections.expressions; // Update Ref for Sync

          emotionBuffer.current.push(detections.expressions);
          detectionCount.current++;
        }
      }, 1000); // Changed from 200 to 1000ms
    };
    startCamera();
    return () => {
      clearInterval(detectionInterval);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [hasCamera, modelsLoaded]);

  // 2. Smart Sync Logic
  // Syncs ONLY when user is speaking (listening state) or just finished
  useEffect(() => {
    if (!isAgentActive || !localParticipant) return;

    let syncInterval: NodeJS.Timeout;

    if (state === "listening") {
      // User is speaking. Sync every 1s to keep backend fresh.
      sendSyncData(); // Send immediate
      syncInterval = setInterval(sendSyncData, 1000);
    } else if (state === "thinking") {
      // User just finished speaking. Send FINAL update immediately before Agent replies.
      sendSyncData();
    }

    return () => clearInterval(syncInterval);
  }, [state, isAgentActive, localParticipant]); // Depends on state changes

  const transcriptions = useTranscriptions();
  useEffect(() => {
    scrollToBottom();
  }, [transcriptions]);

  return (
    <div className="grid grid-cols-12 gap-6 p-6 h-screen bg-zinc-950 text-white overflow-hidden">
      {/* LEFT COLUMN: USER FOCUS */}
      <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
        {/* 1. User Video (Square) */}
        <div className="aspect-square bg-black rounded-2xl overflow-hidden border border-zinc-800 relative shadow-2xl">
          {hasCamera ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-20"
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-700 text-sm italic">
              Camera Disabled
            </div>
          )}
        </div>

        {/* 2. User Bar Visualizer */}
        <div className="h-20 bg-zinc-900 rounded-2xl border border-zinc-800 p-3 flex flex-col shrink-0">
          <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 text-center">
            User Audio
          </h3>
          <div className="flex-1 w-full flex items-center justify-center">
            {localMicTrack ? (
              <BarVisualizer track={localMicTrack} />
            ) : (
              <div className="text-zinc-600 text-[10px] italic">Mic Off</div>
            )}
          </div>
        </div>

        {/* 3. Emotion Part (Horizontal Chips) */}
        <div className="flex-1 bg-zinc-900 rounded-2xl p-4 border border-zinc-800 overflow-y-auto">
          <h3 className="text-zinc-500 text-[10px] font-bold mb-3 uppercase tracking-widest">
            Sentiment Analysis
          </h3>
          {hasCamera && realTimeEmo ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(realTimeEmo).map(([emo, val]) => (
                <div
                  key={emo}
                  className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700/50 px-3 py-1.5 rounded-full"
                >
                  <span className="capitalize text-[10px] text-zinc-300 font-medium">
                    {emo}
                  </span>
                  <span className="text-blue-400 font-mono text-[10px] font-bold">
                    {Math.round(val * 100)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-600 italic text-[10px] text-center mt-2">
              {hasCamera ? "Awaiting face data..." : "Audio-only session"}
            </p>
          )}
        </div>
      </div>

      {/* MIDDLE COLUMN: CHAT & CONTROLS */}
      <div className="col-span-6 flex flex-col gap-4 h-[calc(100vh-2rem)] overflow-hidden">
        <div className="flex-1 bg-zinc-900/40 rounded-3xl border border-zinc-800 p-8 flex flex-col overflow-hidden">
          {/* 1. Header: Fixed */}
          <h2 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mb-8 text-center shrink-0">
            Session Goal: {formData.goal}
          </h2>

          {/* 2. Chat Area: Scrollable and Flexible */}
          {/* 2. Chat Area: Scrollable and Flexible */}
          <div className="flex-1 overflow-y-auto mb-6 pr-2 scroll-smooth custom-scrollbar">
            <div className="flex flex-col items-center min-h-full">
              {/* ... Status Indicator (Unchanged) ... */}
              <div className="h-24 flex items-center justify-center shrink-0">
                {isAgentActive ? (
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mb-4 animate-ping" />
                    <p className="text-3xl font-light text-zinc-100 tracking-tight">
                      {state === "speaking"
                        ? "Agent is talking..."
                        : "Listening..."}
                    </p>
                  </div>
                ) : (
                  <p className="text-zinc-600 italic text-lg font-light tracking-wide">
                    Ready to begin
                  </p>
                )}
              </div>

              {/* Transcriptions List */}
              <div className="w-full space-y-4 mt-8">
                {transcriptions.map((t) => {
                  const speaker = t.participantInfo.identity;
                  const isAgent = speaker.toLowerCase().includes("agent");

                  return (
                    <div
                      key={t.streamInfo.id}
                      className={`flex flex-col ${
                        isAgent ? "items-start" : "items-end"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] p-4 rounded-2xl border ${
                          isAgent
                            ? "bg-zinc-800/40 border-zinc-700 rounded-tl-none"
                            : "bg-blue-600/10 border-blue-500/30 rounded-tr-none"
                        }`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                          {speaker}
                        </p>
                        <p className="text-zinc-200 text-sm leading-relaxed">
                          {t.text}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* 3. INVISIBLE DIV TO TRACK SCROLL POSITION */}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          {/* 3. Bottom Controls: Fixed at bottom */}
          <div className="shrink-0 bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800/50">
            <div className="grid grid-cols-3 gap-3">
              {/* Language Select */}
              <select
                className="bg-zinc-800 border border-zinc-700 p-2 rounded text-xs text-zinc-200 outline-none"
                value={selectedLang}
                onChange={(e) => {
                  setSelectedLang(e.target.value);
                  setSelectedModel("");
                  setSelectedVoice("");
                  setcanActivate(false);
                }}
              >
                <option value="">Language</option>
                {Object.keys(voiceData).map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>

              {/* Model Select */}
              <select
                className="bg-zinc-800 border border-zinc-700 p-2 rounded text-xs text-zinc-200 outline-none disabled:opacity-30"
                value={selectedModel}
                disabled={!selectedLang}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  setSelectedVoice("");
                  setcanActivate(false);
                }}
              >
                <option value="">Model</option>
                {selectedLang &&
                  Object.keys(voiceData[selectedLang]).map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
              </select>

              {/* Voice Select */}
              <select
                className="bg-zinc-800 border border-zinc-700 p-2 rounded text-xs text-zinc-200 outline-none disabled:opacity-30"
                value={selectedVoice}
                disabled={!selectedModel}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedVoice(v);
                  if (v !== "") {
                    setcanActivate(true);
                    handleVoiceChange(selectedModel, v, selectedLang);
                  } else {
                    setcanActivate(false);
                  }
                }}
              >
                <option value="">Voice</option>
                {selectedModel &&
                  voiceData[selectedLang][selectedModel].map(
                    (voice: string) => (
                      <option key={voice} value={voice}>
                        {voice}
                      </option>
                    )
                  )}
              </select>
            </div>

            <div className="flex justify-center mt-6 mb-6">
              {!isAgentActive ? (
                <button
                  onClick={activateAgent}
                  disabled={!canActivate}
                  className={`${
                    canActivate
                      ? "bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-500/10 text-white"
                      : "bg-zinc-800 cursor-not-allowed opacity-50 text-zinc-500"
                  } px-12 py-3 rounded-full font-bold transition-all text-sm`}
                >
                  {canActivate
                    ? "Activate Voice Agent"
                    : "Select Voice to Start"}
                </button>
              ) : (
                <button
                  onClick={deactivateAgent}
                  className="bg-zinc-800 hover:bg-red-600/20 border border-zinc-700 hover:border-red-600/50 text-zinc-400 hover:text-red-500 px-12 py-3 rounded-full font-bold transition-all text-sm"
                >
                  Deactivate Session
                </button>
              )}
            </div>

            <div className="space-y-3 max-w-sm mx-auto">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                  Progress
                </span>
                <span className="font-mono text-[10px] text-blue-400">
                  {formatTime(elapsedSeconds)} /{" "}
                  {formatTime(formData.totalTime)}
                </span>
              </div>
              <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-1000 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: AGENT FOCUS */}
      <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
        {/* 1. Agent Avatar Placeholder (Reduced Height) */}
        {/* Changed from aspect-square to h-64 to save vertical space */}
        <div className="h-64 bg-zinc-900 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center p-4 text-center shrink-0">
          <div
            className={`w-28 h-28 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${
              isAgentActive && state === "speaking"
                ? "bg-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.3)]"
                : "bg-zinc-800"
            }`}
          >
            <span className="text-4xl">🤖</span>
          </div>
          <p className="text-sm font-bold text-zinc-300">AI Counselor</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isAgentActive ? "bg-green-500" : "bg-zinc-600"
              }`}
            />
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
              {isAgentActive ? "Online" : "Standby"}
            </span>
          </div>
        </div>

        {/* 2. Agent Bar Visualizer */}
        <div className="h-20 bg-zinc-900 rounded-2xl border border-zinc-800 p-3 flex flex-col items-center justify-center shrink-0">
          <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
            Agent Output
          </h3>
          <div className="flex-1 w-full flex items-center justify-center">
            {localMicTrack ? (
              <BarVisualizer track={audioTrack} />
            ) : (
              <div className="text-zinc-600 text-[10px] italic">Mic Off</div>
            )}
          </div>
        </div>

        {/* 3. Usage Metrics (Expanded) */}
        <div className="flex-1 bg-zinc-900 rounded-2xl p-6 border border-zinc-800 overflow-y-auto">
          <h3 className="text-zinc-500 text-[10px] font-bold mb-4 uppercase tracking-widest border-b border-zinc-800 pb-2">
            Real-time Metrics
          </h3>
          <div className="space-y-4">
            {/* LLM Section */}
            <div>
              <p className="text-[9px] text-zinc-500 mb-1 font-bold">
                LLM (OpenAI)
              </p>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-400">
                    Time to First Token
                  </span>
                  <span className="text-[10px] font-mono text-green-400">
                    {metricsState.llm?.ttftMs
                      ? `${metricsState.llm.ttftMs}ms`
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-400">Tokens/sec</span>
                  <span className="text-[10px] font-mono text-zinc-300">
                    {metricsState.llm?.tokensPerSecond
                      ? Math.round(metricsState.llm.tokensPerSecond)
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-400">
                    Total Tokens
                  </span>
                  <span className="text-[10px] font-mono text-zinc-300">
                    {metricsState.llm?.totalTokens || "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* STT Section */}
            <div>
              <p className="text-[9px] text-zinc-500 mb-1 font-bold">
                STT (Deepgram)
              </p>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-400">Duration</span>
                  <span className="text-[10px] font-mono text-blue-400">
                    {metricsState.stt?.audioDurationMs
                      ? `${metricsState.stt.audioDurationMs}ms`
                      : "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* VAD Section */}
            <div>
              <p className="text-[9px] text-zinc-500 mb-1 font-bold">
                VAD (Silero)
              </p>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-400">
                    Inference Time
                  </span>
                  <span className="text-[10px] font-mono text-yellow-500">
                    {metricsState.vad?.inferenceDurationTotalMs
                      ? `${metricsState.vad.inferenceDurationTotalMs}ms`
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
