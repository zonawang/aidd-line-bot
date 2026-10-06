import { createHmac, randomBytes } from 'node:crypto';

interface NoticeState {
  phase: 'pending' | 'confirmed';
  eventTime: number;
  expires: number;
}

export class ControlState {
  readonly #key = randomBytes(32);
  readonly #events = new Map<string, number>();
  readonly #notices = new Map<string, NoticeState>();
  readonly #clock: () => number;
  readonly #capacity: number;
  readonly #noticeTtl: number;
  readonly #expiryTimer: NodeJS.Timeout;

  constructor(options: { clock?: () => number; capacity?: number; noticeTtl?: number } = {}) {
    this.#clock = options.clock ?? (() => performance.now());
    this.#capacity = options.capacity ?? 4096;
    this.#noticeTtl = options.noticeTtl ?? 15 * 60 * 1000;
    if (
      !Number.isInteger(this.#capacity) ||
      this.#capacity < 1 ||
      !Number.isFinite(this.#noticeTtl) ||
      this.#noticeTtl <= 0
    )
      throw new Error('控制狀態設定不合法');
    this.#expiryTimer = setInterval(
      () => {
        this.#prune();
      },
      Math.min(this.#noticeTtl, 1000),
    );
    this.#expiryTimer.unref();
  }

  #digest(kind: string, value: string): string {
    return createHmac('sha256', this.#key).update(kind).update(value).digest('hex');
  }

  #prune(): void {
    const now = this.#clock();
    for (const [key, expires] of this.#events) if (expires <= now) this.#events.delete(key);
    for (const [key, notice] of this.#notices) if (notice.expires <= now) this.#notices.delete(key);
  }

  claimEvent(id: string): 'new' | 'duplicate' | 'full' {
    this.#prune();
    const key = this.#digest('event', id);
    if (this.#events.has(key)) return 'duplicate';
    if (this.#events.size >= this.#capacity) return 'full';
    this.#events.set(key, this.#clock() + 24 * 60 * 60 * 1000 + 5 * 60 * 1000);
    return 'new';
  }

  notice(userId: string): NoticeState | undefined {
    this.#prune();
    const state = this.#notices.get(this.#digest('user', userId));
    return state ? { ...state } : undefined;
  }

  rememberNotice(userId: string, eventTime: number): boolean {
    this.#prune();
    const key = this.#digest('user', userId);
    if (!this.#notices.has(key) && this.#notices.size >= this.#capacity) return false;
    this.#notices.set(key, {
      phase: 'pending',
      eventTime,
      expires: this.#clock() + this.#noticeTtl,
    });
    return true;
  }

  confirm(userId: string, eventTime: number): boolean {
    const state = this.notice(userId);
    if (!state || state.phase !== 'pending' || eventTime < state.eventTime) return false;
    this.#notices.set(this.#digest('user', userId), {
      phase: 'confirmed',
      eventTime,
      expires: this.#clock() + this.#noticeTtl,
    });
    return true;
  }

  clear(): void {
    clearInterval(this.#expiryTimer);
    this.#events.clear();
    this.#notices.clear();
  }
  sizes(): { events: number; notices: number } {
    this.#prune();
    return { events: this.#events.size, notices: this.#notices.size };
  }
}
