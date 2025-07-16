import { Middleware } from '../types.js'

export const mwErrorToResponse: Middleware = async (ctx, next) => {
  try {
    await next()
  } catch (e) {
    ctx.result = { ok: false, error: (e as Error).message }
  }
}
