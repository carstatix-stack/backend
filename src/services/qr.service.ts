import QRCode from 'qrcode';

import { buildPublicReportUrl } from '../lib/slug.js';

export async function generateQrPngDataUrl(publicSlug: string, baseUrl: string): Promise<string> {
  const url = buildPublicReportUrl(publicSlug, baseUrl);
  return QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    color: {
      dark: '#1A1A2E',
      light: '#FFFFFF',
    },
  });
}
