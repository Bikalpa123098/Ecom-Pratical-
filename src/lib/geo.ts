/**
 * Nepal administrative divisions.
 *
 * PROVINCES is the complete, authoritative list of Nepal's 7 provinces.
 *
 * DISTRICTS AND MUNICIPALITIES ARE NOT HARD-CODED HERE. The national list runs
 * to 77 districts and 536 local levels and is amended under the Local
 * Government Act; a list baked into the bundle goes stale silently and would
 * either block a real order (missing a new local level) or mis-deliver one
 * (wrong spelling). Instead the checkout form accepts the customer's own
 * province/district/municipality as validated text backed by `datalist`
 * suggestions, and the admin dashboard can maintain the canonical list.
 *
 * The province list IS fixed and validated by a unit test, because a wrong
 * province is a hard error rather than a stale-but-usable suggestion.
 *
 * Delivery pricing only needs to know whether an order is inside the Kathmandu
 * Valley, so it depends on `KATHMANDU_VALLEY_DISTRICTS` (below) rather than on
 * an exhaustive dataset.
 */

export const NEPAL_PROVINCES = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim",
] as const;

export type Province = (typeof NEPAL_PROVINCES)[number];

export const PROVINCE_SET: ReadonlySet<string> = new Set(NEPAL_PROVINCES);

export function isValidProvince(value: string): value is Province {
  return PROVINCE_SET.has(value);
}

/**
 * Districts we deliver to on the cheaper in-city rate.
 *
 * Only the three Valley districts qualify. Everything else — including
 * Rupandehi (Bhairahawa / Butwal) — pays the outside-valley rate, since both
 * are several hundred kilometres from the Kathmandu warehouse.
 */
export const KATHMANDU_VALLEY_DISTRICTS = ["Kathmandu", "Lalitpur", "Bhaktapur"] as const;

export function isInsideKathmanduValley(district: string): boolean {
  return (KATHMANDU_VALLEY_DISTRICTS as readonly string[]).includes(district.trim());
}

/**
 * Suggestions shown in the district `datalist`. These are convenience hints for
 * the most commonly shipped districts, NOT a whitelist — the customer may type
 * any district. Kept deliberately small so it cannot be mistaken for the
 * authoritative dataset.
 */
export const DISTRICT_SUGGESTIONS: readonly string[] = [
  // Kathmandu Valley — cheaper in-city delivery
  "Kathmandu",
  "Lalitpur",
  "Bhaktapur",
  // Bagmati
  "Dhading",
  "Kavrepalnchok",
  "Makwanpur",
  "Nuwakot",
  "Sindhupalchok",
  "Dolakha",
  "Ramechhap",
  "Solukhumbu",
  "Gorkha",
  // Gandaki
  "Kaski",
  "Baglung",
  "Parbat",
  "Myagdi",
  "Syangja",
  "Lamjung",
  "Tanahun",
  "Manang",
  "Mustang",
  "Chitwan",
  // Koshi
  "Morang",
  "Sunsari",
  "Jhapa",
  "Bhojpur",
  "Dhankuta",
  "Ilam",
  "Udayapur",
  // Madhesh
  "Sarlahi",
  "Parsa",
  "Bara",
  "Dhanusha",
  "Mahottari",
  "Rapti",
  "Ruchaur",
  // Lumbini — Rupandehi is the operator's home district
  "Rupandehi",
  "Banke",
  "Dang",
  "Palpa",
  "Nawalparasi West",
  "Kapilvastu",
  "Rukum East",
  "Rukum West",
  "Salyan",
  // Karnali
  "Surkhet",
  "Jumla",
  "Kalikot",
  "Dailekh",
  "Jajarkot",
  "Dolpa",
  "Mugu",
  "Humla",
  // Sudurpashchim
  "Kailali",
  "Kanchanpur",
  "Dadeldhura",
  "Baitadi",
  "Darchula",
  "Bajhang",
  "Bajura",
];

/**
 * Municipality / city suggestions. The shop is based in Rupandehi, so
 * Bhairahawa and Butwal (the district's two main urban centres) are listed
 * alongside the Valley and major regional cities.
 */
export const MUNICIPALITY_SUGGESTIONS: readonly string[] = [
  // Rupandehi — operator's district
  "Butwal Sub-Metropolitan City",
  "Bhairahawa Municipality",
  "Tilottama Municipality",
  "Satyawati Municipality",
  "Gautamnagar Municipality",
  // Kathmandu Valley
  "Kathmandu Metropolitan City",
  "Lalitpur Metropolitan City",
  "Bhaktapur Municipality",
  "Tokha Municipality",
  "Kageshwori Manohara Municipality",
  "Budhanilkantha Municipality",
  "Nagarjun Municipality",
  "Shankarpur Municipality",
  "Tarakeshwor Municipality",
  "Godawari Municipality",
  // Gandaki / Bagmati
  "Pokhara Metropolitan City",
  "Lekhnath Municipality",
  "Machhapuchhre Rural Municipality",
  "Bharatpur Municipality",
  "Chitwan Sub-Metropolitan City",
  "Beni Municipality",
  "Kushma Municipality",
  "Baglung Municipality",
  "Waling Municipality",
  "Gorkha Municipality",
  // Koshi
  "Biratnagar Metropolitan City",
  "Dharan Metropolitan City",
  "Itahari Municipality",
  "Damak Municipality",
  "Bhojpur Municipality",
  // Madhesh
  "Janakpur Sub-Metropolitan City",
  "Birgunj Sub-Metropolitan City",
  "Hetauda Sub-Metropolitan City",
  // Lumbini
  "Nepalgunj Sub-Metropolitan City",
  "Kohalpur Municipality",
  "Ghorahi Sub-Metropolitan City",
  "Tansen Sub-Metropolitan City",
  // Karnali / Sudurpashchim
  "Birendranagar Municipality",
  "Dhangadhi Sub-Metropolitan City",
  "Dipayal Municipality",
  "Dadeldhura Municipality",
  "Bajura Municipality",
  "Jumla Municipality",
  "Dunai Municipality",
  "Manakamana Municipality",
  "Muktinath Rural Municipality",
  "Chame Rural Municipality",
];
