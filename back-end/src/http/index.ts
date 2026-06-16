// AI Generated code <PURPOSE>: expose backend REST API app factories
import { createHttpApp } from './app.js'
import { createDefaultHttpDependencies } from './default-dependencies.js'

export { createHttpApp, type HttpDependencies } from './app.js'

export const createDefaultHttpApp = () => createHttpApp(createDefaultHttpDependencies())
