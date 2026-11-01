# Fusion
Personal Netflix-style web app: Cinemeta catalogs/posters + TorBox streams (TorBox search API, falls back to Torrentio hashes checked against TorBox cache).

## Run locally
    TORBOX_API_KEY=... APP_PASSWORD=... npm start   # http://localhost:8787
(If APP_PASSWORD is unset, the password is read from PASSWORD.txt.)

## Deploy on Render
New > Blueprint > pick this repo (uses render.yaml), then set TORBOX_API_KEY and APP_PASSWORD.
