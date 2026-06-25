import { AppError } from '../lib/errors.js';

const NHTSA_DECODE_URL =
  'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues';

export interface VinDecodeResult {
  vin: string;
  make: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  bodyClass: string | null;
  driveType: string | null;
  fuelType: string | null;
  engineCylinders: string | null;
  plantCountry: string | null;
  errorCode: string | null;
  errorText: string | null;
}

interface NhtsaRow {
  VIN?: string;
  Make?: string;
  Model?: string;
  ModelYear?: string;
  Trim?: string;
  BodyClass?: string;
  DriveType?: string;
  FuelTypePrimary?: string;
  EngineCylinders?: string;
  PlantCountry?: string;
  ErrorCode?: string;
  ErrorText?: string;
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const normalized = vin.trim().toUpperCase();

  const url = `${NHTSA_DECODE_URL}/${encodeURIComponent(normalized)}?format=json`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new AppError(502, 'VIN lookup service unavailable', 'VIN_SERVICE_DOWN');
  }

  if (!response.ok) {
    throw new AppError(502, 'VIN lookup failed', 'VIN_LOOKUP_FAILED');
  }

  const data = (await response.json()) as { Results?: NhtsaRow[] };
  const row = data.Results?.[0];

  if (!row) {
    throw new AppError(404, 'No decode result for this VIN', 'VIN_NOT_FOUND');
  }

  const year = row.ModelYear ? parseInt(row.ModelYear, 10) : null;

  return {
    vin: normalized,
    make: emptyToNull(row.Make),
    model: emptyToNull(row.Model),
    year: year && !Number.isNaN(year) ? year : null,
    trim: emptyToNull(row.Trim),
    bodyClass: emptyToNull(row.BodyClass),
    driveType: emptyToNull(row.DriveType),
    fuelType: emptyToNull(row.FuelTypePrimary),
    engineCylinders: emptyToNull(row.EngineCylinders),
    plantCountry: emptyToNull(row.PlantCountry),
    errorCode: emptyToNull(row.ErrorCode),
    errorText: emptyToNull(row.ErrorText),
  };
}

function emptyToNull(value?: string): string | null {
  if (!value || value === 'Not Applicable' || value === 'Not Available') {
    return null;
  }
  return value;
}
