import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Add this line to enable static export for hosting on Hostinger
  output: 'export',

  // This is needed to prevent a "trailing slash" issue with static exports
  trailingSlash: true,

  // This ensures the correct URL is baked into the build
  env: {
    NEXT_PUBLIC_API_URL: 'https://dsouzarohanuk.pythonanywhere.com',
  },
}

export default nextConfig