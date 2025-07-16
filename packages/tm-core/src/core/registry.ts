import { Tool } from './tool.js'
import { Log } from '../util/log.js'

export namespace Registry {
  const log = Log.create({ service: "registry" })
  
  const registry: Tool.Info[] = []

  export function register(tool: Tool.Info) {
    registry.push(tool)
    log.info('Tool registered', { toolId: tool.id, description: tool.description })
  }

  export function getAll(): Tool.Info[] {
    return [...registry]
  }

  export function findById(id: string): Tool.Info | undefined {
    return registry.find(tool => tool.id === id)
  }

  export function findByDescription(description: string): Tool.Info[] {
    return registry.filter(tool => tool.description.includes(description))
  }

  export function clear() {
    const count = registry.length
    registry.length = 0
    log.info('Registry cleared', { removedCount: count })
  }

  export function size(): number {
    return registry.length
  }

  export function exists(id: string): boolean {
    return registry.some(tool => tool.id === id)
  }
}
