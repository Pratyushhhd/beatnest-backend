# BeatNest API — production image. Build from the project root:
#   docker build -f backend/Dockerfile -t beatnest-api .
FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY backend/package*.json ./
RUN npm install --omit=dev

# Backend code + shared music assets.
COPY backend/ ./
COPY music/ ../music/

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "server.js"]