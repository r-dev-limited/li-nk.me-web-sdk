/** Bounds the complete operation, even when an injected transport ignores abort. */
export class RequestScope {
    private readonly active = new Set<AbortController>();

    cancelAll(): void {
        for (const controller of [...this.active]) controller.abort(abortError());
    }

    async run<T>(timeoutMs: number, operation: (signal: AbortSignal) => Promise<T>, signals: ReadonlyArray<AbortSignal | null | undefined> = []): Promise<T> {
        const controller = new AbortController();
        this.active.add(controller);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const externalAbort = () => controller.abort(abortError());
        let onAbort: () => void = () => {};
        try {
            return await new Promise<T>((resolve, reject) => {
                onAbort = () => reject(controller.signal.reason instanceof Error ? controller.signal.reason : abortError());
                controller.signal.addEventListener('abort', onAbort, { once: true });
                for (const signal of signals) signal?.addEventListener('abort', externalAbort, { once: true });
                if (signals.some((signal) => signal?.aborted)) externalAbort();
                timer = setTimeout(() => {
                    const error = new Error('LinkMe request deadline exceeded');
                    error.name = 'TimeoutError';
                    controller.abort(error);
                }, timeoutMs);
                Promise.resolve().then(() => {
                    if (controller.signal.aborted) throw controller.signal.reason ?? abortError();
                    return operation(controller.signal);
                }).then(resolve, reject);
            });
        } finally {
            if (timer !== undefined) clearTimeout(timer);
            for (const signal of signals) signal?.removeEventListener('abort', externalAbort);
            controller.signal.removeEventListener('abort', onAbort);
            this.active.delete(controller);
        }
    }
}

function abortError(): Error {
    const error = new Error('LinkMe request cancelled');
    error.name = 'AbortError';
    return error;
}

export function normalizeRequestTimeout(value: number | undefined): number {
    const timeout = value ?? 15_000;
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 2_147_483_647) {
        throw new RangeError('requestTimeoutMs must be an integer from 1 to 2147483647');
    }
    return timeout;
}
