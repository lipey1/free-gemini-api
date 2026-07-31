/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The playground talks to the live API straight from the browser, so the
  // whole site is static. `next build` emits ./out — drop it on any host.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
