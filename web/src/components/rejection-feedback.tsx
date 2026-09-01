import './rejection-feedback.css';

type RejectionFeedbackProps = {
  reason: string;
};

export function RejectionFeedback({ reason }: RejectionFeedbackProps) {
  return (
    <div className="rejection-feedback" role="note" aria-label="Reviewer feedback">
      <span className="rejection-feedback-label">Reviewer feedback</span>
      <p className="rejection-feedback-body">{reason}</p>
    </div>
  );
}
