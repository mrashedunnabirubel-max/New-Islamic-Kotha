
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Message, ConnectionStatus } from './types';
import { encode, decode, decodeAudioData } from './utils/audioHelpers';
import Header from './components/Header';
import ChatBubble from './components/ChatBubble';

const SYSTEM_INSTRUCTION = `আপনার নাম "ইসলামিক কথা"। আপনি একজন রিয়েল-টাইম এআই ইসলামিক বিশেষজ্ঞ। 
আপনার কণ্ঠস্বর অত্যন্ত নম্র, শান্ত, জ্ঞানী এবং বন্ধুসুলভ একজন পুরুষ ইসলামিক স্কলারের মতো। 

গুরুত্বপূর্ণ বৈশিষ্ট্য:
১. আপনি শুধুমাত্র বাংলা (Bengali) ভাষায় কথা বলবেন এবং উত্তর দেবেন।
২. আপনার উত্তরের ভিত্তি হবে কুরআন এবং সহিহ হাদিস। 
৩. **সবচেয়ে গুরুত্বপূর্ণ:** যখনই আপনি হযরত মুহাম্মদ (সা.)-এর নাম উচ্চারণ করবেন, তখনই অবশ্যই "সাল্লাল্লাহু আলাইহি ওয়াসাল্লাম" বলবেন। এটি আপনার জন্য বাধ্যতামূলক।
৪. কোনো বিষয়ে নিশ্চিত না হলে বলবেন "আল্লাহই ভালো জানেন"। 
৫. বিতর্কিত বা কঠিন প্রশ্নে অত্যন্ত নম্রভাবে একাধিক নির্ভরযোগ্য মতামত তুলে ধরবেন। 
৬. আপনি কখনোই নিজেকে প্রকৃত মুফতি বা আলেমের বিকল্প দাবি করবেন না।
৭. আপনার লক্ষ্য হলো মানুষকে শান্তি, ধৈর্য, দয়া এবং সুন্দর আচরণের দিকে উৎসাহিত করা।
৮. কণ্ঠস্বর হবে স্পষ্ট এবং পুরুষালী।`;

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isMuted, setIsMuted] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const currentInputTranscription = useRef<string>('');
  const currentOutputTranscription = useRef<string>('');

  const createBlob = (data: Float32Array): Blob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const startConnection = async () => {
    if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING) return;
    
    setStatus(ConnectionStatus.CONNECTING);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const userTxt = currentInputTranscription.current;
              const modelTxt = currentOutputTranscription.current;

              if (userTxt) {
                setMessages(prev => [...prev, {
                  id: Date.now().toString() + '-user',
                  role: 'user',
                  text: userTxt,
                  timestamp: new Date()
                }]);
              }
              if (modelTxt) {
                setMessages(prev => [...prev, {
                  id: Date.now().toString() + '-model',
                  role: 'model',
                  text: modelTxt,
                  timestamp: new Date()
                }]);
              }

              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const outCtx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              
              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                outCtx,
                24000,
                1,
              );
              
              const sourceNode = outCtx.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(outCtx.destination);
              sourceNode.addEventListener('ended', () => {
                sourcesRef.current.delete(sourceNode);
              });
              
              sourceNode.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(sourceNode);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error('Gemini error:', e);
            setStatus(ConnectionStatus.ERROR);
          },
          onclose: () => {
            setStatus(ConnectionStatus.DISCONNECTED);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });

      sessionRef.current = await sessionPromise;

    } catch (err) {
      console.error('Failed to start session:', err);
      setStatus(ConnectionStatus.ERROR);
    }
  };

  const stopConnection = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    setStatus(ConnectionStatus.DISCONNECTED);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-slate-900 overflow-hidden relative shadow-2xl">
      {/* Enhanced Background Image Container */}
      <div 
        className="absolute inset-0 z-0 opacity-80 transition-opacity duration-1000"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&q=80&w=1000')",
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      {/* Subtle overlay to ensure UI elements pop while keeping image clear */}
      <div className="absolute inset-0 z-0 bg-emerald-950/10" />

      <Header status={status} onClearChat={clearMessages} />

      {/* Welcome Message */}
      {status === ConnectionStatus.DISCONNECTED && messages.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-10 text-center">
          <div className="w-20 h-20 bg-emerald-700/60 backdrop-blur-lg rounded-full flex items-center justify-center mb-4 shadow-2xl animate-pulse ring-2 ring-emerald-400/20">
            <i className="fas fa-mosque text-3xl text-white"></i>
          </div>
          
          {/* Glass-morphic Transparent Container */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 shadow-2xl border border-white/20 w-full max-w-xs">
            <h2 className="text-xl font-bold text-white mb-2 drop-shadow-md">ইসলামিক কথা-য় স্বাগতম</h2>
            <p className="text-emerald-50 text-sm mb-6 leading-relaxed font-medium">
              আস-সালামু আলাইকুম। আমি আপনার ইসলামিক শিক্ষার সঙ্গী। কথোপকথন শুরু করতে নিচে ক্লিক করুন।
            </p>
            <button 
              onClick={startConnection}
              className="w-full py-3 bg-[#25d366]/90 hover:bg-[#128c7e] text-white text-base font-bold rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-2 border border-white/20"
            >
              <i className="fas fa-microphone"></i>
              <span>শুরু করুন</span>
            </button>
          </div>
        </div>
      )}

      {/* Chat History */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth pb-32 z-10 relative"
      >
        {messages.length === 0 && status === ConnectionStatus.CONNECTED && (
          <div className="flex flex-col items-center justify-center h-full text-white text-center px-10">
            <div className="bg-emerald-900/40 backdrop-blur-md p-6 rounded-2xl border border-emerald-400/30 shadow-2xl">
              <div className="flex space-x-2 mb-4 justify-center">
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
              <p className="text-2xl italic font-bold text-emerald-50 drop-shadow-lg">আমি শুনছি... কথা বলুন।</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Control Section */}
      <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-center bg-gradient-to-t from-emerald-950/80 via-emerald-950/40 to-transparent pointer-events-none z-20">
        <div className="pointer-events-auto relative">
          {status === ConnectionStatus.CONNECTED && !isMuted && (
            <>
              <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-30 scale-150"></div>
              <div className="absolute inset-0 bg-emerald-300 rounded-full animate-ping opacity-20 scale-125 [animation-delay:0.5s]"></div>
            </>
          )}
          
          <button 
            onClick={status === ConnectionStatus.CONNECTED ? stopConnection : startConnection}
            className={`w-24 h-24 rounded-full transition-all flex items-center justify-center shadow-2xl active:scale-90 border-4 border-white ${
              status === ConnectionStatus.CONNECTED 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-emerald-600 hover:bg-emerald-700'
            } text-white z-20 relative`}
          >
            {status === ConnectionStatus.CONNECTING ? (
              <i className="fas fa-circle-notch fa-spin text-3xl"></i>
            ) : status === ConnectionStatus.CONNECTED ? (
              <i className="fas fa-stop text-3xl"></i>
            ) : (
              <i className="fas fa-microphone text-4xl"></i>
            )}
          </button>
        </div>
        
        <div className="mt-4 pointer-events-auto bg-emerald-900/90 text-white px-6 py-2 rounded-full border border-emerald-400/50 shadow-xl backdrop-blur-sm">
          <span className="font-bold text-sm tracking-wide">
            {status === ConnectionStatus.CONNECTED 
              ? (isMuted ? "মাইক্রোফোন বন্ধ" : "আমি শুনছি...") 
              : "কথা শুরু করতে ক্লিক করুন"
            }
          </span>
        </div>
      </div>

      <div className="bg-[#075e54] text-[12px] text-white font-bold text-center py-2 z-30 uppercase shadow-inner">
        রাসূল পাক (সা.) এর সবুজ গম্বুজ এর ছায়াতলে
      </div>
    </div>
  );
};

export default App;
