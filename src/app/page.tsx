"use client";

import { useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";

import ChatSessionUI from "../components/ui/chatSession";

export default function UnifiedChatbot() {
  const [step, setStep] = useState(1); // 1: Mic, 2: Cam, 3: Info, 4: Chat
  const [token, setToken] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [formData, setFormData] = useState({
    role: "job interviewer",
    botName: "Tina",
    userName: "Masoud",
    goal: "Conducting a structured interview to evaluate the subject's core competencies and technical proficiency.",
    totalTime: 300,
  });
  const roles = {
    jobInterviewer: "job interviewer",
    travelCounselor: "travel counselor",
    personalAssistant: "personal assistant",
    englishLanguageTutor: "english language tutor",
  } as const; // 'as const' makes the keys specific types rather than general strings

  const goals = {
    jobInterviewer:
      "Conducting a structured interview to evaluate the subject's core competencies and technical proficiency.",
    travelCounselor:
      "Planning a detailed itinerary and providing logistical advice for upcoming international travel.",
    personalAssistant:
      "Managing daily schedules, organizing tasks, and streamlining administrative workflows efficiently.",
    englishLanguageTutor:
      "Improving conversational fluency and correcting grammatical structures through interactive dialogue.",
  } as const;

  // Permission Workflow (Steps 1-4)
  const handleMic = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setStep(2);
    } catch {
      alert("Microphone required to proceed.");
    }
  };

  const handleCam = async (allow: boolean) => {
    if (allow) {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCamera(true);
      } catch (e) {
        setHasCamera(false);
      }
    }
    setStep(3);
  };

  const connectToAgent = async () => {
    const resp = await fetch("/api/token");
    const data = await resp.json();
    setToken(data.token);
    setStep(4);
  };

  if (step < 4) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white p-6">
        <div className="w-full max-w-md space-y-6 bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
          {step === 1 && (
            <button
              onClick={handleMic}
              className="w-full bg-blue-600 py-3 rounded-lg font-bold"
            >
              Allow Microphone
            </button>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-center">
                Would you like to use your camera for emotional feedback?
              </h2>
              <div className="flex gap-4">
                <button
                  onClick={() => handleCam(true)}
                  className="flex-1 bg-green-600 py-2 rounded-lg"
                >
                  Yes
                </button>
                <button
                  onClick={() => handleCam(false)}
                  className="flex-1 bg-zinc-700 py-2 rounded-lg"
                >
                  No (Audio Only)
                </button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest ml-1 font-bold">
                  Select Agent Role
                </label>
                <select
                  className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={
                    Object.keys(roles).find(
                      (key) =>
                        roles[key as keyof typeof roles] === formData.role
                    ) || ""
                  }
                  onChange={(e) => {
                    // Cast the string value to the specific keys of our object
                    const selectedKey = e.target.value as keyof typeof roles;

                    setFormData({
                      ...formData,
                      role: roles[selectedKey],
                      goal: goals[selectedKey],
                    });
                  }}
                >
                  <option value="" disabled>
                    Select Bot Role
                  </option>
                  {Object.entries(roles).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* User Name Input (Kept as input for flexibility, or change to select if users are fixed) */}
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest ml-1 font-bold">
                  Your Name
                </label>
                <input
                  className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Enter your name"
                  value={formData.userName}
                  onChange={(e) =>
                    setFormData({ ...formData, userName: e.target.value })
                  }
                />
              </div>
              {/* Bot Name Input (Kept as input for flexibility, or change to select if users are fixed) */}
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest ml-1 font-bold">
                  Bot Name
                </label>
                <input
                  className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Enter bot name"
                  value={formData.botName}
                  onChange={(e) =>
                    setFormData({ ...formData, botName: e.target.value })
                  }
                />
              </div>
              {/* Time based on seconds) */}
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest ml-1 font-bold">
                  Duration (seconds)
                </label>
                <input
                  className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Enter your name"
                  value={formData.totalTime}
                  onChange={(e) =>
                    setFormData({ ...formData, userName: e.target.value })
                  }
                />
              </div>

              {/* Dynamic Goal Display (Read-only as it's now tied to the Role) */}
              {formData.goal && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                  <p className="text-[10px] text-indigo-400 uppercase font-bold mb-1">
                    Assigned Goal:
                  </p>
                  <p className="text-xs text-zinc-300 leading-relaxed italic">
                    "{formData.goal}"
                  </p>
                </div>
              )}

              <button
                onClick={connectToAgent}
                className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl mt-4 font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
              >
                Start Session
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token!}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true}
      audio={true}
      video={hasCamera}
    >
      <ChatSessionUI hasCamera={hasCamera} formData={formData} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
