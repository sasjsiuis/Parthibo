import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AudioStreamer } from './lib/audio';
import { Mic, MicOff, Loader2, BrainCircuit } from 'lucide-react';

const systemInstruction = `Role: You are "ProfX", a world-class Physics Specialist and interactive Voice AI Agent. Your goal is to make physics engaging, understandable, and deeply insightful for anyone you talk to.
Core Expertise: You have mastery over Classical Mechanics, Quantum Physics, Thermodynamics, Astrophysics, and General Relativity. Use E = mc^2 or other relevant formulas when necessary to explain concepts.
Language & Communication:
Bilingual Mastery: You must fluently switch between Bangla and English. If the user speaks in Bangla, reply in Bangla (using a natural, conversational tone). If they use "Banglish," respond accordingly.
Voice Optimized: Since this is a voice interaction, keep your explanations concise but deep. Avoid long walls of text. Use a friendly, encouraging, and slightly witty "Professor-like" personality.
Analogy King: Explain complex physics concepts using simple, real-life analogies (e.g., explaining time dilation using a moving train or a bouncing ball).
Session & Memory:
Treat every conversation as part of an ongoing learning journey.
Refer back to previous points in the session to maintain continuity.
Response Style:
Acknowledge: Start by validating the user's question.
Explain: Provide the core physics logic.
Example: Give a real-world application.
Engage: End with a thought-provoking question to keep the session alive.
Constraints:
Do not hallucinate facts. If a theory is still unproven (like String Theory), state it as a hypothesis.
Keep the tone professional yet accessible—like a mentor.`;

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  useEffect(() => {
    aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    audioStreamerRef.current = new AudioStreamer();
    
    return () => {
      disconnect();
    };
  }, []);

  const connect = async () => {
    if (!aiRef.current || !audioStreamerRef.current) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      audioStreamerRef.current.initPlayback();
      
      const sessionPromise = aiRef.current.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: systemInstruction,
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            audioStreamerRef.current?.startRecording((base64Data) => {
              sessionPromise.then((session) => {
                session.sendRealtimeInput([{
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64Data
                }]);
              }).catch(console.error);
            });
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsSpeaking(true);
              audioStreamerRef.current?.playAudioChunk(base64Audio);
              setTimeout(() => setIsSpeaking(false), 500);
            }
            
            if (message.serverContent?.interrupted) {
              audioStreamerRef.current?.clearPlaybackQueue();
            }
          },
          onclose: () => {
            disconnect();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection error occurred.");
            disconnect();
          }
        }
      });
      
      sessionRef.current = await sessionPromise;
      
    } catch (err: any) {
      console.error("Failed to connect:", err);
      setError(err.message || "Failed to connect to ProfX.");
      setIsConnecting(false);
      disconnect();
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
      sessionRef.current = null;
    }
    if (audioStreamerRef.current) {
      audioStreamerRef.current.stopRecording();
      audioStreamerRef.current.stopPlayback();
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full flex flex-col items-center space-y-12">
        
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <div className={`p-4 rounded-full ${isConnected ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400'} transition-colors duration-500`}>
              <BrainCircuit size={48} className={isSpeaking ? 'animate-pulse' : ''} />
            </div>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">ProfX</h1>
          <p className="text-zinc-400 text-lg">Your Personal Physics Mentor</p>
        </div>

        <div className="flex flex-col items-center space-y-6">
          <button
            onClick={isConnected ? disconnect : connect}
            disabled={isConnecting}
            className={`
              relative group flex items-center justify-center w-32 h-32 rounded-full 
              transition-all duration-300 ease-out
              ${isConnecting ? 'bg-zinc-800 cursor-not-allowed' : 
                isConnected ? 'bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500/50' : 
                'bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-500/25'}
            `}
          >
            {isConnecting ? (
              <Loader2 size={36} className="animate-spin text-zinc-400" />
            ) : isConnected ? (
              <MicOff size={36} className="text-red-500" />
            ) : (
              <Mic size={36} className="text-white" />
            )}
            
            {isConnected && !isSpeaking && (
              <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping" style={{ animationDuration: '3s' }}></div>
            )}
            {isSpeaking && (
              <div className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping" style={{ animationDuration: '1s' }}></div>
            )}
          </button>

          <div className="text-center h-8">
            {isConnecting && <p className="text-zinc-400 animate-pulse">Connecting to ProfX...</p>}
            {isConnected && <p className="text-indigo-400 font-medium">Listening...</p>}
            {!isConnected && !isConnecting && <p className="text-zinc-500">Tap to start session</p>}
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 w-full mt-8">
          <h3 className="text-sm font-medium text-zinc-300 mb-3 uppercase tracking-wider">Capabilities</h3>
          <ul className="space-y-2 text-sm text-zinc-500">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              Classical Mechanics & Quantum Physics
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              Thermodynamics & Astrophysics
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              Fluent in English & Bangla
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
