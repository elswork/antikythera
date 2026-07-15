# ⚙️ Mecanismo de Anticitera - Simulador Interactivo

[![Docker](https://img.shields.io/badge/Docker-enabled-blue.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Nginx](https://img.shields.io/badge/Nginx-alpine-emerald.svg?logo=nginx&logoColor=white)](https://nginx.org/)

Este proyecto es una simulación interactiva de alta fidelidad visual y matemática del **Mecanismo de Anticitera**, considerado la primera computadora analógica de la historia de la humanidad (c. 150 - 100 a.C.). 

La aplicación permite explorar las órbitas solares y lunares, ver cómo interactúan físicamente los engranajes de bronce de la máquina y predecir eclipses mediante los ciclos espirales posteriores.

🔗 **Desplegado en:** [https://antikythera.deft.work](https://antikythera.deft.work)

---

## 🏛️ Características Principales

1. **Esfera Frontal (Front Dial):** Muestra el calendario solar civil egipcio (365 días) y el zodíaco griego. Incluye una esfera bicolor en 3D que rota para ilustrar las fases de la Luna en tiempo real.
2. **Tren de Engranajes Internos:** Renderizado en tiempo real en un lienzo de Canvas de HTML5. Las rotaciones y engranes respetan los ratios y dientes históricos (ej. la rueda de 127 dientes para calcular la anomalía lunar). Al pasar el cursor sobre cualquier engranaje, se detalla su historia y matemáticas.
3. **Esferas Traseras (Ciclos Metónico y Saros):** Diales espirales interactivos de 5 y 4 vueltas respectivamente, utilizados para sincronizar los calendarios lunar-solar y predecir eclipses lunares y solares futuros.
4. **Audio Procedimental (Web Audio API):** Generación de sonidos metálicos de rozamiento y clics mecánicos sincronizados físicamente con los dientes de los engranajes al girar la manivela.
5. **Manivela Manual Táctil:** Interfaz interactiva para arrastrar y hacer girar el mecanismo con el cursor del ratón o con pantallas táctiles, simulando el funcionamiento analógico del dispositivo original.

---

## 🛠️ Estructura del Código

* `index.html` - Estructura semántica, paneles informativos y el lienzo Canvas.
* `style.css` - Estilos con CSS Vanilla (Glassmorphism, paleta de colores bronce/oro y diseño responsivo).
* `app.js` - Lógica de simulación física, cálculo de fases lunares, ciclos astronómicos, renderizado Canvas y sintetizador de sonido.

---

## 🐳 Ejecución Local con Docker

Puedes empaquetar y ejecutar esta aplicación utilizando Docker o Docker Compose en pocos segundos.

### Opción A: Usando Docker Básico

1. **Construir la imagen:**
   ```bash
   docker build -t antikythera-app .
   ```

2. **Ejecutar el contenedor:**
   ```bash
   docker run -d -p 8080:80 --name antikythera antikythera-app
   ```

3. Abre en tu navegador: **[http://localhost:8080](http://localhost:8080)**

### Opción B: Usando Docker Compose (Recomendado)

1. **Iniciar el contenedor:**
   ```bash
   docker-compose up -d
   ```

2. **Detener el contenedor:**
   ```bash
   docker-compose down
   ```

---

## 🚀 Despliegue en Producción (`antikythera.deft.work`)

Para desplegar la aplicación en tu dominio personalizado, puedes utilizar un servidor con Docker y configurar un proxy inverso para gestionar el tráfico HTTPS (SSL).

### Ejemplo con Proxy Inverso (Nginx en Servidor Host)

Puedes enlazar el contenedor en el puerto `8080` de tu host y configurar el siguiente bloque en tu servidor Nginx de producción:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name antikythera.deft.work;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name antikythera.deft.work;

    # Certificados SSL (Certbot / Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/antikythera.deft.work/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/antikythera.deft.work/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📐 Ratios de Transmisión Históricos

El sistema utiliza las siguientes especificaciones físicas para mantener la precisión matemática helenística:

* **Ciclo Solar:** Rueda de Entrada **A1 (64 dientes)** = $1$ vuelta por año.
* **Ciclo Metónico (19 años / 235 meses sinódicos):** Relación de velocidad accionada por el tren de engranajes traseros hasta la aguja indicadora de **E5**.
* **Ciclo de Saros (223 meses sinódicos):** Relación accionada por **F1** para posicionar el pin sobre los glifos de eclipses.
* **Ciclo de la Luna:** Multiplicación a través de la rueda coaxial **C2 (127 dientes)** para modelar la posición lunar en la eclíptica.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consúltala en el archivo `LICENSE` para más detalles.
