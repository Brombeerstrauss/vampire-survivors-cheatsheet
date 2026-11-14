import { useId } from 'react'
import { Card, Section } from '../components/ui.tsx'
import { gameData } from '../data/index.ts'
import type { Lang } from '../data/types.ts'
import { useI18n } from '../i18n/index.ts'
import { useAppState } from '../state/context.ts'

const REPOSITORY = 'https://github.com/Brombeerstrauss/vampire-survivors-cheatsheet'

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={`flex min-h-12 items-center justify-between gap-4 py-2 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
    >
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-white/55">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-7 w-12 rounded-full bg-white/15 transition-colors peer-checked:bg-gold-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-300" />
        <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
]

function LanguageSwitch() {
  const { settings, setLanguage } = useAppState()
  const { t } = useI18n()
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2">
      <span className="font-medium">{t.language}</span>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-night-900 p-1" role="radiogroup" aria-label={t.language}>
        {LANGUAGES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={settings.language === value}
            lang={value}
            onClick={() => setLanguage(value)}
            className={`min-h-9 rounded-lg px-3 text-sm font-medium ${
              settings.language === value ? 'bg-night-700 text-gold-300 shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function AboutData({ unverified }: { unverified: number }) {
  const { lang } = useI18n()
  const wiki = (
    <a className="text-gold-300 underline" href="https://vampire.survivors.wiki/" target="_blank" rel="noreferrer">
      Vampire Survivors Wiki
    </a>
  )
  const license = (
    <a className="underline" href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noreferrer">
      CC BY-NC-SA 3.0
    </a>
  )
  if (lang === 'en') {
    return (
      <Card className="space-y-3 text-sm text-white/70">
        <p>
          The game data comes from the official {wiki} (license {license}). Every evolution was cross-checked against
          several wiki pages; entries where that wasn't conclusive are marked “unverified” ({unverified} entries).
        </p>
        <p>
          English names and descriptions are the original game texts from the wiki. German names come from poncle's
          public localisation sheet where available; it only covers part of the base game.
        </p>
        <p>
          The in-game images belong to poncle. The app doesn't contain copies; it loads them directly from the wiki,
          and images you've seen once stay on your device for offline use. Your own icons in{' '}
          <code className="rounded bg-white/10 px-1">public/custom-icons/</code> take priority.
        </p>
        <p>Unofficial fan project, not affiliated with poncle. Vampire Survivors is a trademark of poncle.</p>
      </Card>
    )
  }
  return (
    <Card className="space-y-3 text-sm text-white/70">
      <p>
        Die Spieldaten stammen aus dem offiziellen {wiki} (Lizenz {license}). Jede Entwicklung wurde gegen mehrere
        Wiki-Seiten abgeglichen. Einträge, bei denen das nicht eindeutig war, tragen das Zeichen „ungeprüft“ (
        {unverified} Stück).
      </p>
      <p>
        Deutsche Namen stammen aus poncles öffentlicher Lokalisierungs-Tabelle, die nur einen Teil des Basisspiels
        abdeckt. Fehlt dort ein Name, steht der englische Name aus dem Spiel, bei Bedarf mit einer eigenen Übersetzung
        in Klammern.
      </p>
      <p>
        Die Bilder aus dem Spiel gehören poncle. Die App enthält keine Kopien davon, sondern lädt sie direkt vom Wiki;
        einmal angezeigte Bilder bleiben für den Offline-Betrieb auf deinem Gerät gespeichert. Eigene Icons im Ordner{' '}
        <code className="rounded bg-white/10 px-1">public/custom-icons/</code> haben Vorrang.
      </p>
      <p>Inoffizielles Fan-Projekt, nicht verbunden mit poncle. Vampire Survivors ist eine Marke von poncle.</p>
    </Card>
  )
}

export function SettingsView() {
  const { settings, setOwnedPack, setShowSecrets, setShowImages } = useAppState()
  const { t, text, lang } = useI18n()
  const owned = new Set(settings.ownedPacks)
  const all = [...gameData.characters, ...gameData.weapons, ...gameData.passives, ...gameData.evolutions]
  const unverified = all.filter((e) => !e.verified).length
  const count = (source: string) => ({
    characters: gameData.characters.filter((c) => c.source === source).length,
    weapons: gameData.weapons.filter((w) => w.source === source).length,
  })
  const buildDate = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'long' }).format(
    new Date(`${__BUILD_DATE__}T12:00:00`),
  )

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">{t.settings}</h1>

      <Section title={t.display}>
        <Card className="divide-y divide-white/8 py-1">
          <LanguageSwitch />
          <Toggle label={t.showImages} description={t.showImagesHelp} checked={settings.showImages} onChange={setShowImages} />
          <Toggle
            label={t.showSecrets}
            description={t.showSecretsHelp}
            checked={settings.showSecrets}
            onChange={setShowSecrets}
          />
        </Card>
      </Section>

      <Section title={t.yourContent}>
        <Card className="divide-y divide-white/8 py-1">
          {gameData.packs.map((pack) => {
            const n = count(pack.id)
            return (
              <Toggle
                key={pack.id}
                label={text(pack.name)}
                description={
                  pack.kind === 'base'
                    ? t.alwaysIncluded
                    : `${pack.paid ? t.paid : t.free} · ${t.packCounts(n.characters, n.weapons)}`
                }
                checked={owned.has(pack.id)}
                disabled={pack.kind === 'base'}
                onChange={(on) => setOwnedPack(pack.id, on)}
              />
            )
          })}
        </Card>
        <p className="text-sm text-white/55">{t.crossDlcNote}</p>
      </Section>

      <Section title={t.aboutData}>
        <AboutData unverified={unverified} />
      </Section>

      <Section title={t.version}>
        <Card className="space-y-1 text-sm text-white/70">
          <p className="font-medium text-white">{t.versionLine(__APP_VERSION__, buildDate)}</p>
          {__APP_COMMIT__ && (
            <p>
              {t.codeState(__APP_COMMIT__)} ·{' '}
              <a className="text-gold-300 underline" href={`${REPOSITORY}/commit/${__APP_COMMIT__}`} target="_blank" rel="noreferrer">
                {t.sourceCode}
              </a>
            </p>
          )}
        </Card>
      </Section>
    </div>
  )
}
