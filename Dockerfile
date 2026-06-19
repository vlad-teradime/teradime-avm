FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* .npmrc* ./
RUN npm install --production=false

# Copy source code
COPY . .

# Build the app (compiles TypeScript, bundles frontend)
RUN npm run build

# Expose the port Railway assigns (default 5000)
EXPOSE ${PORT:-5000}

ENV NODE_ENV=production
CMD ["node", "dist/index.cjs"]
