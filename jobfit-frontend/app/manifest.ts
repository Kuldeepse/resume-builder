import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CogniTwist AI Career Copilot',
    short_name: 'CogniTwist AI',
    description: 'Your AI career team for job discovery, evidence-grounded CV tailoring and interview preparation.',
    start_url: '/career',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f6f3eb',
    theme_color: '#0f766e',
    categories: ['business', 'productivity', 'education'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
