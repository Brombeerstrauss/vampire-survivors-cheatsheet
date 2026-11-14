import { useId } from 'react'
import { Card, Section } from '../components/ui.tsx'
import { gameData } from '../data/index.ts'
import { useAppState } from '../state/context.ts'

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

export function SettingsView() {
  const { settings, setOwnedPack, setShowSecrets } = useAppState()
  const owned = new Set(settings.ownedPacks)
  const all = [...gameData.characters, ...gameData.weapons, ...gameData.passives, ...gameData.evolutions]
  const unverified = all.filter((e) => !e.verified).length
  const count = (source: string) => ({
    characters: gameData.characters.filter((c) => c.source === source).length,
    weapons: gameData.weapons.filter((w) => w.source === source).length,
  })

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Einstellungen</h1>

      <Section title="Deine Inhalte">
        <Card className="divide-y divide-white/8 py-1">
          {gameData.packs.map((pack) => {
            const n = count(pack.id)
            const empty = n.characters === 0 && n.weapons === 0
            return (
              <Toggle
                key={pack.id}
                label={pack.name}
                description={
                  pack.kind === 'base'
                    ? 'Immer dabei.'
                    : empty
                      ? `${pack.paid ? 'Kostenpflichtig' : 'Kostenlos'} · Daten folgen noch`
                      : `${pack.paid ? 'Kostenpflichtig' : 'Kostenlos'} · ${n.characters} Charaktere, ${n.weapons} Waffen`
                }
                checked={owned.has(pack.id)}
                disabled={pack.kind === 'base'}
                onChange={(on) => setOwnedPack(pack.id, on)}
              />
            )
          })}
        </Card>
        <p className="text-sm text-white/55">
          Entwicklungen, an denen mehrere DLCs beteiligt sind, erscheinen nur, wenn alle beteiligten Inhalte
          aktiviert sind.
        </p>
      </Section>

      <Section title="Spoiler">
        <Card className="py-1">
          <Toggle
            label="Geheime Charaktere anzeigen"
            description="Blendet geheime Charaktere in Listen und Empfehlungen ein."
            checked={settings.showSecrets}
            onChange={setShowSecrets}
          />
        </Card>
      </Section>

      <Section title="Über die Daten">
        <Card className="space-y-3 text-sm text-white/70">
          <p>
            Die Spieldaten stammen aus dem offiziellen{' '}
            <a className="text-gold-300 underline" href="https://vampire.survivors.wiki/" target="_blank" rel="noreferrer">
              Vampire Survivors Wiki
            </a>{' '}
            (Lizenz{' '}
            <a
              className="underline"
              href="https://creativecommons.org/licenses/by-nc-sa/3.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY-NC-SA 3.0
            </a>
            ). Jede Entwicklung wurde gegen mehrere Wiki-Seiten abgeglichen. Einträge, bei denen das nicht eindeutig
            war, tragen das Zeichen „ungeprüft“ ({unverified} Stück).
          </p>
          <p>
            Bilder aus dem Spiel sind nicht enthalten. Eigene Icons kannst du im Ordner{' '}
            <code className="rounded bg-white/10 px-1">public/custom-icons/</code> ablegen.
          </p>
          <p>
            Inoffizielles Fan-Projekt, nicht verbunden mit poncle. Vampire Survivors ist eine Marke von poncle.
          </p>
        </Card>
      </Section>
    </div>
  )
}
