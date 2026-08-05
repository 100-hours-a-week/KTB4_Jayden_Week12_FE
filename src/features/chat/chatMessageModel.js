export function normalizeHistoryMessage(message) {
  return {
    messageId: message.messageId,
    clientMessageId: message.clientMessageId,
    senderId: message.senderId,
    content: message.deletedAt ? null : message.content,
    chatType: message.chatType,
    createdAt: message.createdAt,
    deletedAt: message.deletedAt,
    status: 'sent',
  };
}

export function normalizeLiveMessage(message) {
  return {
    messageId: message.chatMessageId,
    clientMessageId: message.clientMessageId,
    senderId: message.userId,
    content: message.deletedAt ? null : message.content,
    chatType: message.chatType,
    createdAt: message.createdAt,
    deletedAt: message.deletedAt,
    status: 'sent',
  };
}

export function createOptimisticTextMessage({ clientMessageId, senderId, content, createdAt }) {
  return {
    messageId: null,
    clientMessageId,
    senderId,
    content,
    chatType: 'TEXT',
    createdAt,
    deletedAt: null,
    status: 'sending',
  };
}

function getMessageKeys(message) {
  const keys = [];
  if (message.clientMessageId) keys.push(`client:${message.clientMessageId}`);
  if (message.messageId) keys.push(`message:${message.messageId}`);
  return keys;
}

export function mergeChatMessages(current, incoming, { prepend = false } = {}) {
  const currentMessages = [...current];
  const prependedMessages = [];
  const entriesByKey = new Map();

  const register = (message, collection, index) => {
    const entry = { collection, index };
    getMessageKeys(message).forEach((key) => entriesByKey.set(key, entry));
  };

  currentMessages.forEach((message, index) => register(message, currentMessages, index));

  incoming.forEach((message) => {
    const existing = getMessageKeys(message)
      .map((key) => entriesByKey.get(key))
      .find(Boolean);

    if (existing) {
      const merged = { ...existing.collection[existing.index], ...message };
      existing.collection[existing.index] = merged;
      register(merged, existing.collection, existing.index);
      return;
    }

    const collection = prepend ? prependedMessages : currentMessages;
    const index = collection.push(message) - 1;
    register(message, collection, index);
  });

  return prepend ? [...prependedMessages, ...currentMessages] : currentMessages;
}

export function markMessageFailed(messages, clientMessageId) {
  return messages.map((message) => (
    message.clientMessageId === clientMessageId && message.status === 'sending'
      ? { ...message, status: 'failed' }
      : message
  ));
}
