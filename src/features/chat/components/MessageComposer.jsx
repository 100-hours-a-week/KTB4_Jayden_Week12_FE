import { forwardRef, useId, useState } from 'react';

export const MessageComposer = forwardRef(function MessageComposer({
  disabled,
  targetName,
  onSend,
}, ref) {
  const [content, setContent] = useState('');
  const inputId = useId();
  const trimmed = content.trim();

  const submit = (event) => {
    event.preventDefault();
    if (onSend(content)) setContent('');
  };

  return (
    <form className="chat-composer" onSubmit={submit}>
      <label className="sr-only" htmlFor={inputId}>메시지</label>
      <textarea
        ref={ref}
        id={inputId}
        rows="1"
        maxLength="1000"
        value={content}
        disabled={disabled}
        placeholder={`${targetName || '상대방'}님에게 메시지 보내기`}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <button type="submit" disabled={disabled || !trimmed} aria-label="메시지 전송">
        <span aria-hidden="true">➤</span>
      </button>
    </form>
  );
});
