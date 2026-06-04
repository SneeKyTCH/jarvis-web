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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [speechLang, setSpeechLang] = useState<string>('ro-RO'); // Default to Romanian
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastResultTimeRef = useRef<number>(0);

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

      // Call backend to get audio from Eleven Labs
      const response = await fetch('https://jarvis-api-kx4n.onrender.com/api/v1/voice/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: text,
          language: 'en',
          voice_id: 'George'
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

      // Voice disabled - use /agent page for voice conversations
      // speakText(aiResponse);
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMsg = 'Sorry, there was an error. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }]);
      // speakText(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const startRecording = async () => {
    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SpeechRecognition) {
        alert('Speech Recognition not supported in your browser');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLang; // Use dynamic language (default: ro-RO for Romanian)

      let finalTranscript = '';
      let hasFinalResult = false;

      recognition.onstart = () => {
        console.log('Speech recognition started - auto-detecting language');
        setIsRecording(true);
        setInput('');
        setDetectedLanguage('');
        finalTranscript = '';
        hasFinalResult = false;
      };

      recognition.onresult = (event: any) => {
        console.log(`Result event: ${event.results.length} results`);

        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          console.log(`Result ${i}: "${transcript}" (final: ${event.results[i].isFinal})`);

          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
            hasFinalResult = true;
          } else {
            interimTranscript += transcript;
          }
        }

        // Update input with both final and interim text
        const fullText = finalTranscript + interimTranscript;
        console.log('Setting input to:', fullText);
        setInput(fullText);

        // Only start silence timer after we have a final result
        if (hasFinalResult) {
          lastResultTimeRef.current = Date.now();
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          // Auto-stop after 4 seconds of silence (only after final result)
          silenceTimerRef.current = setTimeout(() => {
            console.log('Silence detected - stopping recording');
            if (mediaRecorderRef.current) {
              try {
                (mediaRecorderRef.current as any).abort();
              } catch (error) {
                console.error('Error stopping recognition:', error);
              }
              setIsRecording(false);
            }
          }, 4000);
        }

        // Auto-detect language using hybrid approach
        if (fullText.trim().length > 2) {
          try {
            let detectedLang = 'eng';

            // Check for Romanian characters first
            if (/[ăâîșț]/i.test(fullText)) {
              detectedLang = 'ron';
              console.log('Detected Romanian by characters');
            } else {
              // Use franc for other languages
              try {
                detectedLang = franc(fullText);
                console.log('Detected language via franc:', detectedLang);
              } catch {
                console.log('Franc detection failed, defaulting to English');
              }
            }

            // Map language codes to names with flags AND speech recognition language codes
            const langMap: { [key: string]: { name: string; speechLang: string } } = {
              'ron': { name: 'Română 🇷🇴', speechLang: 'ro-RO' },
              'eng': { name: 'English 🇺🇸', speechLang: 'en-US' },
              'spa': { name: 'Español 🇪🇸', speechLang: 'es-ES' },
              'fra': { name: 'Français 🇫🇷', speechLang: 'fr-FR' },
              'deu': { name: 'Deutsch 🇩🇪', speechLang: 'de-DE' },
              'ita': { name: 'Italiano 🇮🇹', speechLang: 'it-IT' },
              'por': { name: 'Português 🇵🇹', speechLang: 'pt-PT' },
            };

            const langInfo = langMap[detectedLang] || { name: detectedLang, speechLang: 'en-US' };
            setDetectedLanguage(langInfo.name);
            setSpeechLang(langInfo.speechLang);
            console.log(`Language set to: ${langInfo.speechLang}`);
          } catch (error) {
            console.error('Language detection error:', error);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        if (event.error !== 'no-speech') {
          alert(`Error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsRecording(false);

        // Clear silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // Auto-submit message if there's text
        setTimeout(() => {
          setInput((currentInput) => {
            const textToSend = currentInput.trim();
            if (textToSend) {
              console.log('Auto-submitting:', textToSend);
              // Trigger the send
              handleSend({ preventDefault: () => {} } as any);
            }
            return currentInput;
          });
        }, 300);
      };

      mediaRecorderRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Speech recognition error:', error);
      alert('Could not start speech recognition');
    }
  };

  const stopRecording = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (mediaRecorderRef.current) {
      try {
        (mediaRecorderRef.current as any).abort();
        console.log('Speech recognition stopped');
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
      setIsRecording(false);
      setDetectedLanguage('');
    }
  };


  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <style>{styles}</style>

      {/* Recording Overlay - Large Animated Circle */}
      {isRecording && (
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
              <h2 className="text-white text-2xl font-bold mb-2">Listening...</h2>
              <p className="text-slate-300">
                {detectedLanguage ? `Speaking: ${detectedLanguage}` : 'Detecting language...'}
              </p>
              <p className="text-slate-400 text-sm mt-4">Click circle or ✕ to stop</p>
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
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or click 🎤 to speak..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />

          <button
            type="button"
            onClick={startRecording}
            disabled={isLoading || isRecording}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xl disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg hover:shadow-xl"
            title="Click to record voice message"
          >
            🎤
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
