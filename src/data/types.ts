/**
 * Datenmodell der App.
 *
 * Alle Spieldaten liegen als JSON unter `src/data/packs/<paket>/`.
 * Die passenden JSON-Schemas stehen in `src/data/schema/` und werden von den
 * Tests gegen die Daten geprüft. Wer hier ein Feld ändert, muss das Schema
 * mit anpassen.
 *
 * Kennungen (`id`) sind klein geschrieben mit Bindestrichen, z. B. `magic-wand`.
 * Namen bleiben englisch wie im Spiel, Beschreibungen sind deutsch.
 */

export type PackId = string
export type CharacterId = string
export type WeaponId = string
export type PassiveId = string
export type EvolutionId = string

/** Ein Inhaltspaket: das Basisspiel oder ein DLC. Steht in `packs.json`. */
export interface Pack {
  /** Entspricht dem Ordnernamen unter `packs/`, das Basisspiel heißt `base`. */
  id: PackId
  name: string
  kind: 'base' | 'dlc'
  /** Kostenpflichtig? Kostenlose Inhalte sind im DLC-Filter vorausgewählt. */
  paid: boolean
  /** Erscheinungsdatum, `JJJJ-MM-TT`. */
  released?: string
  verified: boolean
}

/** Felder, die Charaktere, Waffen und passive Gegenstände gemeinsam haben. */
interface Entry {
  id: string
  /** Englischer Name wie im Spiel. */
  name: string
  /** Paket, aus dem der Eintrag stammt (`base` oder DLC-Kennung). */
  source: PackId
  /** `false`, solange der Eintrag nicht sicher gegen das Wiki geprüft ist. */
  verified: boolean
  /** Platzhalter-Symbol, solange kein eigenes Icon hinterlegt ist. */
  emoji?: string
  /** Dateiname eines eigenen Icons in `public/custom-icons/`. */
  icon?: string
  /** Wie man den Eintrag freischaltet. */
  unlock?: string
  /** Freie Anmerkung, z. B. warum etwas noch ungeprüft ist. */
  note?: string
}

export interface Character extends Entry {
  /** Meist genau eine Waffe; manche Charaktere starten ohne oder mit mehreren. */
  startingWeapons: WeaponId[]
  /** Besonderheit des Charakters in einem Satz, z. B. Bonus pro Level. */
  bonus: string
  /** Geheimer Charakter; lässt sich über den Spoiler-Schalter ausblenden. */
  secret: boolean
}

export interface Weapon extends Entry {
  /** `evolved` = Ergebnis einer Entwicklung, Union oder eines Geschenks. */
  kind: 'base' | 'evolved'
  description: string
  /** Höchste Stufe (Basiswaffen meist 8, entwickelte meist 1). */
  maxLevel: number
  /** Nur diese Charaktere können die Waffe führen; fehlt das Feld, ist sie frei wählbar. */
  exclusiveTo?: CharacterId[]
}

export interface PassiveItem extends Entry {
  description: string
  maxLevel: number
  /** Nur als Fundstück in der Stage erhältlich, nicht über Level-ups. */
  stageOnly?: boolean
}

/** Stufe, die eine Zutat haben muss: Maximalstufe oder egal. */
export type RequiredLevel = 'max' | 'any'

export interface WeaponRequirement {
  id: WeaponId
  /** Standard: `max`. */
  level?: RequiredLevel
}

export interface PassiveRequirement {
  id: PassiveId
  /** Standard: `any` (es reicht, den Gegenstand zu besitzen). */
  level?: RequiredLevel
}

/**
 * Wie eine Entwicklung abläuft:
 * - `evolution`: die Waffe wird durch das Ergebnis ersetzt
 * - `union`: mehrere Waffen verschmelzen zu einer (gibt Waffen-Slots frei)
 * - `gift`: die Ausgangswaffe bleibt, das Ergebnis kommt zusätzlich dazu
 */
export type EvolutionKind = 'evolution' | 'union' | 'gift'

export interface Evolution {
  id: EvolutionId
  kind: EvolutionKind
  /** Paket, das diese Entwicklung einführt. Beteiligte Zutaten dürfen aus anderen Paketen stammen. */
  source: PackId
  /** Die entwickelte Waffe (Eintrag mit `kind: "evolved"`). */
  result: WeaponId
  /** Benötigte Waffen: eine bei Entwicklungen, mehrere bei Unions. */
  weapons: WeaponRequirement[]
  /** Benötigte passive Gegenstände; darf leer sein. */
  passives: PassiveRequirement[]
  /** Weitere Bedingungen als Text, z. B. bestimmter Charakter oder Zeitpunkt. */
  conditions?: string[]
  verified: boolean
  note?: string
}

export interface RecommendedItem<Id extends string = string> {
  id: Id
  /** Kurze Begründung, z. B. Synergie mit dem Bonus des Charakters. */
  reason: string
  /** 1 = Kern des Builds, 2 = gute Ergänzung, 3 = optional. */
  priority: 1 | 2 | 3
}

/** Kuratierte Empfehlung für einen Charakter. Mehrere Pakete dürfen denselben Charakter ergänzen. */
export interface Recommendation {
  character: CharacterId
  /** Paket, aus dem diese Empfehlung stammt. */
  source: PackId
  /** Spielstil in ein bis zwei Sätzen. */
  summary?: string
  weapons: RecommendedItem<WeaponId>[]
  passives: RecommendedItem<PassiveId>[]
}

/** Alle Pakete zusammengeführt, so wie die App sie verwendet. */
export interface GameData {
  packs: Pack[]
  characters: Character[]
  weapons: Weapon[]
  passives: PassiveItem[]
  evolutions: Evolution[]
  recommendations: Recommendation[]
}

/** Slot-Grenzen im Spiel. */
export const MAX_WEAPON_SLOTS = 6
export const MAX_PASSIVE_SLOTS = 6
