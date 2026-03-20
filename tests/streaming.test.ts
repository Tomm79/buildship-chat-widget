import test from "node:test";
import assert from "node:assert/strict";

import {
  consumeStreamChunk,
  createStreamAccumulator,
  sanitizeResponseMessage,
} from "../src/streaming.ts";

test("consumeStreamChunk appends message chunks until the thread id separator appears", () => {
  let state = createStreamAccumulator();
  state = consumeStreamChunk(state, "Hel");
  state = consumeStreamChunk(state, "lo");
  state = consumeStreamChunk(state, " world\x1fthread");
  state = consumeStreamChunk(state, "-42");

  assert.equal(state.responseMessage, "Hello world");
  assert.equal(state.responseThreadId, "thread-42");
  assert.equal(state.responseMessageComplete, true);
});

test("sanitizeResponseMessage removes source marker brackets from streamed answers", () => {
  assert.equal(
    sanitizeResponseMessage("Antwort ã€Quelleã€‘ bleibt"),
    "Antwort  bleibt"
  );
});
