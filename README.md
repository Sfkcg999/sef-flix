# SEF-FLIX
Personal Netflix-style web app: Cinemeta catalogs/posters + TorBox streams (TorBox search API, falls back to Torrentio hashes checked against TorBox cache).

## Run locally
    SESSION_SECRET=<random> npm start   # http://localhost:8787
Each visitor signs in with their own TorBox API key (validated via /v1/api/user/me), kept only in an AES-GCM encrypted HttpOnly cookie (400 days, renewed on every visit). SESSION_SECRET keeps sessions valid across restarts.

## Deploy on Render
New > Blueprint > pick this repo (uses render.yaml), SESSION_SECRET is auto-generated. No TorBox key is stored on the server.

## Playback
Each source offers three options. **Play in VLC** streams through the server at `/p/…`. **Play in Safari** plays MP4 directly; for MKV/HEVC it tries TorBox HLS. **Download** uses `/d/…`, an attachment proxy that saves to Files on iPhone. Continue Watching history is stored per browser in localStorage.
