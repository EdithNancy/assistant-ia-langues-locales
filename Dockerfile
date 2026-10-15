# ==========================================
# ÉTAPE 1 : Build de l'application
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copie et installation des dépendances (optimisation du cache Docker)
COPY package*.json ./
RUN npm ci

# Copie du reste du code source
COPY . .

# Variables d'environnement pour le build si nécessaire
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Génération du bundle de production (dist pour Vite, build pour CRA)
RUN npm run build

# ==========================================
# ÉTAPE 2 : Serveur web NGINX de production
# ==========================================
FROM nginx:alpine-slim AS production

# Suppression des fichiers NGINX par défaut
RUN rm -rf /usr/share/nginx/html/*

# Copie de la configuration NGINX personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copie des fichiers statiques générés depuis l'étape 'builder'
# Remplace 'dist' par 'build' si tu utilises Create React App
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]