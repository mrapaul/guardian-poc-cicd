# Simple unified Dockerfile for Guardian Platform PoC
FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache \
    curl \
    python3 \
    make \
    g++

# Create app directory
WORKDIR /app

# Create a simple package.json
RUN echo '{ \
  "name": "guardian-platform", \
  "version": "1.0.0", \
  "scripts": { \
    "start": "node server.js" \
  }, \
  "dependencies": { \
    "express": "^4.18.0", \
    "cors": "^2.8.5" \
  } \
}' > package.json

# Install dependencies
RUN npm install

# Create a simple server
RUN echo 'const express = require("express"); \
const cors = require("cors"); \
const app = express(); \
app.use(cors()); \
app.use(express.json()); \
app.get("/health", (req, res) => res.json({ status: "ok", service: "guardian-platform" })); \
app.get("/", (req, res) => res.send("Guardian Security Platform - PoC")); \
const PORT = process.env.PORT || 8080; \
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));' > server.js

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start the app
CMD ["node", "server.js"]