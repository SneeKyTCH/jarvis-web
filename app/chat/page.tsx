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

  @keyframes voice-chat-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
  }

  @keyframes voice-chat-ring {
    0% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
    }
    70% {
      box-shadow: 0 0 0 15px rgba(59, 130, 246, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
    }
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

  .voice-chat-recording {
    animation: voice-chat-ring 1.5s infinite;
  }

  .voice-chat-speaking {
    animation: voice-chat-pulse 1s infinite;
  }

  @keyframes fade-in {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
  }

  .recording-overlay {
    animation: fade-in 0.3s ease-out;
  }

  .voice-mode-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  }

  .waveform-container {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 4px;
    height: 120px;
    margin: 30px 0;
  }

  .waveform-bar {
    width: 3px;
    background: linear-gradient(to top, #3b82f6, #60a5fa);
    border-radius: 2px;
    transition: height 0.05s ease-out;
  }

  .voice-circle {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 80px;
    margin: 20px 0;
  }

  .voice-circle.idle {
    background: radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0) 70%);
  }

  .voice-circle.recording {
    background: radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0) 70%);
    animation: scale-pulse 1s infinite;
  }

  .voice-circle.listening {
    background: radial-gradient(circle, rgba(147, 51, 234, 0.2) 0%, rgba(147, 51, 234, 0) 70%);
    animation: scale-pulse 1.5s infinite;
  }

  .voice-circle.speaking {
    background: radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0) 70%);
    animation: scale-pulse 0.8s infinite;
  }

  .transcription-display {
    min-height: 60px;
    max-width: 600px;
    text-align: center;
    font-size: 18px;
    color: #e0e7ff;
    margin: 20px auto;
    padding: 15px;
    background: rgba(30, 41, 59, 0.5);
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .voice-controls {
    display: flex;
    gap: 15px;
    margin-top: 40px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .voice-control-btn {
    padding: 12px 24px;
    border-radius: 8px;
    border: none;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s;
    font-weight: 600;
  }

  .voice-control-btn:hover {
    transform: translateY(-2px);
  }

  .voice-control-btn.interrupt {
    background: #ef4444;
    color: white;
  }

  .voice-control-btn.interrupt:hover {
    background: #dc2626;
  }

  .voice-control-btn.close {
    background: #6b7280;
    color: white;
  }

  .voice-control-btn.close:hover {
    background: #4b5563;
  }

  .voice-selector {
    display: flex;
    gap: 12px;
    margin-bottom: 30px;
  }

  .voice-option {
    padding: 10px 20px;
    border-radius: 8px;
    border: 2px solid #4b5563;
    background: transparent;
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.3s;
    font-weight: 600;
  }

  .voice-option.active {
    border-color: #3b82f6;
    background: #3b82f6;
    color: white;
  }

  .voice-option:hover {
    border-color: #60a5fa;
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
  const [voiceChatState, setVoiceChatState] = useState<'idle' | 'recording' | 'listening' | 'speaking'>('idle');
  const [user, setUser] = useState<any>(null);
  const [speechLang, setSpeechLang] = useState<string>('ro-RO'); // Default to Romanian
  const [voiceType, setVoiceType] = useState<string>('female'); // 'male' or 'female'
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(20).fill(0));
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioPlayingRef = useRef<HTMLAudioElement | null>(null);
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

  // Waveform visualization effect
  useEffect(() => {
    if (!isRecording || recordingMode !== 'voice' || !streamRef.current) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(streamRef.current);
    source.connect(analyser);
    analyser.fftSize = 256;

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateWaveform = () => {
      analyser.getByteFrequencyData(dataArray);
      const bars = Array.from(dataArray)
        .slice(0, 20)
        .map(value => (value / 255) * 100);
      setWaveformBars(bars);

      if (isRecording) {
        requestAnimationFrame(updateWaveform);
      }
    };

    updateWaveform();

    return () => {
      analyser.disconnect();
      source.disconnect();
    };
  }, [isRecording, recordingMode]);

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
      setLiveTranscription('');
      audioChunksRef.current = [];
      silenceCountRef.current = 0;

      // Start Web Speech API for real-time transcription in voice mode
      if (mode === 'voice' && 'webkitSpeechRecognition' in window) {
        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              setLiveTranscription(prev => prev + transcript + ' ');
            } else {
              interimTranscript += transcript;
            }
          }
          if (interimTranscript) {
            setLiveTranscription(prev => {
              const parts = prev.split(' ');
              parts[parts.length - 1] = interimTranscript;
              return parts.join(' ');
            });
          }
        };

        recognition.start();
        (recognition as any)._jarvisInstance = recognition;
      }

      // Update voice chat state
      if (mode === 'voice') {
        setVoiceChatState('recording');
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder with WAV format if supported, otherwise WebM
      const mimeType = 'audio/wav';
      const options = { mimeType };

      // Fallback to webm if wav not supported
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch {
        console.log('WAV not supported, using WebM');
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, processing audio...');

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });

        // Send to backend
        try {
          // Update state for voice chat
          if (mode === 'voice') {
            setVoiceChatState('listening');
          }

          const formData = new FormData();
          formData.append('file', audioBlob, 'audio.wav');

          const token = localStorage.getItem('token');
          const endpoint = mode === 'voice'
            ? 'https://jarvis-api-kx4n.onrender.com/api/v1/voice/voice-chat'
            : 'https://jarvis-api-kx4n.onrender.com/api/v1/voice/detect-language-and-transcribe';

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
          }

          // Handle voice chat response (audio) vs dictate response (text)
          if (mode === 'voice') {
            // Voice chat: response is audio
            setVoiceChatState('speaking');
            setIsAISpeaking(true);
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audioPlayingRef.current = audio;

            audio.onended = () => {
              setVoiceChatState('idle');
              setIsAISpeaking(false);
              URL.revokeObjectURL(audioUrl);
              audioPlayingRef.current = null;
            };

            audio.onerror = () => {
              setVoiceChatState('idle');
              setIsAISpeaking(false);
              URL.revokeObjectURL(audioUrl);
              audioPlayingRef.current = null;
            };

            audio.play();
            console.log('Playing AI response...');
          } else {
            // Dictate: response is JSON with transcribed text
            const result = await response.json();
            const { text, language, language_name } = result;

            console.log(`Transcribed: "${text}" (Language: ${language_name})`);
            setDetectedLanguage(language_name);
            setInput(text);
          }
        } catch (error) {
          console.error('Transcription error:', error);
          alert('Failed to transcribe audio');
          if (mode === 'voice') {
            setVoiceChatState('idle');
          }
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
    if (voiceChatState === 'recording') {
      setVoiceChatState('idle');
    }
  };

  const interruptAI = () => {
    if (audioPlayingRef.current) {
      audioPlayingRef.current.pause();
      audioPlayingRef.current.currentTime = 0;
      audioPlayingRef.current = null;
    }
    setVoiceChatState('idle');
    setIsAISpeaking(false);
    console.log('AI interrupted');
  };

  const closeVoiceMode = () => {
    interruptAI();
    stopRecording();
    setVoiceChatState('idle');
    setRecordingMode(null);
    setLiveTranscription('');
  };


  // Full-screen voice chat UI when in voice mode
  if (recordingMode === 'voice') {
    return (
      <div className="voice-mode-container">
        <style>{styles}</style>

        {/* Header */}
        <div className="absolute top-6 right-6 flex gap-3">
          {user && <span className="text-slate-300 text-sm">{user.username}</span>}
          <button
            onClick={closeVoiceMode}
            className="voice-control-btn close"
          >
            ← Back
          </button>
        </div>

        {/* Main Content */}
        <div className="flex flex-col items-center w-full max-w-2xl px-6">
          {/* Voice Selector - show before recording starts */}
          {voiceChatState === 'idle' && !isRecording && (
            <div className="voice-selector mb-10">
              <button
                className={`voice-option ${voiceType === 'female' ? 'active' : ''}`}
                onClick={() => setVoiceType('female')}
              >
                👩 Female
              </button>
              <button
                className={`voice-option ${voiceType === 'male' ? 'active' : ''}`}
                onClick={() => setVoiceType('male')}
              >
                👨 Male
              </button>
            </div>
          )}

          {/* Large Animated Circle */}
          <div className={`voice-circle ${voiceChatState}`}>
            {voiceChatState === 'recording' ? '🎤' : voiceChatState === 'listening' ? '👂' : voiceChatState === 'speaking' ? '🔊' : '📊'}
          </div>

          {/* Waveform Visualization */}
          {isRecording && voiceChatState === 'recording' && (
            <div className="waveform-container">
              {waveformBars.map((height, idx) => (
                <div
                  key={idx}
                  className="waveform-bar"
                  style={{ height: `${Math.max(5, height)}px` }}
                />
              ))}
            </div>
          )}

          {/* Status Text */}
          <h2 className="text-white text-2xl font-bold mt-10 mb-4">
            {voiceChatState === 'recording' && 'Listening...'}
            {voiceChatState === 'listening' && 'Processing...'}
            {voiceChatState === 'speaking' && 'JARVIS is speaking'}
            {voiceChatState === 'idle' && 'Ready to chat'}
          </h2>

          {/* Live Transcription Display */}
          {liveTranscription && (
            <div className="transcription-display">
              <p className="text-sm text-slate-400 mb-2">You said:</p>
              <p>{liveTranscription}</p>
            </div>
          )}

          {/* Controls */}
          <div className="voice-controls">
            {voiceChatState === 'idle' && !isRecording && (
              <button
                onClick={() => startRecording('voice')}
                className="voice-control-btn"
                style={{ background: '#3b82f6' }}
              >
                Start Speaking
              </button>
            )}
            {(voiceChatState === 'recording' || isRecording) && (
              <button
                onClick={stopRecording}
                className="voice-control-btn"
                style={{ background: '#ef4444' }}
              >
                Stop Recording
              </button>
            )}
            {isAISpeaking && (
              <button
                onClick={interruptAI}
                className="voice-control-btn interrupt"
              >
                🛑 Interrupt
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Normal chat UI
  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <style>{styles}</style>


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

          {/* Voice Chat Button - Always Visible with State */}
          <button
            type="button"
            onClick={() => {
              if (voiceChatState === 'recording') {
                stopRecording();
              } else if (voiceChatState === 'idle') {
                startRecording('voice');
              }
            }}
            disabled={isLoading || isRecording}
            className={`w-12 h-12 flex items-center justify-center rounded-full text-white text-xl transition shadow-lg hover:shadow-xl ${
              voiceChatState === 'idle'
                ? 'bg-blue-600 hover:bg-blue-700'
                : voiceChatState === 'recording'
                ? 'bg-red-600 hover:bg-red-700 voice-chat-recording'
                : voiceChatState === 'listening'
                ? 'bg-purple-600 hover:bg-purple-700 animate-pulse'
                : 'bg-green-600 hover:bg-green-700 voice-chat-speaking'
            } ${isLoading || (voiceChatState !== 'idle' && voiceChatState !== 'recording') ? 'disabled:opacity-50 disabled:cursor-not-allowed' : ''}`}
            title={
              voiceChatState === 'recording' ? 'Click to stop recording' :
              voiceChatState === 'listening' ? 'Listening to AI...' :
              voiceChatState === 'speaking' ? 'AI is speaking...' :
              'Voice Chat - click to speak'
            }
          >
            {voiceChatState === 'recording' ? '🔴' : voiceChatState === 'listening' ? '👂' : voiceChatState === 'speaking' ? '🔊' : '📊'}
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
