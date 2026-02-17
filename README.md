# GameQuiz Project Setup Guide

This guide explains how to run the GameQuiz frontend and backend locally, and how to expose the frontend using Cloudflare Tunnel for external access. It also covers the necessary Vite configuration for secure connections.

---

## Prerequisites
- Node.js (v16 or newer recommended)
- npm (comes with Node.js)
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/) installed globally

---

## 1. Install Dependencies

### Backend
```
cd server
npm install
```

### Frontend
```
cd ../client
npm install
```

---

## 2. Start the Backend

The backend runs on port **3001** by default.
```
cd server
node index.js
```

---

## 3. Start the Frontend (Vite Dev Server)

The frontend runs on port **5173** by default.
```
cd client
npm run dev
```

---

## 4. Expose the Frontend with Cloudflare Tunnel

In a new terminal, run:
```
cloudflared tunnel --url http://localhost:5173/ protocol --http2
```
- This will provide a public URL (e.g., `https://your-tunnel-id.trycloudflare.com`) that you can share for external access.

---

## 5. Configure Vite for Cloudflare Tunnel

To allow access via the Cloudflare URL and ensure socket.io works:

1. **Edit `client/vite.config.js`**

Add or update the `server` section as follows:

```js
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'your-tunnel-id.trycloudflare.com' // Replace with your actual tunnel URL
    ],
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001', // Backend port
        ws: true,
        changeOrigin: true,
      }
    }
  }
})
```

- Replace `'your-tunnel-id.trycloudflare.com'` with the actual hostname from your cloudflared output.
- Save the file and restart the Vite dev server (`npm run dev`).

---

## 6. Accessing the App

- Open the Cloudflare tunnel URL in your browser (on your phone or any device).
- The frontend will proxy all `/socket.io` requests to your local backend, so multiplayer and real-time features will work externally.

---

## Troubleshooting
- If you see certificate errors, make sure you are not using a hardcoded backend URL in the frontend.
- If you get 500 errors, ensure both frontend and backend are running, and the proxy target port matches your backend.
- Always restart the Vite dev server after editing `vite.config.js`.

---

Enjoy your GameQuiz app!
