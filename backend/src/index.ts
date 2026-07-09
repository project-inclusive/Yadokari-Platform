import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { getScrapingRoute } from './routes/scrape.js'
import { getChatRoute } from './routes/chat.js'

// 環境変数の読み込み (.envはプロジェクトルートにあるので、そこから探す)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }) // frontend, backend と同階層のルートにある .env

const app = new Hono()

// CORSの設定 (開発用途で念のため)
app.use('/api/*', cors())

// ルート登録
app.route('/api/scrape', getScrapingRoute())
app.route('/api/chat', getChatRoute())

app.get('/', (c) => {
  return c.text('Yadokari BFF is running!')
})

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000

serve({
  fetch: app.fetch,
  port: port
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
