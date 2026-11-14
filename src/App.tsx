import { gameData } from './data/index.ts'

// Vorläufige Startseite: zeigt nur, dass Grundgerüst und Daten geladen werden.
// Die eigentliche Oberfläche folgt, sobald das Datenmodell abgestimmt ist.
export default function App() {
  const counts = [
    ['Pakete', gameData.packs.length],
    ['Charaktere', gameData.characters.length],
    ['Waffen', gameData.weapons.length],
    ['Passive Gegenstände', gameData.passives.length],
    ['Entwicklungen', gameData.evolutions.length],
  ] as const

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <header>
        <h1 className="text-2xl font-bold text-gold-300">VS Companion</h1>
        <p className="mt-1 text-sm text-white/60">Grundgerüst steht, die Oberfläche folgt.</p>
      </header>
      <dl className="grid grid-cols-2 gap-3">
        {counts.map(([label, count]) => (
          <div key={label} className="rounded-xl bg-night-800 p-3">
            <dt className="text-xs text-white/60">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-white/40">Inoffizielles Fan-Projekt, nicht verbunden mit poncle.</p>
    </main>
  )
}
