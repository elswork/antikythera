# Usamos una imagen ligera de Nginx basada en Alpine Linux
FROM nginx:alpine

# Copiamos todos los archivos estáticos de nuestro proyecto al directorio de Nginx
COPY . /usr/share/nginx/html

# Nginx expone por defecto el puerto 80
EXPOSE 80

# Comando para ejecutar Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
