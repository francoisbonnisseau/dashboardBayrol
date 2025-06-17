import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory
  const env = loadEnv(mode, process.cwd(), '')
  
  // Only expose specific environment variables that are safe for client-side
  // and prefix them properly with VITE_ as per Vite's recommendation
  const envWithProcessPrefix: Record<string, string> = {}
  Object.entries(env).forEach(([key, val]) => {
    // Only include environment variables that start with VITE_ for client-side use
    if (key.startsWith('VITE_')) {
      envWithProcessPrefix[`process.env.${key}`] = JSON.stringify(val)
    }
  })
  
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: envWithProcessPrefix
  }
})
