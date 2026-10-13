import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "coverage/**"] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Regla de seguridad del proyecto: el texto de la API nunca se inyecta como HTML.
      "react/no-danger": "error",
    },
  },
];

export default config;