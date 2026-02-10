import {
  type JobContext,
  type JobProcess,
  defineAgent,
  WorkerOptions,
  cli,
  voice,
  llm,
  initializeLogger,
} from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as openai from "@livekit/agents-plugin-openai";
import * as silero from "@livekit/agents-plugin-silero";
import * as dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: ".env.local" });

class ContextAwareAgent extends voice.Agent {
  private sessionData: any;

  constructor(sessionData: any) {
    // 2. Enhance Instructions based on hasCamera scenario
    let instructions = `You are ${sessionData.role} named ${sessionData.botName}. 
    You are talking to ${sessionData.userName}.
    Goal: ${sessionData.goal}.`;

    if (sessionData.hasCamera) {
      // Scenario 1: Camera ON - Emotional Intelligence
      instructions += `
      PRIORITY: Achieve the goal within the time limit.
      
      EMOTIONAL INTELLIGENCE RULES:
      1. You have access to the user's facial emotions (provided in context).
      2. Monitor emotions closely.
      3. IF the user is ANGRY, SAD, or SURPRISED:
         - Acknowledge the emotion empathetically (e.g., "I notice you seem a bit frustrated...").
         - Suggest a specific action to help them relax or feel better (e.g., "Let's take a breath" or "I can simplify this").
         - THEN guide them back to the Goal.
      4. IF the user is HAPPY or NEUTRAL:
         - Continue efficiently towards the goal.
      `;
    } else {
      // Scenario 2: Camera OFF - Strict Execution
      instructions += `
      PRIORITY: Strictly achieve the goal.
      
      EXECUTION RULES:
      1. Focus purely on the objective.
      2. Do not deviate into small talk unless it serves the goal.
      3. Be concise and professional.
      `;
    }

    super({
      instructions: instructions,
    });
    this.sessionData = sessionData;
  }

  async onUserTurnCompleted(
    turnCtx: llm.ChatContext,
    _newMessage: llm.ChatMessage
  ): Promise<void> {
    // console.log(
    //   ">> [PRE-RESPONSE LOG] Current SessionData:",
    //   JSON.stringify(this.sessionData, null, 2)
    // );

    let contextMsg = "";

    if (this.sessionData.hasCamera) {
      contextMsg = `[System Context]
      Time Progress: ${this.sessionData.time_progress}
      Current User Emotions: ${this.sessionData.emotions}
      Camera Visibility: ${this.sessionData.visibility}%
      Reminder: If emotions are negative, de-escalate.`;
    } else {
      contextMsg = `[System Context]
      Time Progress: ${this.sessionData.time_progress}
      Camera: Inactive (Rely on voice tone only).`;
    }

    turnCtx.addMessage({
      role: "system",
      content: contextMsg,
    });
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    // console.log("Worker Joined Room");
    // initializeLogger({ pretty: true });
    // await ctx.connect();

    // Shared Session Data
    const sessionData = {
      role: "Assistant",
      botName: "AI",
      userName: "User",
      userIdentity: "user-",
      goal: "General Chat",
      emotions: "None",
      visibility: 100,
      hasCamera: false,
      time_progress: "0:00 / 0:00",
    };

    // Initialize Session
    const session = new voice.AgentSession({
      stt: new deepgram.STT(),
      llm: new openai.LLM({ model: "gpt-4o-mini" }),
      tts: new deepgram.TTS(),
      vad: ctx.proc.userData.vad! as silero.VAD,
    });

    const agent = new ContextAwareAgent(sessionData);

    // --- PAUSE / RESUME LOGIC (Using AudioEnabled) ---
    // Default to DISABLED (Muted) until explicitly started
    // Note: We can't set this before start(), but we can set it immediately after.
    let isActive = false;
    let isDeactivatedBefore = false;

    const activateAgent = async () => {
      if (isActive) return;
      // console.log(">>> ACTIVATING AGENT (Unmuting)");
      // Enable Listening
      // session.input might be undefined before start(), but we call this after start()
      session.input.setAudioEnabled(true);
      session.output.setAudioEnabled(true);
      session.output.setTranscriptionEnabled(true);
      isActive = true;

      if (isDeactivatedBefore) {
        try {
          session.generateReply({
            userInput:
              "[System Note: The conversation was paused, and you are now resuming. Greet the user back and smoothly continue the conversation from where you left off.]",
          });
        } catch (e) {}
      } else {
        session.say(
          `Hi ${sessionData.userName}, I am ${sessionData.botName}. My goal for this session is ${sessionData.goal}. Shall we begin?`,
          { allowInterruptions: true }
        );
      }
    };

    const deactivateAgent = async () => {
      if (!isActive) return;
      // console.log(">>> DEACTIVATING AGENT (Muting)");
      // Stop current speech
      session.interrupt();
      isDeactivatedBefore = true;

      // Disable Listening (Stop STT/LLM triggers)
      session.input.setAudioEnabled(false);
      session.output.setAudioEnabled(false);
      session.output.setTranscriptionEnabled(false);
      isActive = false;

      session.say("Pausing now.", { allowInterruptions: true });
    };

    // --- COMMAND LISTENER ---
    const decoder = new TextDecoder();
    ctx.room.on("dataReceived", async (payload) => {
      try {
        const data = JSON.parse(decoder.decode(payload));
        if (data.type === "START_CHAT") {
          if (data.payload) Object.assign(sessionData, data.payload);
          await activateAgent();
        } else if (data.type === "STOP_CHAT") {
          await deactivateAgent();
        } else if (data.type === "metadata_sync") {
          if (data.payload) Object.assign(sessionData, data.payload);
        } else if (data.type === "SET_VOICE") {
          const { model } = data.payload;
          // Stop current speech cleanly
          session.interrupt();
          // Replace TTS with new voice
          session.tts = new deepgram.TTS({
            model: model, // must be a valid Deepgram voice
          });
          // Optional confirmation
          // console.log(">>> voice changed to:", model);
        }
      } catch (e) {}
    });

    // ---Metric logics---
    session.on(voice.AgentSessionEventTypes.MetricsCollected, async (ev) => {
      const payload = JSON.stringify({
        type: "metrics",
        data: ev.metrics, // Contains ttft, durations, token counts, etc.
      });

      const encoder = new TextEncoder();
      await ctx.room.localParticipant?.publishData(encoder.encode(payload), {
        reliable: true,
        topic: "agent-metrics", // Specific topic for filtering
      });
    });

    // --- DISCONNECT LOGIC ---
    // Detect when the user (Frontend) leaves or refreshes the page
    ctx.room.on("participantDisconnected", (participant) => {
      // console.log(`Participant ${participant.identity} disconnected.`);

      // Ideally, check if it's the user you are talking to
      // But for 1-on-1 sessions, if ANYONE leaves, we should probably stop.
      if (
        participant.identity === sessionData.userIdentity ||
        participant.identity !== ctx.agent?.identity
      ) {
        // console.log(
        //   "User disconnected. Shutting down agent session for a fresh start."
        // );

        // This closes the agent's connection to the room.
        // The Job will end, and a new Job will start when the user returns.
        ctx.room.disconnect();
      }
    });

    // --- SILENCE LOGIC ---
    let lastActivity = Date.now();
    let isAgentBusy = false;

    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
      if (ev.newState === "speaking" || ev.newState === "thinking") {
        isAgentBusy = true;
        lastActivity = Date.now();
      } else {
        isAgentBusy = false;
        lastActivity = Date.now();
      }
    });

    session.on(voice.AgentSessionEventTypes.UserStateChanged, (ev) => {
      if (ev.newState === "speaking" || ev.newState === "listening") {
        lastActivity = Date.now();
      }
    });

    const silenceInterval = setInterval(async () => {
      // CRITICAL: Only run if Active (Unmuted) and Not Busy
      if (!isActive || isAgentBusy) return;

      const timeSinceLastActivity = Date.now() - lastActivity;
      if (timeSinceLastActivity > 15000) {
        // console.log("Silence detected. Proactively replying.");
        lastActivity = Date.now();
        try {
          session.generateReply({
            userInput:
              "[System Note: User has been silent for 10s. Proactively follow up.]",
          });
        } catch (e) {}
      }
    }, 1000);

    ctx.room.on("disconnected", () => clearInterval(silenceInterval));

    // console.log("Agent Ready & Waiting...");

    // Start the session
    await session.start({ agent, room: ctx.room });

    // IMMEDIATELY Mute until "Activate" is clicked
    // This ensures it doesn't start listening/talking until the frontend says so.
    session.input?.setAudioEnabled(false);
    isActive = false;
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
