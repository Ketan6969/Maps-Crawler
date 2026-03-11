FROM mcr.microsoft.com/playwright:v1.41.0-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (only production if building, but we need typescript here or pre-build step)
RUN npm install

# Copy source code
COPY . .

# Build typescript code (you can separate this into a multi-stage build, but this works for now)
RUN npx tsc

# Environment variables
ENV PORT=3000
ENV MAX_BROWSERS=4
ENV SCRAPER_DELAY_MIN=2000
ENV SCRAPER_DELAY_MAX=6000

# Expose API port
EXPOSE $PORT

# Start application
CMD ["node", "dist/server.js"]
