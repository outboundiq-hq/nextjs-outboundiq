/** Parse `OUTBOUNDIQ_*` env vars for `@outbound_iq/nextjs`. */

function parseEnabled(raw: string | undefined): boolean {
  if (raw === undefined || raw === '') {
    return true;
  }
  const v = raw.toLowerCase().trim();

  return !['false', '0', 'no', 'off'].includes(v);
}


export function isOutboundIQEnabled(): boolean {
  return parseEnabled(process.env.OUTBOUNDIQ_ENABLED);
}


export function getOutboundIQMaxItemsFromEnv(): number {
  const fromMax = process.env.OUTBOUNDIQ_MAX_ITEMS;
  const fromBatch = process.env.OUTBOUNDIQ_BATCH_SIZE;
  const raw = fromMax !== undefined && fromMax !== '' ? fromMax : fromBatch;
  if (raw === undefined || raw === '') {
    return 100;
  }
  const n = parseInt(raw, 10);

  return Number.isFinite(n) && n > 0 ? n : 100;
}


export function getOutboundIQFlushIntervalFromEnv(): number {
  const raw = process.env.OUTBOUNDIQ_FLUSH_INTERVAL;
  if (raw === undefined || raw === '') {
    return 5000;
  }
  const n = parseInt(raw, 10);

  return Number.isFinite(n) && n >= 0 ? n : 5000;
}
