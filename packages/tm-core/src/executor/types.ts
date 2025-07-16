import { Tool } from '../core/tool.js'

export interface MiddlewareCtx {
  tool: Tool.Info
  params: unknown      // validated value later
  result?: unknown
  meta: Record<string, unknown>
}

export type Middleware = (ctx: MiddlewareCtx, next: () => Promise<void>) => Promise<void>
