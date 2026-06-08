FROM node:18-slim

WORKDIR /app

# Install OpenSSL which is required by Prisma
RUN apt-get update -y && apt-get install -y openssl

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Expose backend port
EXPOSE 5000

# Start script: Migrate the database to ensure sync, then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
