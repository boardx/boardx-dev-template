/** @type {import('next').NextConfig} */
const nextConfig = {
  // workspace 包是 TS 源码，交给 Next 编译
  transpilePackages: ["@repo/auth", "@repo/canvas", "@repo/data", "@repo/queue"],
};

export default nextConfig;
