type PublicReportData = Awaited<
  ReturnType<typeof import('../services/report.service.js').getPublicReport>
>;

type MediaItem = NonNullable<PublicReportData['media']>[number];

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
  const num =
    typeof value === 'object' && value !== null && 'toString' in value
      ? Number((value as { toString(): string }).toString())
      : Number(value);
  if (Number.isNaN(num)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
}

function categoryLabel(category: string): string {
  return category.replace(/_/g, ' ');
}

function ratingStars(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

function inspectionBadge(rating: string): string {
  const label = rating.replace(/_/g, ' ');
  const tone =
    rating === 'GOOD'
      ? 'good'
      : rating === 'FAIR'
        ? 'fair'
        : rating === 'ATTENTION'
          ? 'warn'
          : 'muted';
  return `<span class="badge badge-${tone}">${escapeHtml(label)}</span>`;
}

function section(title: string, body: string, eyebrow?: string): string {
  if (!body.trim()) return '';
  return `
  <section class="card">
    ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
    <h2>${escapeHtml(title)}</h2>
    ${body}
  </section>`;
}

function pickCoverPhoto(media: PublicReportData['media']): MediaItem | null {
  const photos = (media ?? []).filter((m) => m.type === 'PHOTO' && m.url);
  if (!photos.length) return null;
  const preferred = photos.find(
    (m) => m.category.toLowerCase() === 'front_exterior',
  );
  return preferred ?? photos[0] ?? null;
}

function renderObd(obd: Record<string, unknown> | null): string {
  if (!obd) {
    return '<p class="empty">No OBD data recorded for this vehicle.</p>';
  }

  const engine = obd.engine as Record<string, unknown> | undefined;
  const transmission = obd.transmission as Record<string, unknown> | undefined;
  const battery = obd.battery as Record<string, unknown> | undefined;
  const emissions = obd.emissions as Record<string, unknown> | undefined;
  const abs = obd.abs as Record<string, unknown> | undefined;
  const live = obd.live as Record<string, unknown> | undefined;
  const source = obd.source === 'dummy_obd' ? 'Demo data' : 'Live OBD scan';

  const milOn = engine?.milOn === true;
  const engineStatus =
    engine?.status != null ? String(engine.status) : 'Not recorded';

  const tiles = [
    {
      label: 'Engine',
      value: engineStatus,
      meta: milOn ? 'MIL ON' : 'MIL OFF',
      tone: milOn ? 'warn' : 'good',
    },
    {
      label: 'Transmission',
      value:
        transmission?.status != null
          ? String(transmission.status)
          : 'Not recorded',
      meta: null,
      tone: 'neutral',
    },
    {
      label: 'Battery',
      value:
        battery?.voltage != null
          ? String(battery.voltage)
          : battery?.status != null
            ? String(battery.status)
            : 'Not recorded',
      meta: battery?.status != null ? String(battery.status) : null,
      tone: 'neutral',
    },
    {
      label: 'Emissions',
      value:
        emissions?.status != null ? String(emissions.status) : 'Not recorded',
      meta: null,
      tone:
        String(emissions?.status ?? '').toLowerCase() === 'ready'
          ? 'good'
          : 'neutral',
    },
    {
      label: 'ABS / Braking',
      value: abs?.status != null ? String(abs.status) : 'Not recorded',
      meta: null,
      tone: 'neutral',
    },
  ];

  const liveBits: string[] = [];
  if (live?.rpm != null) liveBits.push(`RPM ${escapeHtml(String(live.rpm))}`);
  if (live?.coolantC != null) {
    liveBits.push(`Coolant ${escapeHtml(String(live.coolantC))}°C`);
  }

  const tileHtml = tiles
    .map(
      (tile) => `
      <article class="metric metric-${tile.tone}">
        <p class="metric-label">${escapeHtml(tile.label)}</p>
        <p class="metric-value">${escapeHtml(tile.value)}</p>
        ${
          tile.meta
            ? `<p class="metric-meta">${escapeHtml(tile.meta)}</p>`
            : ''
        }
      </article>`,
    )
    .join('');

  return `
    <div class="metric-grid">${tileHtml}</div>
    ${
      liveBits.length
        ? `<p class="footnote">At scan: ${liveBits.join(' · ')}</p>`
        : ''
    }
    <p class="footnote">Source: ${escapeHtml(source)}</p>`;
}

function renderCosmetic(cosmetic: PublicReportData['cosmetic']): string {
  if (!cosmetic) {
    return '<p class="empty">No cosmetic ratings recorded.</p>';
  }

  const items = [
    { label: 'Exterior', rating: cosmetic.exteriorRating },
    { label: 'Interior', rating: cosmetic.interiorRating },
    { label: 'Glass', rating: cosmetic.glassRating },
  ];

  const cards = items
    .map(
      (item) => `
      <article class="score-card">
        <p class="score-label">${escapeHtml(item.label)}</p>
        <p class="stars" aria-label="${item.rating} of 5">${ratingStars(item.rating)}</p>
        <p class="score-num">${item.rating}/5</p>
      </article>`,
    )
    .join('');

  return `
    <div class="score-grid">${cards}</div>
    ${
      cosmetic.tireNotes
        ? `<p class="note"><strong>Tires:</strong> ${escapeHtml(cosmetic.tireNotes)}</p>`
        : ''
    }`;
}

function renderInspections(
  inspections: PublicReportData['inspections'],
): string {
  if (!inspections?.length) {
    return '<p class="empty">No inspection checklist recorded.</p>';
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
    return '<p class="empty">No listing details recorded.</p>';
  }

  const price = formatPrice(listing.askingPrice);
  const parts: string[] = [];
  if (price) {
    parts.push(
      `<div class="listing-price">${escapeHtml(price)}</div>`,
    );
  }
  if (listing.location) {
    parts.push(
      `<p class="listing-meta">${escapeHtml(listing.location)}</p>`,
    );
  }
  if (!parts.length) {
    return '<p class="empty">No listing details recorded.</p>';
  }
  return parts.join('');
}

function renderMedia(media: PublicReportData['media']): string {
  if (!media?.length) {
    return '<p class="empty">No photos or videos uploaded for this report.</p>';
  }

  const photos = media.filter((m) => m.type === 'PHOTO' && m.url);
  const videos = media.filter((m) => m.type === 'VIDEO' && m.url);

  const photoHtml = photos
    .map((m, index) => {
      const label = categoryLabel(m.category);
      return `
      <button
        type="button"
        class="photo"
        data-gallery-index="${index}"
        data-src="${escapeHtml(m.url!)}"
        data-caption="${escapeHtml(label)}"
        aria-label="Open ${escapeHtml(label)} photo"
      >
        <img src="${escapeHtml(m.url!)}" alt="${escapeHtml(label)}" loading="lazy"/>
        <span class="photo-caption">${escapeHtml(label)}</span>
        <span class="photo-zoom-hint" aria-hidden="true">Tap to zoom</span>
      </button>`;
    })
    .join('');

  const videoHtml = videos
    .map(
      (m) => `
      <figure class="video">
        <video src="${escapeHtml(m.url!)}" controls playsinline preload="metadata"></video>
        <figcaption>${escapeHtml(categoryLabel(m.category))}</figcaption>
      </figure>`,
    )
    .join('');

  if (!photoHtml && !videoHtml) {
    return '<p class="empty">No photos or videos uploaded for this report.</p>';
  }

  return `
    ${photoHtml ? `<div class="photo-grid">${photoHtml}</div>` : ''}
    ${videoHtml ? `<div class="video-grid">${videoHtml}</div>` : ''}`;
}

function renderLightbox(): string {
  return `
  <div id="lightbox" class="lightbox" hidden role="dialog" aria-modal="true" aria-label="Photo viewer">
    <div class="lightbox-toolbar">
      <button type="button" id="lightbox-close" class="lightbox-btn" aria-label="Close">✕</button>
      <p id="lightbox-caption" class="lightbox-caption"></p>
      <span class="lightbox-count"><span id="lightbox-index">1</span>/<span id="lightbox-total">1</span></span>
    </div>
    <button type="button" id="lightbox-prev" class="lightbox-nav lightbox-prev" aria-label="Previous photo">‹</button>
    <div class="lightbox-stage" id="lightbox-stage">
      <img id="lightbox-image" alt=""/>
    </div>
    <button type="button" id="lightbox-next" class="lightbox-nav lightbox-next" aria-label="Next photo">›</button>
    <p class="lightbox-hint">Pinch to zoom · swipe or arrows to browse</p>
  </div>`;
}

function renderLightboxScript(): string {
  // Vanilla lightbox with pinch/double-tap zoom — no external deps.
  return `<script>
(function () {
  var items = Array.prototype.slice.call(document.querySelectorAll('.photo[data-gallery-index]'));
  var hero = document.querySelector('.hero-photo[data-lightbox-src]');
  var root = document.getElementById('lightbox');
  var img = document.getElementById('lightbox-image');
  var stage = document.getElementById('lightbox-stage');
  var caption = document.getElementById('lightbox-caption');
  var indexEl = document.getElementById('lightbox-index');
  var totalEl = document.getElementById('lightbox-total');
  var closeBtn = document.getElementById('lightbox-close');
  var prevBtn = document.getElementById('lightbox-prev');
  var nextBtn = document.getElementById('lightbox-next');
  if (!root || !img || !stage) return;

  var index = 0;
  var scale = 1;
  var tx = 0;
  var ty = 0;
  var pointers = new Map();
  var startDist = 0;
  var startScale = 1;
  var lastTap = 0;

  function applyTransform() {
    img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
  }

  function resetZoom() {
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  function currentSrc(el) {
    return el.getAttribute('data-src') || el.getAttribute('data-lightbox-src') || '';
  }

  function currentCaption(el) {
    return el.getAttribute('data-caption') || el.getAttribute('data-lightbox-caption') || '';
  }

  function show(i) {
    if (!items.length) {
      if (!hero) return;
      img.src = currentSrc(hero);
      caption.textContent = currentCaption(hero);
      indexEl.textContent = '1';
      totalEl.textContent = '1';
      resetZoom();
      root.hidden = false;
      document.body.style.overflow = 'hidden';
      return;
    }
    index = (i + items.length) % items.length;
    var el = items[index];
    img.src = currentSrc(el);
    caption.textContent = currentCaption(el);
    indexEl.textContent = String(index + 1);
    totalEl.textContent = String(items.length);
    resetZoom();
    root.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function hide() {
    root.hidden = true;
    document.body.style.overflow = '';
    img.removeAttribute('src');
    resetZoom();
  }

  function openFromSrc(src) {
    if (!src) return;
    var found = -1;
    for (var i = 0; i < items.length; i++) {
      if (currentSrc(items[i]) === src) { found = i; break; }
    }
    if (found >= 0) show(found);
    else if (hero && currentSrc(hero) === src) show(0);
  }

  items.forEach(function (el) {
    el.addEventListener('click', function () {
      show(Number(el.getAttribute('data-gallery-index')) || 0);
    });
  });

  if (hero) {
    hero.addEventListener('click', function () {
      openFromSrc(currentSrc(hero));
    });
  }

  if (!items.length && !hero) return;

  closeBtn.addEventListener('click', hide);
  prevBtn.addEventListener('click', function () { show(index - 1); });
  nextBtn.addEventListener('click', function () { show(index + 1); });
  root.addEventListener('click', function (e) {
    if (e.target === root || e.target === stage) hide();
  });

  document.addEventListener('keydown', function (e) {
    if (root.hidden) return;
    if (e.key === 'Escape') hide();
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });

  img.addEventListener('click', function (e) {
    e.stopPropagation();
    var now = Date.now();
    if (now - lastTap < 300) {
      if (scale > 1) resetZoom();
      else { scale = 2.5; applyTransform(); }
    }
    lastTap = now;
  });

  function distance(a, b) {
    var dx = a.clientX - b.clientX;
    var dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  stage.addEventListener('pointerdown', function (e) {
    if (root.hidden) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, e);
    if (pointers.size === 2) {
      var pts = Array.from(pointers.values());
      startDist = distance(pts[0], pts[1]);
      startScale = scale;
    }
  });

  stage.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId)) return;
    var prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, e);
    if (pointers.size === 2) {
      var pts = Array.from(pointers.values());
      var dist = distance(pts[0], pts[1]);
      if (startDist > 0) {
        scale = Math.min(4, Math.max(1, startScale * (dist / startDist)));
        applyTransform();
      }
    } else if (pointers.size === 1 && scale > 1) {
      tx += e.clientX - prev.clientX;
      ty += e.clientY - prev.clientY;
      applyTransform();
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) startDist = 0;
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
})();
</script>`;
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
  const cover = pickCoverPhoto(data.media);
  const price = formatPrice(data.listing?.askingPrice);
  const hasObd = Boolean(obdSummary);
  const hasInspection = Boolean(data.inspections?.length);

  const heroMedia = cover
    ? `<button type="button" class="hero-photo" data-lightbox-src="${escapeHtml(cover.url!)}" data-lightbox-caption="${escapeHtml(categoryLabel(cover.category))}" aria-label="Open cover photo">
        <img src="${escapeHtml(cover.url!)}" alt="${escapeHtml(title || 'Vehicle')}" />
        <span class="hero-zoom">Tap to zoom</span>
      </button>`
    : `<div class="hero-photo hero-photo-empty" aria-hidden="true"><span>CarStatix</span></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <meta name="theme-color" content="#0f172a"/>
  <title>${escapeHtml(title || 'Vehicle Report')} · CarStatix</title>
  <style>
    :root{
      --bg:#0b1220;
      --bg-soft:#111827;
      --card:#ffffff;
      --ink:#0f172a;
      --muted:#64748b;
      --line:#e2e8f0;
      --brand:#1d4ed8;
      --brand-soft:#dbeafe;
      --good:#059669;
      --good-soft:#d1fae5;
      --fair:#d97706;
      --fair-soft:#fef3c7;
      --warn:#dc2626;
      --warn-soft:#fee2e2;
      --radius:18px;
      --shadow:0 10px 30px rgba(15,23,42,.08);
    }
    *{box-sizing:border-box}
    html,body{margin:0}
    body{
      font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
      background:linear-gradient(180deg,#0b1220 0%,#0b1220 180px,#eef2f7 180px,#eef2f7 100%);
      color:var(--ink);
      line-height:1.45;
      min-height:100vh;
    }
    .wrap{max-width:560px;margin:0 auto;padding:16px 16px 40px}
    .brand-bar{
      display:flex;align-items:center;justify-content:space-between;
      color:#cbd5e1;font-size:12px;font-weight:600;letter-spacing:.04em;
      text-transform:uppercase;margin-bottom:12px;
    }
    .brand-bar strong{color:#fff;font-size:14px;letter-spacing:0;text-transform:none}
    .hero-shell{
      background:var(--card);border-radius:24px;overflow:hidden;
      box-shadow:var(--shadow);margin-bottom:14px;
    }
    .hero-photo{
      position:relative;display:block;width:100%;padding:0;border:0;cursor:zoom-in;
      background:#0f172a;aspect-ratio:16/10;
    }
    .hero-photo img{width:100%;height:100%;object-fit:cover;display:block}
    .hero-photo-empty{
      display:flex;align-items:center;justify-content:center;
      color:#94a3b8;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
    }
    .hero-zoom{
      position:absolute;right:12px;bottom:12px;
      background:rgba(15,23,42,.72);color:#fff;font-size:11px;font-weight:600;
      padding:6px 10px;border-radius:999px;
    }
    .hero-body{padding:18px 18px 20px}
    .hero-body h1{margin:0 0 6px;font-size:1.55rem;line-height:1.2;font-weight:800}
    .hero-sub{margin:0;color:var(--muted);font-size:14px}
    .hero-price{margin:12px 0 0;font-size:1.35rem;font-weight:800;color:var(--brand)}
    .chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    .badge{
      display:inline-flex;align-items:center;font-size:11px;font-weight:700;
      padding:6px 10px;border-radius:999px;letter-spacing:.02em;
    }
    .badge-good{background:var(--good-soft);color:var(--good)}
    .badge-fair{background:var(--fair-soft);color:var(--fair)}
    .badge-warn{background:var(--warn-soft);color:var(--warn)}
    .badge-muted{background:#f1f5f9;color:#475569}
    .badge-brand{background:var(--brand-soft);color:var(--brand)}
    .card{
      background:var(--card);border-radius:var(--radius);padding:18px;
      margin-bottom:12px;box-shadow:var(--shadow);
    }
    .eyebrow{
      margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;
      text-transform:uppercase;color:var(--brand);
    }
    h2{margin:0 0 14px;font-size:1.05rem;font-weight:800}
    .empty,.footnote{margin:0;color:var(--muted);font-size:14px}
    .footnote{margin-top:12px;font-size:13px}
    .metric-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .metric{
      border:1px solid var(--line);border-radius:14px;padding:12px;
      background:#f8fafc;min-height:92px;
    }
    .metric-good{border-color:#a7f3d0;background:#f0fdf4}
    .metric-warn{border-color:#fecaca;background:#fef2f2}
    .metric-label{margin:0;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
    .metric-value{margin:8px 0 0;font-size:14px;font-weight:700;line-height:1.35}
    .metric-meta{margin:6px 0 0;font-size:12px;color:var(--muted);font-weight:600}
    .score-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .score-card{
      text-align:center;border:1px solid var(--line);border-radius:14px;
      padding:12px 8px;background:#f8fafc;
    }
    .score-label{margin:0;font-size:12px;color:var(--muted);font-weight:600}
    .stars{margin:8px 0 4px;color:#f59e0b;letter-spacing:1px;font-size:14px}
    .score-num{margin:0;font-size:12px;font-weight:700}
    .note{margin:14px 0 0;padding:12px;border-radius:12px;background:#f8fafc;border:1px solid var(--line);font-size:14px}
    .inspect-list{display:flex;flex-direction:column;gap:10px}
    .inspect-item{padding:12px;background:#f8fafc;border-radius:12px;border:1px solid var(--line)}
    .inspect-head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:14px}
    .obs{margin:8px 0 0;font-size:13px;color:#475569}
    .listing-price{font-size:1.6rem;font-weight:800;color:var(--brand)}
    .listing-meta{margin:8px 0 0;color:var(--muted);font-size:14px}
    .photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .photo{
      position:relative;margin:0;padding:0;border:0;background:transparent;
      text-align:left;cursor:zoom-in;border-radius:14px;overflow:hidden;
    }
    .photo img{
      width:100%;aspect-ratio:4/3;object-fit:cover;display:block;
      background:#e2e8f0;
    }
    .photo-caption{
      display:block;font-size:11px;color:var(--muted);margin-top:6px;
      text-transform:capitalize;font-weight:600;
    }
    .photo-zoom-hint{
      position:absolute;left:8px;top:8px;
      background:rgba(15,23,42,.65);color:#fff;font-size:10px;font-weight:600;
      padding:4px 8px;border-radius:999px;
    }
    .video-grid{display:flex;flex-direction:column;gap:12px;margin-top:12px}
    .video{margin:0}
    .video video{width:100%;border-radius:14px;background:#000}
    .video figcaption{font-size:11px;color:var(--muted);margin-top:6px;text-transform:capitalize;font-weight:600}
    footer{text-align:center;padding:18px 8px 8px;font-size:12px;color:#94a3b8}
    footer strong{color:#64748b}

    .lightbox[hidden]{display:none!important}
    .lightbox{
      position:fixed;inset:0;z-index:1000;background:rgba(2,6,23,.94);
      display:flex;flex-direction:column;touch-action:none;
    }
    .lightbox-toolbar{
      display:flex;align-items:center;gap:12px;padding:12px 14px;
      color:#e2e8f0;flex-shrink:0;
    }
    .lightbox-caption{flex:1;margin:0;font-size:13px;font-weight:600;text-transform:capitalize}
    .lightbox-count{font-size:12px;color:#94a3b8;font-variant-numeric:tabular-nums}
    .lightbox-btn,.lightbox-nav{
      border:0;background:rgba(255,255,255,.08);color:#fff;
      width:40px;height:40px;border-radius:999px;font-size:20px;cursor:pointer;
    }
    .lightbox-stage{
      flex:1;display:flex;align-items:center;justify-content:center;
      overflow:hidden;position:relative;padding:8px 52px 24px;
    }
    .lightbox-stage img{
      max-width:100%;max-height:100%;object-fit:contain;
      transform-origin:center center;will-change:transform;
      user-select:none;-webkit-user-drag:none;
    }
    .lightbox-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:2}
    .lightbox-prev{left:8px}
    .lightbox-next{right:8px}
    .lightbox-hint{
      text-align:center;color:#64748b;font-size:11px;margin:0 0 16px;flex-shrink:0;
    }
    @media (max-width:420px){
      .metric-grid{grid-template-columns:1fr 1fr}
      .score-grid{grid-template-columns:1fr; }
      .lightbox-stage{padding:8px 12px 16px}
      .lightbox-nav{display:none}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand-bar">
      <strong>CarStatix</strong>
      <span>Verified report</span>
    </div>

    <header class="hero-shell">
      ${heroMedia}
      <div class="hero-body">
        <h1>${escapeHtml(title || 'Vehicle')}</h1>
        <p class="hero-sub">VIN ${escapeHtml(data.vehicle.vinMasked)}</p>
        ${price ? `<p class="hero-price">${escapeHtml(price)}</p>` : ''}
        <div class="chip-row">
          ${hasObd ? '<span class="badge badge-good">OBD verified</span>' : '<span class="badge badge-muted">No OBD</span>'}
          ${hasInspection ? '<span class="badge badge-brand">Inspection</span>' : ''}
          ${data.listing?.location ? `<span class="badge badge-muted">${escapeHtml(data.listing.location)}</span>` : ''}
        </div>
      </div>
    </header>

    ${section('Diagnostics at a glance', renderObd(obdSummary), 'OBD scan')}
    ${section('Cosmetic condition', renderCosmetic(data.cosmetic), 'Appearance')}
    ${section('Mechanical inspection', renderInspections(data.inspections), 'Checklist')}
    ${section('Listing', renderListing(data.listing), 'Seller')}
    ${section('Photo gallery', renderMedia(data.media), 'Media')}

    <footer>
      ${published ? `Published ${escapeHtml(published)} · ` : ''}
      <strong>CarStatix</strong> verified vehicle record
    </footer>
  </div>

  ${renderLightbox()}
  ${renderLightboxScript()}
</body>
</html>`;
}
