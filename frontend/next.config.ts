import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Add this line to enable static export for hosting on Hostinger
  output: 'export',

  // This is needed to prevent a "trailing slash" issue with static exports
  trailingSlash: true,
}

export default nextConfig