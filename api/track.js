import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { user_id, week } = req.body || {};

  if (
    typeof user_id !== 'string' || user_id.length < 8 || user_id.length > 64 ||
    typeof week !== 'string' || !/^\d{4}-W\d{2}$/.test(week)
  ) {
    return res.status(400).end();
  }

  await redis.sadd(`rw:${week}`, user_id);

  return res.status(200).json({ ok: true });
}

