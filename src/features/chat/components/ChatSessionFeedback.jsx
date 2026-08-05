export function ChatSessionFeedback({ action, error, variant = 'modal' }) {
  if (!error) return null;
  if (variant === 'room') {
    return (
      <div className="chat-room-error" role="alert">
        <p>{error}</p>
        {action}
      </div>
    );
  }
  return <p className="chat-error" role="alert">{error}</p>;
}
