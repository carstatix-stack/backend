import type { FastifyInstance } from 'fastify';

import { AppError } from '../lib/errors.js';
import { renderPublicReportHtml } from '../lib/public-report-html.js';
import * as reportService from '../services/report.service.js';

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reports/search/:vin', async (request, reply) => {
    const { vin } = request.params as { vin: string };
    const normalized = vin.trim().toUpperCase();

    if (normalized.length !== 17) {
      throw new AppError(400, 'VIN must be 17 characters', 'INVALID_VIN');
    }

    const reports = await reportService.searchPublishedReportsByVin(normalized);
    return reply.send({ vin: normalized, reports });
  });

  app.get('/reports/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const report = await reportService.getPublicReport(slug);
    return reply.send({ report });
  });

  /** Public HTML report page for QR scans. */
  app.get('/r/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const data = await reportService.getPublicReport(slug);
    return reply.type('text/html').send(renderPublicReportHtml(data));
  });
}
