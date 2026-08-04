let accessToken = null;
const tokenListeners = new Set();

function notifyTokenChange() {
  tokenListeners.forEach((listener) => listener(accessToken));
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
  notifyTokenChange();
}

export function clearAccessToken() {
  accessToken = null;
  notifyTokenChange();
}

export function subscribeAccessToken(listener) {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}
