export const STREAM_THREAD_ID_SEPARATOR = "\x1f";

export type StreamAccumulator = {
  responseMessage: string;
  responseThreadId: string;
  responseMessageComplete: boolean;
};

export function createStreamAccumulator(): StreamAccumulator {
  return {
    responseMessage: "",
    responseThreadId: "",
    responseMessageComplete: false,
  };
}

export function consumeStreamChunk(
  accumulator: StreamAccumulator,
  decodedChunk: string
): StreamAccumulator {
  if (decodedChunk.includes(STREAM_THREAD_ID_SEPARATOR)) {
    const [message, threadId] = decodedChunk.split(STREAM_THREAD_ID_SEPARATOR);
    return {
      responseMessage: accumulator.responseMessage + message,
      responseThreadId: accumulator.responseThreadId + threadId,
      responseMessageComplete: true,
    };
  }

  if (accumulator.responseMessageComplete) {
    return {
      ...accumulator,
      responseThreadId: accumulator.responseThreadId + decodedChunk,
    };
  }

  return {
    ...accumulator,
    responseMessage: accumulator.responseMessage + decodedChunk,
  };
}

export function sanitizeResponseMessage(message: string) {
  return message.replace(/ã€[^ã€‘]*ã€‘/g, "");
}

export function createAsyncLatestValueScheduler<T>(
  flush: (value: T) => Promise<void> | void,
  delayMs = 16
) {
  let latestValue: T | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingFlush = Promise.resolve();

  const flushLatest = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (latestValue === null) {
      return pendingFlush;
    }

    const valueToFlush = latestValue;
    latestValue = null;
    pendingFlush = pendingFlush.then(() => flush(valueToFlush));
    return pendingFlush;
  };

  return {
    schedule(value: T) {
      latestValue = value;
      if (!timer) {
        timer = setTimeout(() => {
          void flushLatest();
        }, delayMs);
      }
    },
    flush: flushLatest,
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      latestValue = null;
    },
  };
}
