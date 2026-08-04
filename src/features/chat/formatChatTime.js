export function formatChatRelativeTime(createdAt, now = new Date()) {
  const created = new Date(createdAt);
  const difference = now.getTime() - created.getTime();
  if (!Number.isFinite(created.getTime()) || difference < 0) return '';

  const minutes = Math.floor(difference / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  if (hours < 48) return '어제';
  return `${Math.floor(hours / 24)}일 전`;
}

export function formatChatDateTitle(createdAt) {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
}
