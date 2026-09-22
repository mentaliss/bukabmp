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
      await write(channel, candidates.get(channel));
      written.push(channel);
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
        await write(channel, previous.get(channel));
      } catch (rollbackError) {
        rollbackErrors.push({channel, error: String(rollbackError?.message || rollbackError)});
      }
    }
    const wrapped = new Error(String(error?.message || error));
    wrapped.rollback_errors = rollbackErrors;
    throw wrapped;
  }
}
