# Despliegue de Futurar en Servidor Ubuntu/Debian

Este directorio contiene todo lo necesario para levantar Futurar en un entorno de producción usando Docker.

## Pasos para Desplegar

### 1. Preparar el Servidor
- Debes conectarte por SSH a tu servidor.
- Asegúrate de tener **Docker** y **Docker Compose** instalados o instálalos:
  \`\`\`bash
  sudo apt update
  sudo apt install docker.io docker-compose -y
  \`\`\`

### 2. Copiar los archivos
Copia **únicamente la carpeta `deploy/`** entera desde tu computadora hacia una ubicación en tu servidor (por ejemplo: `/var/www/futurar`).
Puedes hacerlo a través de SFTP, SCP, o arrastrando la carpeta si usas un panel de control web.

Esta carpeta ya contiene **todo el código fuente necesario** y la configuración de Docker.

\`\`\`bash
# Ejemplo si usas scp desde tu PC local al servidor
scp -r ./deploy/ usuario@tu-ip-servidor:/ruta/destino
\`\`\`

### 3. Configurar Entorno
Entra a la carpeta que acabas de copiar y crea el archivo de variables:
\`\`\`bash
cd /ruta/destino/deploy
cp .env.example .env
nano .env  # Edita las variables y guarda
\`\`\`

**Importante:** Asegúrate de colocar las credenciales \`SUPABASE_URL\` y \`SUPABASE_SERVICE_KEY\` correctas en el archivo \`.env\`.

### 4. Construir y Levantar
Ejecuta Docker Compose para compilar y arrancar la aplicación en segundo plano (\`-d\`):
\`\`\`bash
sudo docker-compose up --build -d
\`\`\`

### 5. Actualizar la App en el futuro
Cada vez que tengas cambios nuevos en tu código local, para actualizar el servidor solo debes:

1. Volver a copiar la carpeta `deploy/` desde tu PC al servidor, reemplazando la anterior.
2. Reconstruir los contenedores:
\`\`\`bash
cd /ruta/destino/deploy
sudo docker-compose up --build -d
\`\`\`

### Troubleshooting
Si la aplicación marca errores de API:
- Verifica los logs del backend para ver si tiene permisos de base de datos correctos: \`sudo docker logs futurar_prod_backend -f\`
- Verifica que el puerto 80 del servidor esté abierto en el Firewall de tu proveedor Cloud (AWS, DigitalOcean, etc).
