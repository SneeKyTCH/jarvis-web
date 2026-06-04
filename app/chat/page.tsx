'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { chatAPI } from '@/lib/api';
import { franc } from 'franc';

// Animated waveform and circle styles
const styles = `
  @keyframes pulse-ring {
    0% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.8), 0 0 0 0 rgba(59, 130, 246, 0.6);
    }
    50% {
      box-shadow: 0 0 0 40px rgba(59, 130, 246, 0), 0 0 0 80px rgba(59, 130, 246, 0);
    }
    100% {
      box-shadow: 0 0 0 40px rgba(59, 130, 246, 0), 0 0 0 80px rgba(59, 130, 246, 0);
    }
  }

  @keyframes scale-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  @keyframes wave-bar {
    0%, 100% { height: 8px; }
    50% { height: 24px; }
  }

  .recording-circle {
    animation: pulse-ring 2s infinite, scale-pulse 2s infinite;
  }

  .wave-bar {
    animation: wave-bar 0.6s ease-in-out infinite;
  }

  .wave-bar:nth-child(2) {
    animation-delay: 0.1s;
  }

  .wave-bar:nth-child(3) {
    animation-delay: 0.2s;
  }

  .wave-bar:nth-child(4) {
    animation-delay: 0.1s;
  }

  .wave-bar:nth-child(5) {
    animation-delay: 0s;
  }

  @keyframes fade-in {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
  }

  .recording-overlay {
    animation: fade-in 0.3s ease-out;
  }
`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m JARVIS, your AI assistant. How can I help you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'dictate' | 'voice' | null>(null); // 'dictate' or 'voice'
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [speechLang, setSpeechLang] = useState<string>('ro-RO'); // Default to Romanian
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceCountRef = useRef<number>(0);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!token) {
      router.push('/');
      return;
    }

    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speakText = async (text: string) => {
    try {
      setIsSpeaking(true);
      const token = localStorage.getItem('token');

      // Map detected language to Azure voice
      let voiceId = 'en-US-AriaNeural'; // Default
      if (detectedLanguage.includes('Română')) {
        voiceId = 'ro-RO-AlinaNeural'; // Premium Romanian voice
      } else if (detectedLanguage.includes('English')) {
        voiceId = 'en-US-AriaNeural';
      } else if (detectedLanguage.includes('Español')) {
        voiceId = 'es-ES-ElviraNeural';
      } else if (detectedLanguage.includes('Français')) {
        voiceId = 'fr-FR-DeniseNeural';
      }

      // Call backend to get Azure TTS audio
      const response = await fetch('https://jarvis-api-kx4n.onrender.com/api/v1/voice/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: text,
          language: detectedLanguage.includes('Română') ? 'ro' : 'en',
          voice_id: voiceId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to synthesize speech');
      }

      // Get audio blob and play it
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        console.log('Speech synthesis ended');
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.play().catch(err => {
        console.error('Audio play error:', err);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      });

      utteranceRef.current = audio as any;
    } catch (error) {
      console.error('Speak error:', error);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (utteranceRef.current) {
      const audio = utteranceRef.current as any;
      if (audio.pause) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
    setIsSpeaking(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await chatAPI.send(userMessage, conversationId);
      setConversationId(response.conversation_id);
      const aiResponse = response.response;
      setMessages((prev) => [...prev, { role: 'assistant', content: aiResponse }]);

      // Auto-speak AI response
      speakText(aiResponse);
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMsg = 'Sorry, there was an error. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }]);
      speakText(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const startRecording = async (mode: 'dictate' | 'voice') => {
    try {
      console.log(`Starting recording - Mode: ${mode}`);
      setIsRecording(true);
      setRecordingMode(mode);
      setInput('');
      setDetectedLanguage('');
      audioChunksRef.current = [];
      silenceCountRef.current = 0;

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, sending to Azure...');

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Send to backend for transcription
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'audio.webm');

          const token = localStorage.getItem('token');
          const response = await fetch('https://jarvis-api-kx4n.onrender.com/api/v1/voice/detect-language-and-transcribe', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          if (!response.ok) {
            throw new Error(`Transcription failed: ${response.status}`);
          }

          const result = await response.json();
          const { text, language, language_name } = result;

          console.log(`Transcribed: "${text}" (Language: ${language_name})`);

          // Set detected language
          setDetectedLanguage(language_name);

          // Set input text
          setInput(text);

          // Auto-submit only in voice mode
          if (mode === 'voice' && text.trim()) {
            setTimeout(() => {
              handleSend({ preventDefault: () => {} } as any);
            }, 300);
          }
        } catch (error) {
          console.error('Transcription error:', error);
          alert('Failed to transcribe audio');
        } finally {
          setIsRecording(false);
          setRecordingMode(null);

          // Stop all tracks
          streamRef.current?.getTracks().forEach(track => track.stop());
        }
      };

      // Start recording
      mediaRecorder.start();

      // Detect silence every 500ms
      const silenceCheck = setInterval(() => {
        // Stop after 2 seconds of detection or 10 seconds max
        silenceCountRef.current++;
        if (silenceCountRef.current > 4 || silenceCountRef.current > 20) {
          clearInterval(silenceCheck);
          mediaRecorder.stop();
        }
      }, 500);

      silenceTimerRef.current = silenceCheck as any;

    } catch (error) {
      console.error('Recording error:', error);
      alert('Could not access microphone');
      setIsRecording(false);
      setRecordingMode(null);
    }
  };

  const stopRecording = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingMode(null);
  };


  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <style>{styles}</style>

      {/* Recording Overlay - Only for Voice Chat Mode */}
      {isRecording && recordingMode === 'voice' && (
        <div className="recording-overlay fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
          {/* Close Button */}
          <button
            onClick={stopRecording}
            className="absolute top-6 right-6 text-white text-3xl hover:opacity-70 transition z-60"
          >
            ✕
          </button>

          <div className="flex flex-col items-center gap-6">
            {/* Large Pulsing Circle */}
            <div className="relative w-40 h-40">
              <div className="recording-circle absolute inset-0 rounded-full bg-blue-500 opacity-80"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={stopRecording}
                  className="w-24 h-24 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-3xl transition shadow-2xl hover:shadow-3xl"
                  title="Click to stop recording"
                >
                  🎤
                </button>
              </div>
            </div>
            {/* Recording Status */}
            <div className="text-center">
              <h2 className="text-white text-2xl font-bold mb-2">
                Speaking to chat...
              </h2>
              <p className="text-slate-300">
                {detectedLanguage ? `Speaking: ${detectedLanguage}` : 'Detecting language...'}
              </p>
              <p className="text-slate-400 text-sm mt-4">
                Speak to chat (auto-sends)
              </p>
              <p className="text-slate-400 text-sm">Click circle or ✕ to stop</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">JARVIS</h1>
          <p className="text-slate-400 text-sm">
            Chat with AI {isSpeaking && '🔊 Speaking...'} {isRecording && detectedLanguage && `(${detectedLanguage})`}
          </p>
          <button
            onClick={() => router.push('/agent')}
            className="mt-2 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded transition"
          >
            Try Voice Agent →
          </button>
        </div>
        <div className="flex items-center gap-4">
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded font-semibold transition"
            >
              Stop
            </button>
          )}
          {user && <span className="text-slate-300">{user.username}</span>}
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-lg px-4 py-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-200 border border-slate-700'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex gap-1 items-end">
                <div className="wave-bar w-1 bg-blue-500 rounded-full"></div>
                <div className="wave-bar w-1 bg-blue-500 rounded-full"></div>
                <div className="wave-bar w-1 bg-blue-500 rounded-full"></div>
                <div className="wave-bar w-1 bg-blue-500 rounded-full"></div>
                <div className="wave-bar w-1 bg-blue-500 rounded-full"></div>
              </div>
              <span className="text-slate-400 text-sm">JARVIS is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-slate-800 border-t border-slate-700 px-6 py-4">
        {/* Detected Language Indicator */}
        {isRecording && detectedLanguage && (
          <div className="mb-3 text-sm text-blue-400">
            Detected: {detectedLanguage}
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or click 🎤 to speak..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />

          {/* Dictate Button */}
          <button
            type="button"
            onClick={() => startRecording('dictate')}
            disabled={isLoading || isRecording}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-600 hover:bg-slate-700 text-white text-xl disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg hover:shadow-xl"
            title="Dictate - speak to add text"
          >
            🎤
          </button>

          {/* Voice Chat Button */}
          <button
            type="button"
            onClick={() => startRecording('voice')}
            disabled={isLoading || isRecording}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xl disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg hover:shadow-xl"
            title="Voice Chat - speak to chat"
          >
            📊
          </button>

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
