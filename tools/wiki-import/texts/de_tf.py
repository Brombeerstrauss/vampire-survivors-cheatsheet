# Tides of the Foscari
CHARACTERS = {
    "Eleanor Uziron": ("🧙‍♀️", "Erhält SpellStream auf Level 10, SpellStrike auf Level 20 und Academy Badge auf Level 30."),
    "Maruto Cuts": ("🛡️", "Erhält nach erlittenem Schaden kurz mehr Rüstung; Academy Badge auf Level 30."),
    "Keitha Muort": ("🏹", "Glücksabhängige Aufladung feuert eine Salve Flash Arrows; +1 % Glück pro Level; Academy Badge auf Level 30."),
    "Luminaire Foscari": ("✨", "Löst beim Level-up einen Rosary aus; nach einer Wiederbelebung kurz mehr Macht, Laufgeschwindigkeit und kürzere Abklingzeit."),
    "Genevieve Gruyère": ("🧀", "Löst beim Level-up einen Vacuum aus; einmal pro Leben World Eater nach tödlichem Schaden."),
    "Je-Ne-Viv": ("🌍", "„Es frisst buchstäblich die Welt.“"),
    "Sammy": ("🐟", "Erhält Erfahrung beim Aufsammeln von Goldmünzen und Geldbeuteln; startet mit zeitweise verringerter Macht."),
    "Rottin'Ghoul": ("🧟", "Erhält alle 20 Level mehr Projektile (max. +4)."),
}
WEAPONS = {
    "SpellString": ("🪡", "Trifft Gegner in der Nähe; der Schaden wird mit der Geschwindigkeit multipliziert."),
    "SpellStream": ("🌊", "Erzeugt eine wachsende Schadenszone; der Schaden wird mit der Fläche multipliziert."),
    "SpellStrike": ("⚡", "Trifft den nächsten Gegner; der Schaden wird zusätzlich mit der Macht multipliziert."),
    "Eskizzibur": ("🗡️", "Greift Gegner in der Nähe an; schlägt zurück."),
    "Flash Arrow": ("🏹", "Kann kritisch treffen; die Anzahl erhöht stattdessen den Schaden."),
    "Prismatic Missile": ("🔷", "Erzeugt Explosionen um den Charakter; wird von der zuerst gewählten Arcana II, XIV oder XIX beeinflusst."),
    "Shadow Servant": ("👤", "Kann Gegner verlangsamen."),
    "Party Popper": ("🎉", "Wirft abprallende Projektile."),
    "Legionnaire": ("🛡️", "Entwicklung von Eskizzibur: erzeugt zusätzliche Projektile mit Vergeltungsschaden."),
    "Millionaire": ("💰", "Entwicklung von Flash Arrow: feuert zusätzliche Projektile je nach Anzahl und beim Aufsammeln von Goldmünzen."),
    "Luminaire": ("💡", "Entwicklung von Prismatic Missile: erhöht den Wert von Edelsteinen und Münzen am Boden."),
    "Ophion": ("🐍", "Entwicklung von Shadow Servant: kann Gegner sofort töten."),
    "SpellStrom": ("🌪️", "Union aus SpellString, SpellStream und SpellStrike: wird nach jeder Singularität stärker."),
}
PASSIVES = {
    "Academy Badge": ("🎓", "Mehr Anzahl und Wiederbelebungen, dafür weniger Wachstum."),
}
PASSIVE_FLAGS = {}
STAGE_ONLY = set()
EVOLUTION_DE = {"SpellStrom": {"conditions": ["Kein Gegenstand nötig; alle drei Zauberwaffen auf Maximalstufe."]}}
CHARACTER_NOTES = {
    "Eleanor Uziron": "SpellStream und SpellStrike kommen erst auf Level 10 und 20 dazu.",
}
CHARACTER_WEAPON_OVERRIDES = {"Eleanor Uziron": ["SpellString"]}
RECOMMENDATIONS = {}
MORPH_RELIC_LEVEL = "Charakter erreicht Level 80"
