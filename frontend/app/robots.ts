import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/f/'],
        // The CRM itself and private customer/dealer links must never be indexed.
        disallow: ['/dashboard', '/projects', '/pipeline', '/customers', '/calendar', '/planning', '/shop-day', '/team', '/jobs', '/visualizer', '/advisor', '/films', '/proposals', '/payments', '/inventory', '/notes', '/files', '/reviews', '/lead-forms', '/automations', '/reports', '/settings', '/notifications', '/review/', '/dealer/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
