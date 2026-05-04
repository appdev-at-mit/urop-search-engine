# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts eslint.config.js index.html ./
COPY src/ src/
COPY public/ public/
RUN npm run build

# Stage 2: Install backend dependencies
FROM node:20-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# Stage 3: Production image
FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip
WORKDIR /app

COPY --from=frontend-build /app/dist ./dist
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend/src ./backend/src
COPY backend/package.json ./backend/package.json

# Python relevance ranking scripts
COPY Relevance/requirements.txt Relevance/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r Relevance/requirements.txt
COPY Relevance/*.py Relevance/

ENV NODE_ENV=production
ENV PORT=3001
ENV PYTHON_PATH=python3
EXPOSE 3001

CMD ["node", "backend/src/index.js"]
