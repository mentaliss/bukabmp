export async function publishAllChannels({
  channels,
  incoming,
  reason,
  sanitize,
  read,
  snapshot,
  write,
  verify
}) {
  if (!Array.isArray(channels) || !channels.length) throw new Error("channels_required");
  const candidates = new Map();
  const previous = new Map();

  // Phase 1: validate all candidates without writing.
  for (const channel of channels) {
    const candidate = sanitize(incoming, channel);
    if (!candidate || typeof candidate !== "object") throw new Error("invalid_candidate:" + channel);
    candidates.set(channel, candidate);
  }

  // Phase 2: capture all current states and durable snapshots before any write.
  for (const channel of channels) {
    const current = await read(channel);
    previous.set(channel, current);
    await snapshot(channel, current, "before_" + reason);
  }

  const written = [];
  try {
    // Phase 3: write all intended states.
    for (const channel of channels) {
      // Mark the channel before the write. A backing store can mutate and then
      // throw, so rollback must include the attempted channel too.
      written.push(channel);
      await write(channel, candidates.get(channel));
    }
    // Phase 4: verify all.
    for (const channel of channels) {
      const ok = await verify(channel, candidates.get(channel));
      if (!ok) throw new Error("verify_failed:" + channel);
    }
    return {ok: true, channels: [...channels]};
  } catch (error) {
    // Phase 5: rollback every channel that may have changed.
    const rollbackErrors = [];
    for (const channel of [...written].reverse()) {
      try {
        const prior = previous.get(channel);
        await write(channel, prior);
        const restored = await verify(channel, prior);
        if (!restored) {
          rollbackErrors.push({channel, error: "rollback_verify_failed"});
        }
      } catch (rollbackError) {
        rollbackErrors.push({channel, error: String(rollbackError?.message || rollbackError)});
      }
    }
    const wrapped = new Error(String(error?.message || error));
    wrapped.rollback_errors = rollbackErrors;
    throw wrapped;
  }
}
