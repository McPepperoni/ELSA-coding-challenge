// AI Generated code <PURPOSE>: expose backend REST API app factories
import { createHttpApp } from './app.js'
import { createDefaultHttpDependencies } from './default-dependencies.js'
import { createDefaultWebSocketRoutes } from '../ws/index.js'

export { createHttpApp, type HttpDependencies } from './app.js'

export const createDefaultHttpApp = () => {
  const app = createHttpApp(createDefaultHttpDependencies())
  app.route('/ws', createDefaultWebSocketRoutes())

  return app
}
