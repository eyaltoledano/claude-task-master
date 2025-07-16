import { Middleware, MiddlewareCtx } from './types.js'
import { Tool } from '../core/tool.js'
import { Log } from '../util/log.js'
import { z } from 'zod'

export namespace Executor {
  const log = Log.create({ service: "executor" })
  let middleware: Middleware[] = []
  let composed!: (ctx: MiddlewareCtx) => Promise<void>
  let ready = false

  export function use(mw: Middleware) {
    if (ready) throw new Error('executor frozen')
    middleware.push(mw)
  }

  export function init() {
    if (ready) throw new Error('already initialised')
    // build right-to-left
    composed = middleware.reduceRight(
      (next: (ctx: MiddlewareCtx) => Promise<void>, mw: Middleware) => 
        async (ctx: MiddlewareCtx) => mw(ctx, () => next(ctx)),
      async (ctx: MiddlewareCtx) => {
        const { tool, params } = ctx
        const validated = (tool.parameters as z.ZodTypeAny).parse(params)
        const result = await tool.execute(validated, { metadata: ctx.meta, logger: log.clone().tag('tool', tool.id) })
        ctx.result = result.output
      }
    )
    ready = true
  }

  export async function execute(tool: Tool.Info, params: unknown, meta: Record<string, unknown> = {}) {
    if (!ready) throw new Error('executor not initialised')
    const ctx: MiddlewareCtx = { tool, params, meta }
    await composed(ctx)
    return ctx.result
  }

  export function reset() {
    middleware = []
    ready = false
  }
}
