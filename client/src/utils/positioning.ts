/**
 * Customisation positions ("Poziționare personalizare").
 *
 * Every position on a product (piept, spate, mânecă...) carries its own
 * quantity, dimensions and unit cost. Area and total cost are always derived,
 * never stored.
 *
 * Orders created before this change stored positioning as a plain string[]
 * with a single set of measurements on the item itself, so every read goes
 * through normalizePositioning() which upgrades the old shape in place.
 */

export interface PositionEntry {
  name: string;
  quantity: number | null;
  length: number | null;
  width: number | null;
  cmp: number | null;
}

/** Same shape as PositionEntry, but with raw input strings (form state). */
export interface PositionFormEntry {
  name: string;
  quantity: string;
  length: string;
  width: string;
  cmp: string;
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Accepts the current shape (array of objects), the legacy shape (array of
 * strings) and anything malformed, and always returns clean entries.
 *
 * `legacyItem` is the sub-order itself: for legacy string positions, its
 * item-level measurements are carried onto each position so old orders still
 * display their dimensions.
 */
export function normalizePositioning(value: any, legacyItem?: any): PositionEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry): PositionEntry | null => {
      if (typeof entry === 'string') {
        const name = entry.trim();
        if (!name) return null;
        return {
          name,
          quantity: toNumber(legacyItem?.quantity),
          length: toNumber(legacyItem?.length),
          width: toNumber(legacyItem?.width),
          cmp: toNumber(legacyItem?.cmp)
        };
      }

      if (entry && typeof entry === 'object') {
        const name = String(entry.name || '').trim();
        if (!name) return null;
        return {
          name,
          quantity: toNumber(entry.quantity),
          length: toNumber(entry.length),
          width: toNumber(entry.width),
          cmp: toNumber(entry.cmp)
        };
      }

      return null;
    })
    .filter((entry): entry is PositionEntry => entry !== null);
}

/** Positions as editable form entries. */
export function toPositionFormEntries(value: any, legacyItem?: any): PositionFormEntry[] {
  return normalizePositioning(value, legacyItem).map(pos => ({
    name: pos.name,
    quantity: pos.quantity === null ? '' : String(pos.quantity),
    length: pos.length === null ? '' : String(pos.length),
    width: pos.width === null ? '' : String(pos.width),
    cmp: pos.cmp === null ? '' : String(pos.cmp)
  }));
}

/** Form entries back into the stored shape (Firestore rejects `undefined`). */
export function toStoredPositioning(entries: PositionFormEntry[]): PositionEntry[] {
  return (entries || [])
    .filter(entry => entry && entry.name.trim())
    .map(entry => ({
      name: entry.name.trim(),
      quantity: toNumber(entry.quantity),
      length: toNumber(entry.length),
      width: toNumber(entry.width),
      cmp: toNumber(entry.cmp)
    }));
}

export function createPositionFormEntry(name: string): PositionFormEntry {
  return { name: name.trim(), quantity: '', length: '', width: '', cmp: '' };
}

/** Area in cm², derived from length × width. */
export function getPositionArea(pos: { length?: any; width?: any }): number | null {
  const length = toNumber(pos?.length);
  const width = toNumber(pos?.width);
  if (!length || !width) return null;
  return round2(length * width);
}

/** Cost of a position: quantity × cost per unit. */
export function getPositionCost(pos: { quantity?: any; cmp?: any }): number | null {
  const quantity = toNumber(pos?.quantity);
  const cmp = toNumber(pos?.cmp);
  if (!quantity || !cmp) return null;
  return round2(quantity * cmp);
}

/** Sum of every position cost on an item, or null when nothing is priced. */
export function getPositioningTotalCost(positions: PositionEntry[] | PositionFormEntry[]): number | null {
  const costs = (positions || [])
    .map(pos => getPositionCost(pos as any))
    .filter((cost): cost is number => cost !== null);
  if (costs.length === 0) return null;
  return round2(costs.reduce((sum, cost) => sum + cost, 0));
}

/** Single-line summary, used for search, audit entries and exports. */
export function formatPositioning(positions: PositionEntry[]): string {
  return (positions || [])
    .map(pos => {
      const details: string[] = [];
      if (pos.quantity !== null) details.push(`${pos.quantity} buc`);
      if (pos.length !== null || pos.width !== null) {
        details.push(`${pos.length ?? '-'}x${pos.width ?? '-'} cm`);
      }
      const area = getPositionArea(pos);
      if (area !== null) details.push(`${area} cm²`);
      if (pos.cmp !== null) details.push(`${pos.cmp} RON/buc`);
      return details.length > 0 ? `${pos.name} (${details.join(', ')})` : pos.name;
    })
    .join('; ');
}
