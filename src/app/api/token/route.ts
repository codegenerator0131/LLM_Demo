// src/app/api/token/route.ts
import { AccessToken } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Server environment variables not set' }, { status: 500 });
  }

  // Create the token
  const at = new AccessToken(apiKey, apiSecret, {
    identity: `user-${Math.floor(Math.random() * 1000)}`,
  });

  // Grant permissions
  at.addGrant({
    roomJoin: true,
    room: "voice-chat-room",
    canPublish: true,
    canSubscribe: true,
  });

  // Return the token as JSON
  return NextResponse.json({ token: await at.toJwt() });
}