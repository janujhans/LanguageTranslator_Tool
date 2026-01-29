
import { GoogleGenAI, Modality } from '@google/genai';
import React, { useEffect, useRef, useState } from 'react';
import { decodeAudioToBuffer, decodeBase64Audio, encodeAudioChunk } from '../services/geminiService';

interface VoiceModeProps {
  sourceLang: string;
  targetLang: string;
}

interface TranscriptLine {
  text: string;
  role: 'user' | 'model';
}

const VoiceMode: React.FC<VoiceModeProps> = ({ sourceLang, targetLang }) => {
  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking' | 'thinking'>('idle');
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  
  const sessionRef = useRef<any>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentTranscriptionRef = useRef({ user: '', model: '' });
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Auto-scroll transcripts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, status]);

  const startLive = async () => {
    if (isLive) return;
    
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      alert("API Key is missing. Live features disabled.");
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsLive(true);
            setStatus('listening');
            
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              // Only send if session is active
              if (sessionRef.current) {
                const inputData = e.inputBuffer.getChannelData(0);
                const base64 = encodeAudioChunk(inputData);
                sessionRef.current.sendRealtimeInput({ 
                  media: { data: base64, mimeType: 'audio/pcm;rate=16000' } 
                });
              }
            };
            
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: any) => {
            // 1. Handle Transcriptions
            if (msg.serverContent?.inputTranscription) {
              currentTranscriptionRef.current.user += msg.serverContent.inputTranscription.text;
              setStatus('thinking');
            }
            if (msg.serverContent?.outputTranscription) {
              currentTranscriptionRef.current.model += msg.serverContent.outputTranscription.text;
              setStatus('speaking');
            }

            if (msg.serverContent?.turnComplete) {
              const userText = currentTranscriptionRef.current.user.trim();
              const modelText = currentTranscriptionRef.current.model.trim();
              
              if (userText || modelText) {
                setTranscripts(prev => [
                  ...prev, 
                  ...(userText ? [{ role: 'user' as const, text: userText }] : []),
                  ...(modelText ? [{ role: 'model' as const, text: modelText }] : [])
                ]);
              }
              
              currentTranscriptionRef.current = { user: '', model: '' };
              setStatus('listening');
            }

            // 2. Handle Audio Playback
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputCtx) {
              const buffer = await decodeAudioToBuffer(decodeBase64Audio(audioData), outputCtx);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);

              const now = outputCtx.currentTime;
              const startTime = Math.max(now, nextStartTimeRef.current);
              
              source.start(startTime);
              nextStartTimeRef.current = startTime + buffer.duration;
              
              audioSourcesRef.current.add(source);
              source.onended = () => audioSourcesRef.current.delete(source);
            }

            // 3. Handle Interruptions
            if (msg.serverContent?.interrupted) {
              audioSourcesRef.current.forEach(s => {
                try { s.stop(); } catch (e) {}
              });
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = outputCtx.currentTime;
              setStatus('listening');
            }
          },
          onerror: (e) => {
            console.error("Talk session error:", e);
            stopLive();
          },
          onclose: () => {
            setIsLive(false);
            setStatus('idle');
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: `You are a professional real-time translator. 
          Bridge the conversation between ${sourceLang} and ${targetLang}. 
          Translate everything precisely. If the user stops talking, wait for a moment, then translate. 
          Respond ONLY with translations.`
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (e) { 
      console.error("Failed to initialize Talk:", e);
      setStatus('idle');
    }
  };

  const stopLive = () => {
    // Stop all audio sources
    audioSourcesRef.current.forEach(s => {
      try { s.stop(); } catch (e) {}
    });
    audioSourcesRef.current.clear();

    // Close session
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }

    // Close contexts
    inputCtxRef.current?.close();
    outputCtxRef.current?.close();
    
    setIsLive(false);
    setStatus('idle');
    nextStartTimeRef.current = 0;
  };

  // Cleanup on unmount
  useEffect(() => () => stopLive(), []);

  return (
    <div className="bg-brand-dark rounded-[2.5rem] p-6 flex flex-col items-center gap-6 shadow-2xl animate-slide-up h-[520px] transition-all duration-500">
      {/* Dynamic Visualizer Area */}
      <div className="relative w-full h-44 flex items-center justify-center overflow-hidden rounded-[2rem] bg-black/40 border border-white/5 shadow-inner">
        {/* Animated Aura Orb */}
        <div className={`absolute w-40 h-40 rounded-full blur-[60px] transition-all duration-1000 opacity-40 ${
          status === 'listening' ? 'bg-emerald-500 scale-125' :
          status === 'speaking' ? 'bg-brand-screen scale-150' :
          status === 'thinking' ? 'bg-blue-400 scale-110' :
          'bg-slate-800 scale-90'
        }`} />
        
        {/* State Indicators */}
        <div className="absolute top-4 left-4 flex gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5 bg-rose-500/20 px-2.5 py-1 rounded-full border border-rose-500/30">
               <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
               <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">Live</span>
            </div>
          )}
        </div>

        {/* Core Visualizer */}
        <div className={`relative w-28 h-28 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
          status === 'listening' ? 'border-emerald-400 bg-emerald-400/10 shadow-[0_0_30px_rgba(52,211,153,0.3)]' :
          status === 'speaking' ? 'border-brand-screen bg-brand-screen/10 shadow-[0_0_30px_rgba(240,206,55,0.3)]' :
          status === 'thinking' ? 'border-blue-400 bg-blue-400/10' :
          'border-white/5 bg-white/5'
        }`}>
          {status === 'speaking' && (
             <div className="flex gap-1.5 items-center">
                <div className="w-1.5 h-8 bg-brand-screen rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="w-1.5 h-14 bg-brand-screen rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-1.5 h-10 bg-brand-screen rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
             </div>
          )}
          {status === 'thinking' && (
            <div className="flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-t-white border-white/10 rounded-full animate-spin" />
            </div>
          )}
          {status === 'listening' && (
            <div className="flex flex-col items-center gap-1">
               <div className="w-4 h-4 rounded-full bg-emerald-400 animate-ping" />
               <span className="text-[8px] text-emerald-400 font-bold uppercase">Ready</span>
            </div>
          )}
          {status === 'idle' && (
            <svg className="w-10 h-10 text-white/10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/></svg>
          )}
        </div>
      </div>

      {/* Transcription Feed */}
      <div 
        ref={scrollRef}
        className="flex-1 w-full overflow-y-auto custom-scrollbar bg-black/20 rounded-[1.5rem] p-5 flex flex-col gap-4 shadow-inner"
      >
        {transcripts.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-center gap-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            <p className="text-xs font-bold leading-relaxed px-4">Start speaking in {sourceLang === 'auto' ? 'any language' : sourceLang} to see live translations.</p>
          </div>
        )}
        {transcripts.map((t, i) => (
          <div 
            key={i} 
            className={`max-w-[85%] p-4 rounded-2xl text-xs font-bold shadow-sm animate-slide-up leading-relaxed ${
              t.role === 'user' 
                ? 'bg-white/10 text-white self-end rounded-tr-none border border-white/5' 
                : 'bg-brand-screen text-brand-dark self-start rounded-tl-none shadow-md'
            }`}
          >
            {t.text}
          </div>
        ))}
        {/* Temporary bubble for current model turn */}
        {status === 'speaking' && !currentTranscriptionRef.current.model && (
           <div className="bg-brand-screen/10 p-4 rounded-2xl rounded-tl-none self-start max-w-[85%] animate-pulse flex gap-1">
              <div className="w-2 h-2 bg-brand-screen/40 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-2 h-2 bg-brand-screen/40 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-brand-screen/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
           </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-5 w-full shrink-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
          {status === 'idle' ? 'Universal Voice bridge' : 
           status === 'listening' ? 'I am listening...' : 
           status === 'speaking' ? 'Translating to your target...' : 
           'Processing language...'}
        </p>

        <button
          onClick={isLive ? stopLive : startLive}
          aria-label={isLive ? "Stop conversation" : "Start conversation"}
          className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 group relative ${
            isLive ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-brand-screen hover:bg-brand-screen/90 shadow-brand-screen/20'
          }`}
        >
          {isLive ? (
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
          ) : (
            <svg className="w-10 h-10 text-brand-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
          )}
          {isLive && (
            <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping" />
          )}
        </button>
      </div>
    </div>
  );
};

export default VoiceMode;
