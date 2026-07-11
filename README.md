# Lista de Deseos de Isela 💗

Aplicación web para que Isela guarde todos los regalos que le gustaría recibir, y para que Arman pueda llevar un control privado de cuáles ya le ha dado.

## Stack

- **Backend:** Flask (Python)
- **Base de datos:** MongoDB
- **Imágenes:** Cloudinary
- **Frontend:** HTML + CSS + JavaScript vanilla (mismo estilo visual que `Our_Biggining_PAGE`)

## 1. Requisitos previos

1. **Python 3.10+**
2. **Cuenta de MongoDB Atlas** (capa gratuita): https://www.mongodb.com/cloud/atlas/register
   - Crea un cluster gratuito, un usuario de base de datos y copia el "connection string".
3. **Cuenta de Cloudinary** (capa gratuita): https://cloudinary.com/users/register/free
   - En el Dashboard copia: `Cloud name`, `API Key` y `API Secret`.

## 2. Instalación

```bash
cd our_wishlist
python -m venv .venv
.venv\Scripts\activate      # en Windows
pip install -r requirements.txt
```

## 3. Configuración

Copia `.env.example` a `.env` y rellena tus datos:

```bash
copy .env.example .env
```

Variables importantes:

| Variable | Descripción |
|---|---|
| `MONGO_URI` | Cadena de conexión de MongoDB Atlas |
| `MONGO_DB_NAME` | Nombre de la base de datos (por defecto `our_wishlist`) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Credenciales de Cloudinary |
| `DELIVER_PASSWORD` | Contraseña secreta que **solo Arman** debe conocer, para marcar/desmarcar regalos como entregados |

## 4. Ejecutar la app

```bash
python app.py
```

Abre http://localhost:5000 en tu navegador (o desde el celular usando la IP local de tu computadora, ej. `http://192.168.1.X:5000`, siempre que estén en la misma red Wi-Fi).

## 5. Cómo funciona

- **El Cofre de tus Deseos**: regalos pendientes que Isela ha agregado.
- **Tesoros que ya son tuyos**: regalos ya entregados.
- Marcar (o desmarcar) un regalo como entregado pide la contraseña definida en `DELIVER_PASSWORD`.
- Cada regalo requiere una foto obligatoria (se sube a Cloudinary), nombre, y un nivel de "cuánto lo deseo" (Me gustaría / Lo quiero / Muchísimo). Descripción, enlace de compra y tienda son opcionales.
- Incluye búsqueda por nombre, filtro por nivel de importancia y orden por fecha o prioridad.

## 6. Despliegue

### Opción genérica (Render, Railway, Fly.io, etc.)

Para producción se recomienda usar `gunicorn` (incluido en `requirements.txt`):

```bash
gunicorn -w 2 -b 0.0.0.0:8000 app:app
```

Recuerda configurar las mismas variables de entorno en el servicio de hosting que elijas y **nunca subir el archivo `.env`**.

### Opción Vercel

El proyecto ya incluye `vercel.json` y `api/index.py`, que exponen la app Flask (`app.py`) como una función serverless de Python.

1. Importa el repositorio en [vercel.com](https://vercel.com/new).
2. En **Project Settings → Environment Variables**, agrega las mismas variables del `.env`: `MONGO_URI`, `MONGO_DB_NAME`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `DELIVER_PASSWORD`.
3. Despliega. Vercel detecta `vercel.json` y usa `@vercel/python` para ejecutar `app.py` en cada request.

No hace falta configurar un dominio especial: la vista previa de WhatsApp (`og:image`, `og:url`) se genera dinámicamente a partir de la URL con la que se accede a la página, así que funciona igual en el dominio `*.vercel.app` que en un dominio propio.

## 7. Portada de bienvenida y vista previa para compartir

- Al entrar a la página se muestra primero una portada de bienvenida (`#welcome-screen` en `templates/index.html`); el catálogo solo aparece después de tocar "Entrar a mi lista de deseos".
- Al compartir el enlace por WhatsApp (o cualquier red que lea Open Graph), se muestra la imagen `static/img/og-cover.png` junto con el título y la descripción definidos en las etiquetas `og:*` de `templates/index.html`. Si quieres cambiar esa imagen, reemplaza el archivo manteniendo el tamaño recomendado de 1200x630px.
