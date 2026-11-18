// Bound concurrent work and report results/errors in input order. Settling the
// whole batch prevents a later rejection from masking an earlier failure.
export async function* orderedBatches(items, read, batchSize = 16) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError("Batch size must be a positive integer");
  }
  for (let offset = 0; offset < items.length; offset += batchSize) {
    const batch = items.slice(offset, offset + batchSize);
    const results = await Promise.allSettled(batch.map(async item => read(item)));
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") throw result.reason;
      yield [batch[index], result.value];
    }
  }
}
