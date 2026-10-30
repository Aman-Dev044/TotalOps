/** Public site settings used for SEO (canonical URLs, sitemap, Open Graph). Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const SITE_NAME = 'TotalOps';
export const SITE_TITLE = 'TotalOps — Window Tinting CRM with 3D Tint Visualizer & AI Film Advisor';
export const SITE_DESCRIPTION =
  'TotalOps is the all-in-one CRM for automotive, residential and commercial window tinting businesses: quotes, bookings, bays, invoices, film inventory, a live dealer portal, a 3D tint visualizer and an AI film advisor that picks the darkest legal shade and the right roll size.';
