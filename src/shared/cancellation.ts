export function isCancelled(signal: AbortSignal): boolean {
  return signal.aborted;
}
