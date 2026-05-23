import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import fs from 'fs'

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })

const __dirname = dirname(fileURLToPath(import.meta.url))

// imagesDir: local images storage directory, defaults to ./generated-images
const defaultImagesDir = resolve(__dirname, '..', 'generated-images')
const imagesDir = process.env.IMAGES_DIR || defaultImagesDir
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  bestapiUrl: process.env.BESTAPI_URL || '',
  bestapiKey: process.env.BESTAPI_KEY || '',
  imageGenerationCost: parseInt(process.env.IMAGE_GENERATION_COST || '5', 10),
  imagesDir,
  imageBaseUrl: process.env.IMAGE_BASE_URL || `http://localhost:${parseInt(process.env.PORT || '3001', 10)}`,
  payment: {
    gateway: process.env.PAYMENT_GATEWAY || '',
    pid: process.env.PAYMENT_PID || '',
    key: process.env.PAYMENT_KEY || '',
    notifyUrl: process.env.PAYMENT_NOTIFY_URL || '',
    returnUrl: process.env.PAYMENT_RETURN_URL || '',
  },
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',').map(s => s.trim()),
  // Optional HTTPS. Set SSL_KEY_PATH & SSL_CERT_PATH to enable native TLS.
  // For production, using nginx/Caddy reverse proxy is recommended instead.
  ssl: {
    keyPath: process.env.SSL_KEY_PATH || '',
    certPath: process.env.SSL_CERT_PATH || '',
  },
  validCreditPacks: [
    { credits: 200, priceCents: 200 },
    { credits: 1100, priceCents: 1000 },
    { credits: 10500, priceCents: 9900 },
  ],
}
