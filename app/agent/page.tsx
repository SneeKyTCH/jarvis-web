'use client';

import { useConversation } from '@elevenlabs/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const AGENT_ID = 'agent_2601kt99f7jdf6m9gzgcw22dkdx9';

export default function AgentPage() {
  const router = useRouter();
  const conversation = useConversation({
    onConnect: () => console.log('Connected to agent'),
    onDisconnect: () => console.log('Disconnected from agent'),
    onMessage: (message) => console.log('Message:', message),
    onError: (error) => console.error('Agent error:', error),
    onModeChange: (mode) => console.log('Mode:', mode),
  });

  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    if (!authToken) {
      router.push('/');
      return;
    }
    setToken(authToken);
  }, [router]);

  const startAgent = async () => {
    try {
      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start conversation with agent (Romanian language)
      await conversation.startSession({
        agentId: AGENT_ID,
        overrides: {
          language: 'ro', // Romanian
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start agent';
      setError(errorMsg);
      console.error('Start agent error:', err);
    }
  };

  const stopAgent = async () => {
    await conversation.endSession();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-6 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-white">JARVIS Voice Agent</h1>
          <p className="text-slate-400 text-sm mt-1">Talk naturally with AI</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition"
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="bg-slate-700 rounded-2xl p-12 max-w-md w-full shadow-2xl border border-slate-600">
          {/* Status */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">
              {conversation.status === 'connected' ? '🎤' : '🔇'}
            </div>
            <p className="text-2xl font-semibold text-white capitalize">
              {conversation.status === 'connecting' && 'Connecting...'}
              {conversation.status === 'connected' && 'Connected'}
              {conversation.status === 'disconnected' && 'Ready to talk'}
            </p>
            <p className="text-slate-400 text-sm mt-2">
              {conversation.isSpeaking ? '🔴 Agent is speaking...' : '👂 Listening...'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3">
            {conversation.status === 'connected' ? (
              <button
                onClick={stopAgent}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
              >
                <span>Stop Conversation</span>
              </button>
            ) : (
              <button
                onClick={startAgent}
                disabled={conversation.status === 'connecting'}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition disabled:cursor-not-allowed"
              >
                {conversation.status === 'connecting' ? 'Connecting...' : 'Start Conversation'}
              </button>
            )}
          </div>

          {/* Back to Chat */}
          <button
            onClick={() => router.push('/chat')}
            className="w-full mt-4 px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg transition text-sm"
          >
            Back to Text Chat
          </button>
        </div>

        {/* Info */}
        <div className="mt-12 max-w-md text-center">
          <h2 className="text-white font-semibold mb-4">How it works:</h2>
          <ul className="text-slate-300 text-sm space-y-2">
            <li>✅ Click "Start Conversation"</li>
            <li>✅ Grant microphone access</li>
            <li>✅ Speak naturally to JARVIS</li>
            <li>✅ Agent responds in real-time</li>
            <li>✅ Click "Stop" when done</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
