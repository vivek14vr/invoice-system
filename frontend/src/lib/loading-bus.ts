type Listener = (count: number) => void;

let pending = 0;
const listeners = new Set<Listener>();

export function notifyLoadingStart() {
  pending += 1;
  listeners.forEach((l) => l(pending));
}

export function notifyLoadingStop() {
  pending = Math.max(0, pending - 1);
  listeners.forEach((l) => l(pending));
}

export function subscribeLoading(listener: Listener) {
  listeners.add(listener);
  listener(pending);
  return () => {
    listeners.delete(listener);
  };
}
