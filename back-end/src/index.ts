import { env } from './config/env.js'
import { createDefaultHttpApp } from './http/index.js'
import { connectRedis } from './redis/client.js'

await connectRedis()

const app = createDefaultHttpApp()

// AI Generated code <PURPOSE>: bind Bun server to typed runtime port
export default {
  port: env.PORT,
  fetch: app.fetch.bind(app),
}
