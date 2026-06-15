const { buildOpenApiSpec } = require("../docs/openapi");

const SWAGGER_UI_VERSION = "5.18.2";

function swaggerHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Free Gemini API - Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`;
}

function registerDocsRoutes(app) {
  return app
    .get("/openapi.json", () => {
      return new Response(JSON.stringify(buildOpenApiSpec(), null, 2), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    })
    .get("/docs", () => {
      return new Response(swaggerHtml(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    });
}

module.exports = {
  registerDocsRoutes,
};
