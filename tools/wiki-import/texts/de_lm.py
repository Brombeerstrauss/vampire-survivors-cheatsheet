# Legacy of the Moonspell
CHARACTERS = {
    "Miang Moonspell": ("🌙", "Regeneration verstärkt alle Heilquellen; Überheilung erhöht die max. Gesundheit leicht."),
    "Menya Moonspell": ("🌸", "Überheilung +16 löst ihre Startwaffe aus; wird nach vielen besiegten Gegnern kurz stärker und unverwundbar."),
    "Syuuto Moonspell": ("🗡️", "Startet mit verstecktem Night Sword; verwandelt sich in eine stärkere Form, wenn seine Startwaffe sich entwickelt."),
    "Babi-Onna": ("👘", "Überheilung +16 gibt kurz mehr Laufgeschwindigkeit; ignoriert Abklingzeiten, Waffen feuern beim Laufen in festen Abständen."),
    "Megalo Miang Moonspell": ("🌕", "Max. Gesundheit entspricht der aktuellen Gesundheit; hat ein verstecktes Argent Flow."),
    "Megalo Menya Moonspell": ("🌺", "Überheilung +16 löst ihre erste Waffe aus; kann keinen Schaden nehmen, verschwindet aber beim Zeitlimit; startet mit verstecktem 108 Bocce."),
    "Megalo Syuuto Moonspell": ("🩸", "Überheilung +16 gibt Blut-Waffen mehr Schaden; erhält pro Level +1 % Macht."),
    "McCoy-Oni": ("👹", "Überheilung +16 gibt einen Reroll; die Fläche wächst in festen Abständen kurzzeitig."),
    "Gav'Et-Oni ★": ("🥒", "Erhält alle 20 Level mehr Projektile (max. +4); jede abgeschlossene Stage gibt einen Prestige-Rang."),
    "Spiritoso": ("💧", "Überheilung +64 erzeugt eine Wasser- oder Mondwaffe; geübt mit Mille Bolle Blu und Penshin Fatcha."),
    "Spiritosa": ("💦", "Überheilung +16 gibt einen Begleiter (max. 30); alle 8 Level ein verstecktes Mille Bolle Blu (max. 6); geübt mit Mille Bolle Blu und Penshin Fatcha."),
    "Gekkojin": ("🌗", "Heilt statt Schaden zu nehmen, verschwindet aber beim Zeitlimit; startet mit Pearl magatama."),
}
WEAPONS = {
    "Silver Wind": ("🌬️", "Besiegte Gegner können Herzen fallen lassen."),
    "Four Seasons": ("🍂", "Erzeugt 4 Explosionen; Anzahl und Dauer erhöhen stattdessen den Schaden."),
    "Summon Night": ("🌌", "Erzeugt Schadenszonen über dem Charakter."),
    "Mirage Robe": ("🧥", "Erzeugt einfrierende, stehende Projektile, die explodieren können."),
    "Night Sword": ("🗡️", "Schlägt mit Bonusschaden zurück, der von der Gier abhängt; kann Herzen stehlen."),
    "Mille Bolle Blu": ("🫧", "Feuert Projektile, die eine Weile bleiben."),
    "108 Bocce": ("🎱", "Eigentlich nur 8; der Schaden hängt vom Unterschied zwischen Fluch und Glück ab."),
    "LunarMight": ("🌑", "Erzeugt eine Schadenszone, die die Macht leicht erhöht."),
    "LunarSight": ("🌒", "Erzeugt Schadenszonen, die dem Charakter gelegentlich folgen."),
    "LunarBight": ("🌘", "Kann getroffene Gegner verlangsamen."),
    "Festive Winds": ("🎐", "Entwicklung von Silver Wind: schwächt die Abwehr der Gegner."),
    "Argent Flow": ("🌊", "Entwicklung von Festive Winds: zerfetzt die Abwehr der Gegner."),
    "Godai Shuffle": ("🎴", "Entwicklung von Four Seasons: erzeugt eine zusätzliche Explosion."),
    "Echo Night": ("🌃", "Entwicklung von Summon Night: erzeugt auch Schadenszonen unter dem Charakter."),
    "J'Odore": ("🌫️", "Entwicklung von Mirage Robe: Projektile bewegen sich und verwirren Gegner."),
    "Muramasa": ("⚔️", "Entwicklung von Night Sword: ermöglicht kritische Treffer und einen Kombo-Abschluss; saugt Gesundheit ab."),
    "Boo Roo Boolle": ("🫧", "Entwicklung von Mille Bolle Blu: Projektile können dasselbe Ziel mehrfach treffen."),
    "LunarFlight": ("🌙", "Union aus LunarMight, LunarSight und LunarBight: werde eins mit den Mondzeichen."),
}
PASSIVES = {
    "Pearl magatama": ("🦪", "Geschenk: mehr Regeneration und Wiederbelebungen, dafür weniger Gier; heilt vollständig."),
}
PASSIVE_FLAGS = {"Pearl magatama": {"noSlot": True}}
STAGE_ONLY = set()
EVOLUTION_DE = {"LunarFlight": {"conditions": ["Kein Gegenstand nötig; alle drei Mondwaffen auf Maximalstufe."]}}
CHARACTER_NOTES = {}
CHARACTER_WEAPON_OVERRIDES = {}
RECOMMENDATIONS = {}
MORPH_RELIC_LEVEL = "Charakter erreicht Level 80"
