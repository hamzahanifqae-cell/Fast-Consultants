import { useState } from 'react';

import './interview-video-call.css';

type InterviewVideoCallProps = {
  joinUrl: string;
  title?: string;
  subtitle?: string;
  studentName?: string | null;
  onJoin?: () => void | Promise<void>;
  onLeave?: () => void | Promise<void>;
};

/** In-app Jitsi video call (camera + mic inside the web app). */
export function InterviewVideoCall({
  joinUrl,
  title = 'Interview video call',
  subtitle = 'Allow camera and microphone when your browser asks.',
  studentName,
  onJoin,
  onLeave,
}: InterviewVideoCallProps) {
  const [active, setActive] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function handleJoin() {
    setJoining(true);
    try {
      await onJoin?.();
      setActive(true);
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    setLeaving(true);
    try {
      await onLeave?.();
      setActive(false);
    } finally {
      setLeaving(false);
    }
  }

  if (!active) {
    return (
      <div className="interview-video-call">
        <div className="interview-video-call-intro">
          <strong>{title}</strong>
          <p className="muted">{subtitle}</p>
          {studentName ? (
            <p className="muted" style={{ marginTop: 0 }}>
              Room shared with <strong>{studentName}</strong>
            </p>
          ) : null}
          <button
            type="button"
            className="primary-btn doc-view-btn"
            disabled={joining}
            onClick={() => void handleJoin()}>
            {joining ? 'Joining…' : 'Join in-app video call'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="interview-video-call">
      <div className="interview-video-call-toolbar">
        <strong>{title}</strong>
        <button type="button" className="ghost-btn" disabled={leaving} onClick={() => void handleLeave()}>
          {leaving ? 'Ending…' : 'Leave call'}
        </button>
      </div>
      <iframe
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
        className="interview-video-frame"
        src={joinUrl}
        title={title}
      />
    </div>
  );
}
