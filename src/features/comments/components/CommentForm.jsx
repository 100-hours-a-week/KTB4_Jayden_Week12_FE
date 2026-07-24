import { useEffect, useRef, useState } from 'react';

function getSubmitError(error, mode) {
  if (error?.status === 403) return '이 댓글을 변경할 권한이 없습니다.';
  if (error?.status === 400) return '입력 내용을 확인해주세요.';
  return `${mode}에 실패했습니다. 입력 내용은 유지됩니다.`;
}

export function CommentForm({
  mode = '댓글 등록',
  initialValue = '',
  placeholder = '댓글을 남겨주세요!',
  onSubmit,
  onCancel,
  variant = 'create',
  autoFocus = false,
  disabled = false,
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);
  const submittingRef = useRef(false);
  const trimmedValue = value.trim();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!trimmedValue || disabled || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmedValue);
      setValue('');
    } catch (submitError) {
      setError(submitError);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const className = variant === 'create'
    ? `comment-form${trimmedValue ? ' comment-form-valid' : ''}`
    : `comment-edit-form comment-edit-form--${variant}`;

  return (
    <form className={className} onSubmit={handleSubmit} noValidate>
      <label className="sr-only" htmlFor={`${variant}-comment-input`}>{mode}</label>
      <textarea
        id={`${variant}-comment-input`}
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled || isSubmitting}
      />
      {error && <p className="comment-form__error" role="alert">{getSubmitError(error, mode)}</p>}
      <div className={variant === 'create' ? 'comment-form__footer' : 'comment-edit-form__actions'}>
        {variant === 'create' && <span>{mode}</span>}
        {onCancel && <button className="button button--secondary" type="button" onClick={onCancel} disabled={disabled || isSubmitting}>취소</button>}
        <button
          className={`button button--primary${variant === 'create' ? ' comment-submit-button' : ''}${!trimmedValue ? ' is-disabled' : ''}`}
          type="submit"
          disabled={!trimmedValue || disabled || isSubmitting}
        >
          {isSubmitting ? '처리 중…' : mode}
        </button>
      </div>
    </form>
  );
}
