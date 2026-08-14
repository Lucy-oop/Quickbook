/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Supabase Storage: product photos, business logos, receipt attachments.
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  experimental: {
    // Keeps the initial JS bundle small on 3G — matters for shops outside Yangon.
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },
}

export default nextConfig
