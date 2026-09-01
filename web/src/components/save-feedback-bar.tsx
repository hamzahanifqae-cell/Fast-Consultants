import { useSaveFeedbackStore } from '@/stores/save-feedback-store';

import './save-feedback-bar.css';

export function SaveFeedbackBar() {
  const message = useSaveFeedbackStore((state) => state.message);
  const visible = useSaveFeedbackStore((state) => state.visible);
  const hide = useSaveFeedbackStore((state) => state.hide);

  if (!visible || !message) {
    return null;
  }

  return (
    <div aria-live="polite" className="save-feedback-bar" role="status">
      <span aria-hidden className="save-feedback-bar-icon">
        ✓
      </span>
      <span className="save-feedback-bar-copy">{message}</span>
      <button aria-label="Dismiss" className="save-feedback-bar-dismiss" type="button" onClick={hide}>
        ×
      </button>
    </div>
  );
}
