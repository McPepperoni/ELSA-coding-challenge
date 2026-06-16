import { Hono } from 'hono'
import { env } from './config/env.js'

const app = new Hono()

const welcomeStrings = [
  'Hello Hono!',
  'To learn more about Hono on Vercel, visit https://vercel.com/docs/frameworks/backend/hono'
]

app.get('/', (c) => {
  return c.text(welcomeStrings.join('\n\n'))
})

// AI Generated code <PURPOSE>: bind Bun server to typed runtime port
export default {
  port: env.PORT,
  fetch: app.fetch.bind(app),
}
