type PublicReportData = Awaited<
  ReturnType<typeof import('../services/report.service.js').getPublicReport>
>;

function escapeHtml(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrice(value: unknown): string | null {
  if (value == null) return null;
  const num = typeof value === 'object' && value !== null && 'toString' in value
    ? Number((value as { toString(): string }).toString())
    : Number(value);
  if (Number.isNaN(num)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
}

function ratingStars(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

function inspectionBadge(rating: string): string {
  const label = rating.replace(/_/g, ' ');
  const tone = rating === 'GOOD'
    ? 'good'
    : rating === 'FAIR'
      ? 'fair'
      : rating === 'ATTENTION'
        ? 'warn'
        : 'muted';
  return `<span class="badge badge-${tone}">${escapeHtml(label)}</span>`;
}

function section(title: string, body: string): string {
  if (!body.trim()) return '';
  return `
  <section class="card">
    <h2>${escapeHtml(title)}</h2>
    ${body}
  </section>`;
}

function row(label: string, value: string): string {
  if (!value.trim()) return '';
  return `
    <div class="row">
      <span class="label">${escapeHtml(label)}</span>
      <span class="value">${value}</span>
    </div>`;
}

function renderObd(obd: Record<string, unknown> | null): string {
  if (!obd) {
    return '<p class="muted">No OBD data recorded.</p>';
  }

  const engine = obd.engine as Record<string, unknown> | undefined;
  const transmission = obd.transmission as Record<string, unknown> | undefined;
  const battery = obd.battery as Record<string, unknown> | undefined;
  const emissions = obd.emissions as Record<string, unknown> | undefined;
  const abs = obd.abs as Record<string, unknown> | undefined;
  const live = obd.live as Record<string, unknown> | undefined;
  const source = obd.source === 'dummy_obd' ? 'Demo data' : 'Live OBD scan';

  const engineStatus = engine?.status != null ? escapeHtml(String(engine.status)) : '—';
  const milOn = engine?.milOn === true
    ? '<span class="badge badge-warn">MIL ON</span>'
    : '<span class="badge badge-good">MIL OFF</span>';

  const rows = [
    row('Engine', `${engineStatus} ${milOn}`),
    row(
      'Transmission',
      transmission?.status != null ? escapeHtml(String(transmission.status)) : '—',
    ),
    row(
      'Battery',
      battery?.voltage != null
        ? `${escapeHtml(String(battery.voltage))} — ${escapeHtml(String(battery.status ?? ''))}`
        : battery?.status != null
          ? escapeHtml(String(battery.status))
          : '—',
    ),
    row(
      'Emissions',
      emissions?.status != null ? escapeHtml(String(emissions.status)) : '—',
    ),
    row(
      'ABS / Braking',
      abs?.status != null ? escapeHtml(String(abs.status)) : '—',
    ),
  ].join('');

  const liveBits: string[] = [];
  if (live?.rpm != null) liveBits.push(`RPM ${escapeHtml(String(live.rpm))}`);
  if (live?.coolantC != null) {
    liveBits.push(`Coolant ${escapeHtml(String(live.coolantC))}°C`);
  }

  return `
    <div class="rows">${rows}</div>
    ${liveBits.length ? `<p class="muted live">Live: ${liveBits.join(' · ')}</p>` : ''}
    <p class="muted source">Source: ${escapeHtml(source)}</p>`;
}

function renderCosmetic(
  cosmetic: PublicReportData['cosmetic'],
): string {
  if (!cosmetic) {
    return '<p class="muted">No cosmetic ratings recorded.</p>';
  }

  const body = [
    row('Exterior', `<span class="stars">${ratingStars(cosmetic.exteriorRating)}</span>`),
    row('Interior', `<span class="stars">${ratingStars(cosmetic.interiorRating)}</span>`),
    row('Glass', `<span class="stars">${ratingStars(cosmetic.glassRating)}</span>`),
    cosmetic.tireNotes
      ? row('Tires', escapeHtml(cosmetic.tireNotes))
      : '',
  ].join('');

  return `<div class="rows">${body}</div>`;
}

function renderInspections(
  inspections: PublicReportData['inspections'],
): string {
  if (!inspections?.length) {
    return '<p class="muted">No inspection checklist recorded.</p>';
  }

  const items = inspections
    .map((item) => {
      const obs = item.observations
        ? `<p class="obs">${escapeHtml(item.observations)}</p>`
        : '';
      return `
        <div class="inspect-item">
          <div class="inspect-head">
            <strong>${escapeHtml(item.systemName)}</strong>
            ${inspectionBadge(item.rating)}
          </div>
          ${obs}
        </div>`;
    })
    .join('');

  return `<div class="inspect-list">${items}</div>`;
}

function renderListing(listing: PublicReportData['listing']): string {
  if (!listing) {
    return '<p class="muted">No listing details recorded.</p>';
  }

  const price = formatPrice(listing.askingPrice);
  const rows = [
    price ? row('Asking price', escapeHtml(price)) : '',
    listing.location ? row('Location', escapeHtml(listing.location)) : '',
  ].join('');

  if (!rows.trim()) {
    return '<p class="muted">No listing details recorded.</p>';
  }

  return `<div class="rows">${rows}</div>`;
}

function renderMedia(media: PublicReportData['media']): string {
  if (!media?.length) {
    return '<p class="muted">No photos or videos uploaded for this report.</p>';
  }

  const photos = media
    .filter((m) => m.type === 'PHOTO' && m.url)
    .map(
      (m) => `
      <figure class="photo">
        <img src="${escapeHtml(m.url!)}" alt="${escapeHtml(m.category)}" loading="lazy"/>
        <figcaption>${escapeHtml(m.category.replace(/_/g, ' '))}</figcaption>
      </figure>`,
    )
    .join('');

  const videos = media
    .filter((m) => m.type === 'VIDEO' && m.url)
    .map(
      (m) => `
      <figure class="video">
        <video src="${escapeHtml(m.url!)}" controls playsinline preload="metadata"></video>
        <figcaption>${escapeHtml(m.category.replace(/_/g, ' '))}</figcaption>
      </figure>`,
    )
    .join('');

  if (!photos && !videos) {
    return '<p class="muted">No photos or videos uploaded for this report.</p>';
  }

  return `
    ${photos ? `<div class="photo-grid">${photos}</div>` : ''}
    ${videos ? `<div class="video-grid">${videos}</div>` : ''}`;
}

export function renderPublicReportHtml(data: PublicReportData): string {
  const title = [data.vehicle.year, data.vehicle.make, data.vehicle.model]
    .filter(Boolean)
    .join(' ');

  const published = data.publishedAt
    ? new Date(data.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const obdSummary = data.obd as Record<string, unknown> | null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(title || 'Vehicle Report')} · Carstatix</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:16px;background:#f5f6f8;color:#1a1a2e;line-height:1.45}
    .wrap{max-width:520px;margin:0 auto}
    .hero{background:#fff;border-radius:14px;padding:20px;margin-bottom:12px;border:1px solid #e5e7eb}
    .card{background:#fff;border-radius:14px;padding:18px 20px;margin-bottom:12px;border:1px solid #e5e7eb}
    h1{font-size:1.35rem;margin:6px 0 8px;font-weight:700}
    h2{font-size:.8rem;margin:0 0 14px;text-transform:uppercase;letter-spacing:.08em;color:#4a6cf7;font-weight:700}
    .muted{color:#6b7280;font-size:14px;margin:0}
    .badge{display:inline-block;font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;margin-right:6px;vertical-align:middle}
    .badge-good{background:#10b98122;color:#059669}
    .badge-fair{background:#f59e0b22;color:#d97706}
    .badge-warn{background:#ef444422;color:#dc2626}
    .badge-muted{background:#6b728022;color:#4b5563}
    .hero-badges{margin-top:10px}
    .rows .row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #f0f1f3;font-size:14px}
    .rows .row:last-child{border-bottom:none}
    .label{color:#6b7280;flex-shrink:0}
    .value{text-align:right;font-weight:500}
    .stars{color:#f59e0b;letter-spacing:1px}
    .live,.source{margin-top:10px;font-size:13px}
    .inspect-list{display:flex;flex-direction:column;gap:10px}
    .inspect-item{padding:12px;background:#f9fafb;border-radius:10px;border:1px solid #eef0f2}
    .inspect-head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:14px}
    .obs{margin:8px 0 0;font-size:13px;color:#4b5563}
    .photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .photo{margin:0}
    .photo img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;background:#f3f4f6}
    .photo figcaption,.video figcaption{font-size:11px;color:#6b7280;margin-top:4px;text-transform:capitalize}
    .video-grid{display:flex;flex-direction:column;gap:12px;margin-top:12px}
    .video{margin:0}
    .video video{width:100%;border-radius:10px;border:1px solid #e5e7eb;background:#000}
    footer{text-align:center;padding:8px 0 24px;font-size:12px;color:#9ca3af}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <p class="muted">Carstatix Verified Report</p>
      <h1>${escapeHtml(title || 'Vehicle')}</h1>
      <p class="muted">VIN ${escapeHtml(data.vehicle.vinMasked)}</p>
      <div class="hero-badges">
        <span class="badge badge-good">OBD VERIFIED</span>
        <span class="badge badge-good">INSPECTION</span>
      </div>
    </header>

    ${section('OBD diagnostics', renderObd(obdSummary))}
    ${section('Cosmetic condition', renderCosmetic(data.cosmetic))}
    ${section('Mechanical inspection', renderInspections(data.inspections))}
    ${section('Listing', renderListing(data.listing))}
    ${section('Photos', renderMedia(data.media))}

    <footer>Published ${escapeHtml(published)} · Carstatix</footer>
  </div>
</body>
</html>`;
}
