import { z, ZodTypeAny } from 'zod'
import { Log } from '../util/log.js'

export namespace Tool {
  const log = Log.create({ service: "tool" })

  export interface Context {
    metadata: Record<string, unknown>
    logger: Log.Logger
  }

  export interface Result<T = unknown> {
    title?: string
    metadata?: Record<string, unknown>
    output: T
  }

  export interface Info<
    P extends ZodTypeAny = ZodTypeAny,
    R = unknown
  > {
    id: string
    description: string
    parameters: P
    execute(args: z.infer<P>, ctx: Context): Promise<Result<R>>
  }

  export function define<P extends ZodTypeAny, R>(
    spec: Omit<Info<P, R>, 'execute'> & { 
      execute: (args: z.infer<P>, ctx: Context) => Promise<Result<R>>
    }
  ): Info<P, R> {
    return spec
  }
}
