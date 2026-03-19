# Use the official Playwright image as base (contains Node.js and all browser dependencies)
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including production and dev for build)
RUN npm install

# Create a public directory for local feed storage
RUN mkdir -p public

# Copy source code
COPY . .

# Build the application (TypeScript to JavaScript)
RUN npm run build

# Expose the API port
EXPOSE 3001

# Start the server
# Note: npm start runs 'node dist/main.js' or 'tsx src/server.ts' based on your package.json
CMD ["npm", "start"]
