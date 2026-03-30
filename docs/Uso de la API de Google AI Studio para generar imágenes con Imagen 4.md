# Uso de la API de Google AI Studio para generar imágenes con Imagen 4
## Resumen ejecutivo
Google AI Studio expone los modelos de imagen de Google (actualmente la familia Imagen 4 y modelos tipo Gemini Flash Image) a través de la Gemini API, accesible con claves de API creadas en AI Studio o mediante autenticación OAuth/Google Cloud cuando se usa Vertex AI. La familia Imagen 4 ofrece tres variantes principales (`imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001`, `imagen-4.0-fast-generate-001`) orientadas a un equilibrio distinto entre calidad, precisión del prompt y velocidad.[^1][^2][^3][^4]

Desde AI Studio, cada modelo tiene límites de cuota por proyecto medidos en solicitudes por día (Requests Per Day, RPD), solicitudes por minuto (RPM) y, en modelos de imagen, a veces imágenes por minuto (IPM); estos límites se muestran en la UI de AI Studio y se aplican por proyecto, reiniciándose a medianoche hora del Pacífico. En el caso concreto mostrado en la captura, cada modelo de Imagen 4 tiene 25 generaciones gratuitas por día, lo que corresponde a un límite de RPD específico para el proyecto en el nivel Free.[^2][^5]
## Arquitectura general: AI Studio, Gemini API e Imagen 4
AI Studio es una capa de experiencia para desarrolladores sobre Google Cloud que permite gestionar proyectos, claves de API y experimentar con modelos de Gemini e Imagen desde el navegador. Cada clave de API de AI Studio está asociada a un proyecto de Google Cloud, que es la unidad donde se contabilizan cuotas y facturación.[^3]

La Gemini API es el endpoint HTTP público que se usa desde código para llamar a los modelos, incluida la familia Imagen 4. Los modelos de Imagen trabajan exclusivamente en modo texto→imagen: entrada de texto en inglés y salida de una o varias imágenes codificadas como bytes (normalmente base64) en la respuesta JSON.[^1]
## Modelos disponibles de Imagen 4 en la Gemini API
La documentación oficial de la Gemini API lista tres códigos de modelo para Imagen 4:[^1]

| Variante | Código de modelo | Características principales |
|---------|------------------|-----------------------------|
| Imagen 4 "Standard" | `imagen-4.0-generate-001` | Modelo por defecto, orientado a la mayoría de casos de uso, con muy buena calidad y buen balance coste/calidad.[^1][^4] |
| Imagen 4 Ultra | `imagen-4.0-ultra-generate-001` | Mayor fidelidad al prompt y outputs más alineados con instrucciones detalladas, pensado para casos donde la precisión es crítica y con mayor coste por imagen.[^1][^4] |
| Imagen 4 Fast | `imagen-4.0-fast-generate-001` | Versión optimizada para velocidad y coste, útil para iteración rápida o escenarios de alto volumen con menor coste unitario.[^1][^6] |

Los tres modelos aceptan texto como entrada y devuelven de 1 a 4 imágenes por llamada, con tokens de entrada limitados a unas 480 palabras equivalentes (tokens) en el prompt.[^1]
## Parámetros clave de generación de imágenes
La operación `generate_images` de los SDKs de Gemini expone una configuración `GenerateImagesConfig` o equivalente con los parámetros principales:[^1]

- `numberOfImages` / `number_of_images`: número de imágenes a devolver (1–4, por defecto 4).[^1]
- `imageSize`: tamaño lógico del output; para Imagen 4 Standard y Ultra se admiten `"1K"` y `"2K"` como resoluciones base (por ejemplo, alrededor de 1024 y 2048 píxeles en el lado mayor).[^1]
- `aspectRatio`: relación de aspecto; valores soportados: `"1:1"`, `"3:4"`, `"4:3"`, `"9:16"` y `"16:9"`.[^1]
- `personGeneration`: controla si el modelo puede generar personas, con opciones `"dont_allow"`, `"allow_adult"` (por defecto) y `"allow_all"`.[^1]

Además, los prompts deben estar en inglés para obtener resultados consistentes, ya que Imagen 4 sólo soporta prompts en inglés en esta fase.[^1]
## Obtención y gestión de la clave de API en AI Studio
Para consumir la Gemini API desde código se requiere una clave de API creada en Google AI Studio en la sección **API Keys** del panel de proyectos. Cada clave está asociada a un único proyecto de Google Cloud, y la cuota se contabiliza a nivel de proyecto, no de clave.[^2][^3]

La documentación recomienda configurar la clave como variable de entorno `GEMINI_API_KEY` o `GOOGLE_API_KEY` en el sistema operativo, de forma que los SDKs oficiales la detecten automáticamente. En entornos donde no se pueden usar variables de entorno (por ejemplo, ciertos frontends web) o cuando se realizan llamadas REST manuales, la clave debe pasarse de forma explícita en el parámetro `api_key` del cliente o en la cabecera HTTP `x-goog-api-key`.[^3]
## Ejemplos con SDK oficial (Python, Node.js y Go)
### Python con `google-genai`
El SDK oficial para Python (`google-genai`) simplifica el uso de Imagen 4 exponiendo un método `generate_images` en el cliente.[^1]

```python
from google import genai
from google.genai import types
from io import BytesIO
from PIL import Image

# El SDK leerá GEMINI_API_KEY del entorno si está definido
client = genai.Client()

response = client.models.generate_images(
    model="imagen-4.0-generate-001",
    prompt="A cinematic cyberpunk street at night with neon reflections on wet asphalt",
    config=types.GenerateImagesConfig(
        number_of_images=2,
        aspect_ratio="16:9",
        image_size="1K",
        person_generation="allow_adult",
    ),
)

for i, generated in enumerate(response.generated_images, start=1):
    img_bytes = generated.image.image_bytes  # bytes
    img = Image.open(BytesIO(img_bytes))
    img.save(f"output_imagen4_{i}.png")
```

Este patrón ilustra cómo el SDK devuelve cada imagen como un blob binario (`image_bytes`) listo para persistir en disco o reenviar a un cliente HTTP.[^1]
### Node.js / TypeScript con `@google/genai`
En Node.js, la librería `@google/genai` expone un método `generateImages` similar.[^1]

```ts
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

// La librería usará process.env.GEMINI_API_KEY si está definido
const ai = new GoogleGenAI();

async function main() {
  const response = await ai.models.generateImages({
    model: "imagen-4.0-ultra-generate-001",
    prompt: "Ultra realistic portrait of a young woman in studio lighting, 35mm lens, film noir style",
    config: {
      numberOfImages: 1,
      aspectRatio: "3:4",
      imageSize: "2K",
      personGeneration: "allow_adult",
    },
  });

  for (let index = 0; index < response.generatedImages.length; index++) {
    const generated = response.generatedImages[index];
    const buffer = Buffer.from(generated.image.imageBytes, "base64");
    fs.writeFileSync(`portrait_ultra_${index + 1}.png`, buffer);
  }
}

main().catch(console.error);
```

La respuesta incluye un array `generatedImages`, cada uno con un campo `image.imageBytes` codificado en base64 que debe decodificarse antes de escribirse como archivo PNG, JPEG o WebP.[^1]
### Go con `google.golang.org/genai`
El cliente Go también incluye soporte directo para la operación `GenerateImages` con Imagen 4.[^1]

```go
package main

import (
    "context"
    "fmt"
    "log"
    "os"

    "google.golang.org/genai"
)

func main() {
    ctx := context.Background()
    client, err := genai.NewClient(ctx, nil)
    if err != nil {
        log.Fatal(err)
    }

    cfg := &genai.GenerateImagesConfig{
        NumberOfImages: 4,
        AspectRatio:    "1:1",
    }

    resp, err := client.Models.GenerateImages(
        ctx,
        "imagen-4.0-fast-generate-001",
        "Isometric illustration of a SaaS dashboard UI in pastel colors",
        cfg,
    )
    if err != nil {
        log.Fatal(err)
    }

    for i, img := range resp.GeneratedImages {
        filename := fmt.Sprintf("dashboard_fast_%d.png", i+1)
        if err := os.WriteFile(filename, img.Image.ImageBytes, 0644); err != nil {
            log.Fatal(err)
        }
    }
}
```

En este caso el cliente también descubre la clave de API del entorno y escribe cada imagen directamente como archivo PNG.[^1]
## Ejemplo con la API REST de Gemini
Para entornos donde no se utilice un SDK oficial, la Gemini API permite hacer llamadas directas por HTTP con `curl` u otro cliente HTTP estándar.[^1][^3]

El endpoint para Imagen 4 utiliza la ruta `models/imagen-4.0-generate-001:predict` (o el modelo Ultra/Fast correspondiente) con un cuerpo JSON que contiene un array `instances` y un objeto `parameters`.

```bash
API_KEY="<TU_GEMINI_API_KEY>"

curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: ${API_KEY}" \
  -d '{
    "instances": [
      { "prompt": "Logo for a fintech startup, minimalist, green and blue on white background" }
    ],
    "parameters": {
      "sampleCount": 2,
      "aspectRatio": "1:1"
    }
  }'
```

La respuesta incluirá un array de predicciones donde cada elemento contiene los bytes de imagen codificados que deben decodificarse y guardarse en el lado del cliente. El patrón de seguridad recomendado es encapsular esta llamada en un backend propio para no exponer la clave de API en el frontend.[^3][^1]
## Cuotas, límites y el caso de "25 imágenes gratuitas por día"
### Cómo funciona el sistema de rate limits
Google define varios tipos de límites: solicitudes por minuto (RPM), tokens por minuto (TPM), solicitudes por día (RPD) y, para modelos de imagen, a veces imágenes por minuto (IPM). Estos límites son por proyecto: todas las claves del mismo proyecto comparten la misma cuota.[^2][^3]

Los límites de RPD se reinician automáticamente cada día a medianoche hora del Pacífico (PT), independientemente de la zona horaria del desarrollador. Las cuotas varían según el modelo y el nivel de uso (Free, Tier 1, Tier 2, Tier 3), y pueden consultarse directamente en la UI de AI Studio en la sección de **Rate limits**.[^5][^2]
### Por qué ves "0 / 25" en AI Studio
En la captura aportada se observa que los modelos `Imagen 4 Generate`, `Imagen 4 Ultra Generate` y `Imagen 4 Fast Generate` tienen un contador de `0 / 25`, lo que indica que el proyecto dispone de 25 solicitudes diarias gratuitas para cada uno de esos modelos en el nivel de uso actual. Esta cifra es específica del proyecto y del tier asignado, y puede cambiar si Google ajusta las cuotas o si el proyecto se actualiza a un tier de pago.[^2]

La propia documentación oficial indica que los límites concretos dependen del modelo, del estado de la cuenta y del tier, y que deben consultarse en AI Studio, ya que no se publican tablas fijas para todos los modelos. Blogs externos que monitorizan los cambios de cuotas señalan que Imagen 4 se ofrece como modelo de pago en la Gemini API, con acceso gratuito muy limitado para pruebas, mientras que los modelos Gemini Flash Image ofrecen cuotas gratuitas más altas (por ejemplo, del orden de cientos de imágenes al día).[^4][^6][^7][^2]
### Consideraciones de facturación
La entrada del blog oficial de Google indica que Imagen 4 está disponible en "paid preview" con precios de referencia de unos 0,04 dólares por imagen en la variante estándar y 0,06 dólares por imagen en la variante Ultra. Esto implica que, superado el cupo gratuito de pruebas, el proyecto comenzará a facturar según la tarifa configurada en la cuenta de Google Cloud asociada.[^4]

Dado que las cuotas y precios pueden cambiar con el tiempo y pueden variar por región, la recomendación es revisar periódicamente la página de precios de la Gemini API y el panel de cuotas de AI Studio antes de lanzar una carga de generación intensiva en producción.[^5][^4]
## Mejores prácticas de diseño de prompts para Imagen 4
La documentación oficial de Imagen incluye una guía extensa de redacción de prompts que enfatiza tres ejes principales: sujeto, contexto/escenario y estilo. Se recomienda empezar por definir claramente el sujeto, especificar el entorno (estudio, interior, exterior, ciudad, naturaleza, etc.) y luego añadir el estilo (fotográfico, ilustración, acuarela, 3D, etc.).[^1]

También se describe cómo la longitud del prompt afecta al resultado: prompts cortos permiten iterar rápido, mientras que prompts largos y detallados ofrecen mayor control sobre composición, iluminación, encuadre y estilo. Para textos dentro de la imagen (por ejemplo, carteles o logotipos con texto), se aconseja limitarse a cadenas de hasta 25 caracteres y no más de dos o tres frases distintas para maximizar la legibilidad del texto renderizado.[^1]
## Control de formato: relación de aspecto y resolución
Imagen 4 permite controlar la relación de aspecto y la resolución para adaptar las imágenes al caso de uso (social media, video vertical, banners web, etc.).[^1]

- Para posts cuadrados, se usa el valor por defecto `"1:1"`.
- Para contenido tipo story o video vertical, se recomienda `"9:16"`.
- Para fondos de pantalla o escenas panorámicas, `"16:9"` es adecuado.[^1]

En los modelos Standard y Ultra, el parámetro `imageSize` permite elegir entre `"1K"` y `"2K"`, lo que impacta tanto en la calidad visual como en el coste y el tiempo de generación. En escenarios de prototipado puede ser preferible trabajar en `1K` o con el modelo Fast, y sólo al final generar las versiones definitivas en `2K` con Standard o Ultra.[^1]
## Seguridad, personas y marcas
El parámetro `personGeneration` ofrece control explícito sobre si el modelo puede generar personas (adultos o niños) o si debe bloquear imágenes que las contengan. Esto es relevante para cumplir políticas internas o regulatorias en determinados dominios (por ejemplo, productos dirigidos a menores o restricciones sobre reconocimiento de menores).[^1]

Google además aplica filtros y revisiones automáticas sobre prompts e imágenes generadas (por ejemplo, contenido sexualmente explícito, violencia, discursos de odio), que pueden resultar en errores o outputs vacíos si se infringen las políticas. Las imágenes generadas incluyen una marca de agua digital oculta (SynthID) para permitir trazabilidad y autenticación de contenido en flujos downstream.[^4][^1]
## Buenas prácticas de integración en aplicaciones SaaS
1. **Backend intermedio**: encapsular las llamadas a la Gemini API en un backend propio (Node.js, Python, Go) y exponer a los clientes sólo endpoints controlados, nunca la clave de API.[^3]
2. **Control de cuotas**: implementar lógica de rate limiting a nivel de aplicación (por usuario, por tenant) para no agotarse el RPD del proyecto a mitad de día, especialmente cuando se dispone de sólo 25 imágenes diarias gratuitas por modelo.[^2]
3. **Cola de trabajos**: para cargas pesadas de generación, usar colas y backoff exponencial al recibir errores `429` de rate limit, tal como recomiendan varias guías y blogs especializados.[^8][^5]
4. **Registro de prompts y metadatos**: guardar prompts, parámetros (modelo, aspect ratio, tamaño, personaGeneration) y referencias a los outputs en la base de datos para poder regenerar o auditar imágenes a posteriori.[^1]
5. **Selección de modelo por caso de uso**: usar Imagen 4 Fast para bocetos rápidos, Imagen 4 Standard para calidad alta generalista, e Imagen 4 Ultra para campañas o creatividades donde la fidelidad al prompt y el texto en imagen sean críticos.[^4][^1]
## Conclusiones
La combinación de Google AI Studio y la Gemini API permite integrar de forma relativamente sencilla la generación de imágenes de alta fidelidad con Imagen 4 en aplicaciones web y backend. Los modelos `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001` y `imagen-4.0-fast-generate-001` cubren un rango amplio de necesidades desde prototipado rápido hasta creatividades de producción, pero su cuota gratuita vía API es limitada (en el ejemplo analizado, 25 solicitudes diarias por modelo), por lo que es esencial diseñar el uso y la arquitectura de la aplicación teniendo en cuenta estos límites.[^1][^2][^3][^4]

Una estrategia razonable consiste en usar el cupo reducido de Imagen 4 para generación de alta calidad y apoyarse en modelos de imagen tipo Gemini Flash para volúmenes altos, aprovechando sus cuotas gratuitas más generosas, todo ello gestionado desde un backend que proteja las claves y aplique su propio control de cuotas.

---

## References

1. [image.jpg](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/50100219/79ddc754-3233-419c-ab0c-b48c46cb55dc/image.jpg?AWSAccessKeyId=ASIA2F3EMEYEZIFBLM3A&Signature=jdCnarmosRnhQUoGU7plQVm6k5I%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEJn%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJGMEQCIBcp2%2F4A6sE3rhjbq6JlAwa%2Fg7UKyGeaUGrU%2F8Q553GuAiAcT0yZ%2Fu4ZaO4%2BIXf%2B0viQuxpmy0dmyCRjAEu0cIF0LirzBAhiEAEaDDY5OTc1MzMwOTcwNSIMjRhkR86MHRSIpLz2KtAEzkJBgbS%2FeOx4abEDBLHw9Z9bPkjEzP4JS4JF4l0yJogSt02sgj0L7xZJ3j1xeXMN92ghwF0Tgvu1%2Bz9M3TwKs8jF00CaOh9wXdLo2%2B4EsAhj2NO7jiaaHDSbFxaEm9dzwgrcTM4jRJM203fHK%2F1MxGvEKbZP%2FHHGxP5C6liW4hHaLCOg3htyENal2M5a1TvFmm4eLemkW9rvHZPxZYTLLEyVWPW6mRjFZnaKBM3l3GTAgvvZBy%2BomIX4TydpIwU4gA0a0N4SRnAQFl1CqEI1A1MaoOnPD97lAJrRbpvqB2sJmPg8%2F%2BjhE0ZdQDd7tiaj%2FeJ1mLMXe2J3BtPn7o0x5jvsOYgfOfhlz4aavUwjBXQmZjcK6E4tPx5q45elDDNc50z0cUe5Wxsx%2FxOPV2Cm1ugw31v%2Be7gHvn1ysU1DkNomh%2B9WAPJvSdkMJHXO3ddPMNRnwmcf89sXe0%2BAEqPCoYC9Ya%2B7VjmadHAJYUJNA8uKBv3zi5rQy0PnPJUeP8GKfCrJ0y9QbZTpm83SKTUEPUxkuvmgGpOJN%2FaRD%2BhkVwil8ddbnB%2BVCu6MFfyVzKiIjehQgws0rtGDRsTcH4t0jVuzcFiKN%2F5xPmBS9JP7Pa%2BCx%2BvI%2BK0UI82aHUr%2BnaVxXH%2FEt4856XQLv5PvUctKVv9qJHZOXJjBbFs51ysh5VPf1bSFXKeIuhc2N4MyNTJ984IrlZTPSb3lTHT1buWHL6jwplgxjcXivOS90akyRIOjSfrAArLs8uPhf0xJf76l9b01DJeZkTuuoI5H6xWHmDDPusbNBjqZAatcnZIss2ZiEw6MSjfVfgacJpxzAYg%2FFtlNshNWiBBYob8DE90SdaGEhttjoY%2BRkDLAP1FaOFWr3%2FwRwNrlxQpaif%2BuZKR76JbLJvBb%2Bh3z%2FDLE%2BNij8%2B5kNwNYVLuRfaiH391mZ2JvTVj99P%2FthDno4jWLM3AMlRzrNtYlwSGgnNXM1z80g5muA30xhv1Buxwh9AncJqbPKQ%3D%3D&Expires=1773251615)

2. [Generate images using Imagen | Gemini API](https://ai.google.dev/gemini-api/docs/imagen) - Get started generating images with the Gemini API

3. [Free, Unlimited Imagen API - Puter.js](https://developer.puter.com/tutorials/free-unlimited-imagen-api/) - Learn how to generate images using Puter.js with Google's Imagen 4, Imagen 4 Fast, and Imagen 4 Ultr...

4. [Imagen 4 is now available in the Gemini API and Google AI Studio](https://developers.googleblog.com/imagen-4-now-available-in-the-gemini-api-and-google-ai-studio/) - Explore Imagen 4, Google's advanced text-to-image model, now in paid preview via Gemini API and Goog...

5. [Gemini Image Generation Free Limits 2026 - LaoZhang AI Blog](https://blog.laozhang.ai/en/posts/gemini-image-generation-free-limit-2026) - Every Gemini image generation free limit explained — from the Gemini App's 100 images/day to the API...

6. [Gemini Image API Free Tier: Complete Guide to Limits, Models ...](https://www.aifreeapi.com/en/posts/gemini-image-api-free-tier) - Discover Gemini's free tier for image generation: 500+ images/day with Gemini 2.5 Flash, Imagen 4 li...

7. [Gemini Image Generation API Free Tier: Complete Guide to All ...](https://www.aifreeapi.com/en/posts/gemini-image-generation-free-api) - Google's Gemini API offers one of the most generous free image generation tiers in 2026. This guide ...

8. [Google AI Studio Image Limits: Complete Guide to Daily Quotas ...](https://www.aifreeapi.com/en/posts/google-ai-studio-image-generation-limits) - Complete guide to Google AI Studio image generation limits in December 2025. Learn daily quotas (500...

