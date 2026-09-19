import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StudyOS AI',
    short_name: 'StudyOS',
    description: 'Your academic operating system',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f8fc',
    theme_color: '#6657e8',
    categories: ['education', 'productivity'],
  };
}
