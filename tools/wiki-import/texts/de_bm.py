# Legacy of the Bloodmoon
CHARACTERS = {
    "Malice Bloodmoon": ("🩸", "Erhält alle 4 Level +0,1 Regeneration; bei Vergeltung, kritischer Gesundheit, letztem Atemzug und Wiederbelebung löst sie einen großen Blutfluch aus."),
    "Calogero Bloodmoon": ("🧛‍♂️", "Letzter Atemzug: +50 % max. Gesundheit; Vergeltung gibt kurz einen Werte-Bonus."),
    "Ashtart": ("🔥", "Bei kritischer Gesundheit +1 Wiederbelebung; ruft zu jeder vollen Minute Überreste besiegter Gegner herbei."),
    "Sargon": ("🌀", "Erzeugt Raumverzerrungen, die Gegner verwirren; Meister von FireFall, FireWall und FireBall; bei Wiederbelebung eine zusätzliche Verzerrung."),
    "Nameless Fool": ("🃏", "Letzter Atemzug: verliert die Hälfte der max. Gesundheit und erhält eine zufällige Darkana; Wiederbelebungen können weitere bringen (max. 3)."),
    "Congregation": ("👥", "Jede Wiederbelebung über eins gibt einen zusätzlichen passiven Slot; bei kritischer Gesundheit feuert die Hauptwaffe je nach übrigen Wiederbelebungen; bei Wiederbelebung erscheint ein Velvet Dodecahedron."),
    "Nameless Saint": ("😇", "Startet mit heiligen Waffen, je nachdem, was in der Sammlung freigeschaltet ist; letzter Atemzug löst einen Rosary aus."),
    "Baal'Thasar": ("😈", "Geübt mit Höllen-Waffen; Blut-Waffen lassen Blut fallen; letzter Atemzug gibt je nach gesammeltem Blut kurz mehr Macht und kürzere Abklingzeit."),
    "Jaman Jato ★": ("🍖", "Erhält alle 20 Level mehr Projektile (max. +4); jede abgeschlossene Stage gibt einen Prestige-Rang."),
    "In' Kujata": ("🐂", "Stampft alle paar Schritte auf den Boden; wächst mit gesammelter Rüstung; bei kritischer Gesundheit kurz mehr Rüstung."),
    "Megalo Sargon": ("🌌", "„Zweischneidige Geschenke. Dunkle Illusionen. Echos der Vergangenheit.“"),
    "Baal'Thamut": ("🐋", "„Es ist Boden und Horizont zugleich und verschlingt sich doch selbst.“"),
}
WEAPONS = {
    "Scarlet Needle": ("📍", "Schadensnadeln heften den nächsten Gegner an Ort und Stelle."),
    "Ashella": ("🪶", "Kann kritisch treffen."),
    "Incineration": ("🔥", "Löscht Gegner in Blickrichtung aus."),
    "Screams from the Void": ("😱", "Stößt Schreie mit starkem Rückstoß aus; schlägt zurück."),
    "Blacken Firmament": ("🌑", "Löscht einen zufälligen Gegner aus und hinterlässt manchmal einen schädlichen Riss in der Wirklichkeit."),
    "108 Responsive Prayers": ("📿", "Eigentlich nur 16; der Schaden hängt vom Unterschied zwischen Fluch und Glück ab."),
    "FireFall": ("☄️", "Trifft den entferntesten Gegner; der Schaden wird zusätzlich mit der Macht multipliziert."),
    "FireBall": ("🔥", "Erzeugt eine wachsende Schadenszone; der Schaden wird mit der Fläche multipliziert."),
    "FireWall": ("🧱", "Erzeugt eine gerichtete Schadenszone; wächst stark mit der Anzahl."),
    "Descent Into Misery": ("⬇️", "Verfluchter Gegenstand: die Anzahl erhöht den Schaden; kritische Treffer oder Richtungswechsel lösen Zusatzangriffe aus."),
    "Cardinal Rain": ("🌧️", "Entwicklung von Scarlet Needle: endloser Regen, der in jede Richtung treffen kann."),
    "Bloodlust": ("🩸", "Entwicklung von Ashella: kritischer Schaden hängt von der Anzahl ab."),
    "Dust to Dust": ("⚱️", "Entwicklung von Incineration: höllische Asche weht zurück und löscht Gegner aus."),
    "Forbidden Siren": ("🧜", "Entwicklung von Screams from the Void: zieht Gegner an und entwaffnet sie."),
    "Damnation": ("⛓️", "Entwicklung von Blacken Firmament: zieht Gegner ins Verderben."),
    "Road to Heaven": ("🛕", "Union aus 108 Bocce und 108 Responsive Prayers: 108-mal auslösen, um die Erleuchtung zu erahnen."),
    "FireStall": ("🌋", "Union aus FireFall, FireBall und FireWall: wird nach jeder Singularität stärker."),
    "Shimmering Sands": ("⏳", "Union aus Kyra-Stones und Descent Into Misery: Treibsand zieht Gegner in die Hölle."),
}
PASSIVES = {
    "Velvet Dodecahedron": ("🎲", "Geschenk: mehr Wachstum und Gier, dafür weniger max. Gesundheit; löst Fähigkeiten für letzten Atemzug, Wiederbelebung und kritische Gesundheit aus."),
}
PASSIVE_FLAGS = {"Velvet Dodecahedron": {"noSlot": True}}
STAGE_ONLY = set()
EVOLUTION_DE = {
    "FireStall": {"conditions": ["Kein Gegenstand nötig; alle drei Feuerwaffen auf Maximalstufe."]},
    "Shimmering Sands": {"conditions": ["Kein Gegenstand nötig; Kyra-Stones ist selbst eine Entwicklung von Magi-Stone."]},
    "Road to Heaven": {"conditions": ["Kein Gegenstand nötig."], "note": "Braucht 108 Bocce aus Legacy of the Moonspell."},
}
CHARACTER_NOTES = {}
CHARACTER_WEAPON_OVERRIDES = {}
RECOMMENDATIONS = {}
MORPH_RELIC_LEVEL = "Charakter erreicht Level 80"
