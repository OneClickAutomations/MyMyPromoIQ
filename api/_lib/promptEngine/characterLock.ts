/**
 * Identity + product anchor generation (Rules 3 & 4).
 *
 * The identity anchor is stated in full at the start of the FIRST segment of a
 * clip; later segments refer to the subject by a short physical descriptor
 * ("the woman with the braids") — never by name or a bare pronoun. The product
 * anchor is the exact same physical sentence in every clip to prevent drift.
 */
import type { EngineCreator, EngineProduct } from './types.js'

/** Full identity sentence for the first segment. */
export function buildIdentityAnchor(creator?: EngineCreator): string {
  if (!creator) return 'A person on camera'
  if (creator.anchorOverride?.trim()) return creator.anchorOverride.trim()

  const parts: string[] = []
  const lead = [creator.ageRange, creator.ethnicity, creator.gender]
    .filter(Boolean)
    .join(' ')
    .trim()
  parts.push(lead ? `A ${lead}` : 'A person')
  if (creator.hair) parts.push(`with ${creator.hair}`)
  if (creator.wardrobe) parts.push(`wearing ${creator.wardrobe}`)
  if (creator.distinguishingFeature) parts.push(creator.distinguishingFeature)
  return parts.join(', ')
}

/** Short recurring descriptor for segments 2..N (avoids re-stating everything
 *  while still never using a bare pronoun). Falls back to a generic phrase. */
export function buildShortDescriptor(creator?: EngineCreator): string {
  if (!creator) return 'the person'
  const noun = creator.gender?.trim().toLowerCase() || 'person'
  if (creator.hair) return `the ${noun} with ${creator.hair}`
  if (creator.wardrobe) return `the ${noun} in ${creator.wardrobe}`
  return `the ${noun}`
}

/** Short in-action product reference for filling {product} slots, so the FULL
 *  anchor isn't restated twice in one segment. e.g. "the GLOW SERUM bottle". */
export function buildProductShort(product: EngineProduct): string {
  const label = product.name?.trim()
  if (label) return `the ${label} ${guessContainerNoun(product)}`
  return 'the product'
}

/** Guess a container noun from the description so the short ref reads naturally. */
function guessContainerNoun(product: EngineProduct): string {
  const d = (product.description || '').toLowerCase()
  if (/jar/.test(d)) return 'jar'
  if (/tube/.test(d)) return 'tube'
  if (/bottle|dropper/.test(d)) return 'bottle'
  if (/box|case|pack/.test(d)) return 'pack'
  if (/can|tin/.test(d)) return 'can'
  if (/pouch|bag|sachet/.test(d)) return 'pouch'
  return 'product'
}

/** The exact physical product sentence, repeated verbatim in every clip. */
export function buildProductAnchor(product: EngineProduct): string {
  if (product.physicalDescription?.trim()) return product.physicalDescription.trim()
  const label = product.name?.trim()
  const scale = product.scaleComparison?.trim()
  const base = label
    ? `the product labeled ${label} (${product.description.trim()})`
    : `the product — ${product.description.trim()}`
  return scale ? `${base}, ${scale}, held so the label faces the camera` : `${base}, held so the label faces the camera`
}
