# ---- Build Stage ----
FROM node:22-alpine as build

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar código y construir NestJS
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine

WORKDIR /app

# Copiar dependencias de producción (excluyendo tests, ts-node, etc)
COPY package*.json ./
RUN npm install --omit=dev

# Copiar compilado desde la etapa de construcción
COPY --from=build /app/dist ./dist

EXPOSE 3001

# Iniciar la aplicación
CMD ["node", "dist/main"]
