'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { chatAPI } from '@/lib/api';
import { franc } from 'franc';

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

      recognition.onstart = () => {
        console.log('Speech recognition started - auto-detecting language');
        setIsRecording(true);
        setInput('');
        setDetectedLanguage('');
        finalTranscript = '';
      };

      recognition.onresult = (event: any) => {
        console.log(`Result event: ${event.results.length} results`);

        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          console.log(`Result ${i}: "${transcript}" (final: ${event.results[i].isFinal})`);

          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Update input with both final and interim text
        const fullText = finalTranscript + interimTranscript;
        console.log('Setting input to:', fullText);
        setInput(fullText);

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
        alert(`Error: ${event.error}`);
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsRecording(false);
      };

      mediaRecorderRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Speech recognition error:', error);
      alert('Could not start speech recognition');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      (mediaRecorderRef.current as any).stop();
      setIsRecording(false);
    }
  };


  return (
    <div className="h-screen flex flex-col bg-slate-900">
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
            <div className="bg-slate-800 border border-slate-700 px-4 py-3 rounded-lg">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-slate-800 border-t border-slate-700 px-6 py-4">
        {/* Language Selector */}
        <div className="mb-3 flex gap-2 flex-wrap">
          <span className="text-slate-400 text-sm self-center">Language:</span>
          <button
            type="button"
            onClick={() => setSpeechLang('ro-RO')}
            className={`px-3 py-1 rounded text-sm font-semibold transition ${
              speechLang === 'ro-RO'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            🇷🇴 Română
          </button>
          <button
            type="button"
            onClick={() => setSpeechLang('en-US')}
            className={`px-3 py-1 rounded text-sm font-semibold transition ${
              speechLang === 'en-US'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            🇺🇸 English
          </button>
          <button
            type="button"
            onClick={() => setSpeechLang('es-ES')}
            className={`px-3 py-1 rounded text-sm font-semibold transition ${
              speechLang === 'es-ES'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            🇪🇸 Español
          </button>
          <button
            type="button"
            onClick={() => setSpeechLang('fr-FR')}
            className={`px-3 py-1 rounded text-sm font-semibold transition ${
              speechLang === 'fr-FR'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            🇫🇷 Français
          </button>
          <button
            type="button"
            onClick={() => setSpeechLang('de-DE')}
            className={`px-3 py-1 rounded text-sm font-semibold transition ${
              speechLang === 'de-DE'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            🇩🇪 Deutsch
          </button>
        </div>
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or click 🎤 to speak..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />

          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition flex items-center gap-2"
            >
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={isLoading}
              className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50 transition"
              title="Click to record voice message"
            >
              🎤
            </button>
          )}

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
