import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import https from 'https'
import http from 'http'
import fs from 'fs'
import { config } from './config.js'

// Global error handlers — prevent crash from unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[global] unhandledRejection:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[global] uncaughtException:', err.message, err.stack?.slice(0, 300))
})
import generateRouter from './routes/generate.js'
import adminRouter from './routes/admin.js'
import paymentRouter from './routes/payment.js'
import creditRouter from './routes/credit.js'
import healthRouter from './routes/health.js'
import announcementsRouter from './routes/announcements.js'
import authRouter from './routes/auth.js'
import aiwindRouter from './routes/aiwind.js'
import { cleanupExpiredImages, expireCredits } from './services/cleanup.js'
import { processCallback, processZhifuxpayCallback } from './services/payment.js'
import { loadSettings } from './services/settings.js'

const app = express()

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || config.corsOrigins.includes(origin)) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'))
    }
  },
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.path}`)
  next()
})

// Serve generated images from local disk
app.use('/images', express.static(config.imagesDir, { maxAge: '48h' }))

app.use('/api/generate', generateRouter)
app.use('/api/admin', adminRouter)
app.use('/api/payment', paymentRouter)
app.use('/api/credit', creditRouter)
app.use('/health', healthRouter)
app.use('/api/announcements', announcementsRouter)
app.use('/api/auth', authRouter)
app.use('/api/aiwind-templates', aiwindRouter)

// FM/Zhifuxpay callback — public, no auth
app.all('/api/zhifuxpay/notify', async (req, res) => {
  console.log('[zhifuxpay] === RAW CALLBACK ===')
  console.log('[zhifuxpay] Method:', req.method)
  console.log('[zhifuxpay] Content-Type:', req.headers['content-type'])
  console.log('[zhifuxpay] Query:', JSON.stringify(req.query))
  console.log('[zhifuxpay] Body:', JSON.stringify(req.body))
  if (req.is('text/*') || !req.headers['content-type']) {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk.toString() })
    req.on('end', () => { console.log('[zhifuxpay] Raw body string:', raw) })
  }

  const params: Record<string, string> = { ...req.query as any, ...req.body as any }
  console.log('[zhifuxpay] Merged params:', JSON.stringify(params))

  try {
    const result = await processZhifuxpayCallback(params)
    console.log('[zhifuxpay] Result:', JSON.stringify(result))
    res.send(result.message)
  } catch (err: any) {
    console.error('[zhifuxpay] Callback error:', err)
    res.status(500).send('fail')
  }
})

// Cleanup cron: every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  try {
    await cleanupExpiredImages()
    await expireCredits()
  } catch (err) {
    console.error('[cleanup] Error:', err)
  }
})

async function start() {
  await loadSettings()

  const sslKey = config.ssl.keyPath ? fs.readFileSync(config.ssl.keyPath) : null
  const sslCert = config.ssl.certPath ? fs.readFileSync(config.ssl.certPath) : null

  if (sslKey && sslCert) {
    https.createServer({ key: sslKey, cert: sslCert }, app).listen(config.port, () => {
      console.log(`Server running on https://localhost:${config.port}`)
    })
  } else {
    http.createServer(app).listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`)
      if (!config.ssl.keyPath) {
        console.log('  Hint: set SSL_KEY_PATH + SSL_CERT_PATH in .env to enable HTTPS,')
        console.log('  or use nginx/Caddy as a reverse proxy with auto-TLS.')
      }
    })
  }
}

start()
