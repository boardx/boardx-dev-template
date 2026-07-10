/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages（next-on-pages）：无 Node 图像优化服务
  images: { unoptimized: true },
};
export default nextConfig;
