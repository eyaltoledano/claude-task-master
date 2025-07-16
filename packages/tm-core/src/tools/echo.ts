import { z } from 'zod'
import { Tool } from '../core/tool.js'

export const echoTool = Tool.define({
  id: 'echo',
  description: 'Echo back the input string',
  parameters: z.object({ text: z.string() }),
  async execute({ text }) {
    return {
      title: 'Echo Response',
      output: `You said: ${text}`
    }
  }
})
