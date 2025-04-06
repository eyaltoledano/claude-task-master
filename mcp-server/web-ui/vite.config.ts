import path from "path"
import fs from "fs"
import { defineConfig, Plugin } from 'vite' // Import Plugin type
import react from '@vitejs/plugin-react'

// Custom Vite plugin to serve tasks.json
const serveTasksJsonPlugin = (): Plugin => ({
  name: 'serve-tasks-json',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/tasks.json') {
        const tasksPath = path.resolve(__dirname, '../../tasks/tasks.json');
        console.log(`Plugin: Attempting to serve tasks from ${tasksPath}`);
        try {
          if (fs.existsSync(tasksPath)) {
            const tasksContent = fs.readFileSync(tasksPath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(tasksContent);
            console.log(`Plugin: Successfully served ${tasksPath}`);
          } else {
            console.error(`Plugin: Tasks file not found at ${tasksPath}`);
            res.statusCode = 404;
            res.end(JSON.stringify({ error: `Tasks file not found at ${tasksPath}` }));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Plugin: Error reading tasks file: ${errorMessage}`);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: `Error reading tasks file: ${errorMessage}` }));
        }
      } else {
        next(); // Pass request to next middleware
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    serveTasksJsonPlugin() // Add the custom plugin
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    fs: {
      // Allow serving files from one level up to access tasks.json
      allow: ['..']
    }
  }
})
