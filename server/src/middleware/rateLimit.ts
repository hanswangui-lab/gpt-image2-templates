import type { Request, Response, NextFunction } from 'express'

interface Window {
  timestamps: number[]
}

const stores = new Map<string, Map<string, Window>>()

function getStore(name: string): Map<string, Window> {
  if (!stores.has(name)) stores.set(name, new Map())
  return stores.get(name)!
}

// Periodic cleanup every 5 minutes
setInterval(() => {
  for (const store of stores.values()) {
    for (const [key, w] of store) {
      const cutoff = Date.now() - 60_000
      w.timestamps = w.timestamps.filter((t) => t > cutoff)
      if (w.timestamps.length === 0) store.delete(key)
    }
  }
}, 5 * 60 * 1000).unref()

export function rateLimit(opts: { max: number; windowMs: number; keyFn?: (req: Request) => string }) {
  const store = getStore(opts.max + '_' + opts.windowMs)

  return (req: Request, res: Response, next: NextFunction) => {
    const key = opts.keyFn ? opts.keyFn(req) : (req.userId || req.ip || 'anonymous')
    const now = Date.now()
    const cutoff = now - opts.windowMs

    let w = store.get(key)
    if (!w) {
      w = { timestamps: [] }
      store.set(key, w)
    }

    w.timestamps = w.timestamps.filter((t) => t > cutoff)
    if (w.timestamps.length >= opts.max) {
      res.status(429).json({ error: '请求过于频繁，请稍后再试' })
      return
    }

    w.timestamps.push(now)
    next()
  }
}
