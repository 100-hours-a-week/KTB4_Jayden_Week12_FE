import { MessageComposer } from './MessageComposer.jsx';
import { MessageList } from './MessageList.jsx';
import { ChatSessionFeedback } from './ChatSessionFeedback.jsx';

export function ChatConversation({
  composerRef,
  currentUserId,
  error,
  errorAction,
  feedbackVariant = 'modal',
  messages,
  onSend,
  participant,
  status,
}) {
  return (
    <>
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        target={participant}
        status={status}
      />
      <ChatSessionFeedback action={errorAction} error={error} variant={feedbackVariant} />
      <MessageComposer
        ref={composerRef}
        disabled={status !== 'connected'}
        targetName={participant?.nickname}
        onSend={onSend}
      />
    </>
  );
}
