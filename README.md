# Kenzo Planificador

App web instalable (PWA) para Kenzo Academia: calendarios de estudio de los equipos Panda, Dragón y Tora, tareas que cada alumno marca como hechas o no, e informes para la encargada.

- Sin configurar Firebase (`firebase-config.js` con `PEGA_AQUI...`) funciona en **modo demostración**.
- Alojamiento: GitHub Pages (gratis). Datos y usuarios: Firebase, plan gratuito Spark.

## Puesta en marcha (una vez)
1. Crear proyecto en https://console.firebase.google.com
2. Añadir una app web (icono `</>`) y copiar el objeto `firebaseConfig` en `firebase-config.js`.
3. Authentication → Comenzar → Correo electrónico/contraseña → Habilitar.
4. Firestore Database → Crear base de datos → modo producción → ubicación `eur3 (europe-west)`.
5. Firestore → Reglas → pegar el contenido de `firestore.rules` → Publicar.
6. Authentication → Configuración → Dominios autorizados → añadir el dominio de GitHub Pages.
7. Abrir la app, crear cuenta (sin código) y pulsar «Configurar la academia»: esa cuenta queda como directora.

## Roles
- **Directora / encargada** (`members/{uid}.role = admin`): edita calendarios, alumnos, tareas extra, notas privadas, accesos e informes.
- **Alumno** (`role = student`, `studentId`): solo ve su calendario y marca sus tareas.
Los alumnos entran con el código que se genera al darlos de alta.
