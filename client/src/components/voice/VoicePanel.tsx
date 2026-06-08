import React, { useState } from 'react'
import { LiveKitRoom, RoomAudioRenderer, useParticipants, useTrackToggle } from '@livekit/components-react'
import { Track } from 'livekit-client'
import { useVoice } from '../../hooks/useVoice'

interface VoicePanelProps {
  matchId: string
  accessToken: string
}

function MicButton() {
  const { buttonProps, enabled } = useTrackToggle({ source: Track.Source.Microphone })

  return (
    <button
      {...buttonProps}
      type="button"
      className={`
        p-2 rounded-full border-2 transition-colors
        ${!enabled
          ? 'border-red-400 bg-red-50 text-red-600 hover:bg-red-100'
          : 'border-green-400 bg-green-50 text-green-600 hover:bg-green-100'
        }
      `}
      title={!enabled ? 'Unmute microphone' : 'Mute microphone'}
    >
      {!enabled ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={2} />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      )}
    </button>
  )
}

function ParticipantList() {
  const participants = useParticipants()

  return (
    <div className="flex items-center gap-2">
      {participants.map((p) => (
        <div
          key={p.identity}
          className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1"
        >
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-700">{p.name ?? p.identity}</span>
        </div>
      ))}
    </div>
  )
}

export function VoicePanel({ matchId, accessToken }: VoicePanelProps) {
  const { token, serverUrl, loading, error } = useVoice(matchId, accessToken)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-2 text-gray-300 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <span className="text-sm font-medium">Voice Chat</span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-4 py-3">
          {loading && (
            <p className="text-gray-400 text-sm">Connecting to voice...</p>
          )}

          {error && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-400 text-sm">Voice unavailable</p>
            </div>
          )}

          {token && serverUrl && !error && (
            <LiveKitRoom
              token={token}
              serverUrl={serverUrl}
              audio={true}
              video={false}
              onError={() => {
                // silently fail
              }}
            >
              <RoomAudioRenderer />
              <div className="flex items-center justify-between gap-3">
                <ParticipantList />
                <MicButton />
              </div>
            </LiveKitRoom>
          )}
        </div>
      )}
    </div>
  )
}
