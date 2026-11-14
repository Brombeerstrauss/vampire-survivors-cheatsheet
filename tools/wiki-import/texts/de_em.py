# Emergency Meeting
CHARACTERS = {
    "Crewmate Dino": ("🧑‍🚀", "Erhält Werte-Boni, sobald irgendeine Waffe die Maximalstufe erreicht."),
    "Engineer Gino": ("🔧", "Wählt auf Level 2, 12 und 22 einen zusätzlichen passiven Gegenstand."),
    "Ghost Lino": ("👻", "Kann weder Schaden nehmen noch austeilen, verschwindet aber beim Zeitlimit; ignoriert Wände."),
    "Shapeshifter Nino": ("🫥", "Hinterlässt bei Schaden überzählige Körperteile und kann die Gestalt wechseln."),
    "Guardian Pina": ("🛡️", "Kann +1 Wiederbelebung erhalten, wenn jemand wiederbelebt wird; erhöht Rüstung und Regeneration in der Nähe; ignoriert Wände."),
    "Impostor Rina": ("🔪", "Wird nach vielen besiegten Gegnern oder einem besiegten Verbündeten stärker und kurz unverwundbar."),
    "Scientist Mina": ("🧪", "Alle 10 Level −10 % Glück (max. −90 %); kann alle 10 Level einen Bonus pro Level wählen (max. 5-mal)."),
    "Horse": ("🐴", "Erhält alle 20 Level mehr Projektile (max. +4)."),
    "Megalo Impostor Rina": ("🟥", "„Ich bin nicht der Impostor.“"),
}
WEAPONS = {
    "Report!": ("📢", "Schadet Gegnern und stößt sie weg."),
    "Lucky Swipe": ("💳", "Die Zahl der Angriffe hängt von der Anzahl und von niedrigem Glück ab."),
    "Lifesign Scan": ("📈", "Heilt abhängig von Anzahl und Regeneration."),
    "Just Vent": ("🕳️", "Vernichtet Gegner oder schadet ihnen schwer; die Anzahl bestimmt, wie oft er auslöst."),
    "Clear Debris": ("☄️", "Erzeugt mitwandernde Zonen, aus denen Projektile kommen."),
    "Sharp Tongue": ("👅", "Trifft Gegner vor dir; der Schaden wird mit der Regeneration multipliziert."),
    "Science Rocks": ("🪨", "Erzeugt Zonen, die bei Berührung explodieren; die Anzahl bestimmt die Zahl der Explosionsgruppen."),
    "Hats": ("🎩", "Wirft niedliche, abprallende Projektile mit zufälligen Eigenschaften."),
    "Emergency Meeting": ("🚨", "Entwicklung von Report!: vernichtet gelegentlich alle Gegner einer Art."),
    "Crossed Wires": ("🔌", "Entwicklung von Lucky Swipe: greift in bis zu vier Richtungen an."),
    "Paranormal Scan": ("🔮", "Entwicklung von Lifesign Scan: gibt regelmäßig einen dauerhaften zufälligen Werte-Bonus."),
    "Unjust Ejection": ("🌀", "Entwicklung von Just Vent: saugt Gegner ein."),
    "Clear Asteroids": ("🌠", "Entwicklung von Clear Debris: die Anzahl erzeugt Explosionsgruppen."),
    "Impostongue": ("🗡️", "Entwicklung von Sharp Tongue: hoher Schaden am stärksten Gegner und allem auf dem Weg."),
    "Rocket Science": ("🚀", "Entwicklung von Science Rocks: löst unter den richtigen Bedingungen einen Abschluss-Angriff aus."),
}
PASSIVES = {
    "Mini Crewmate": ("🧑‍🚀", "Ruft gelegentlich Gegner in der Nähe an."),
    "Mini Engineer": ("🔧", "Elektrisiert gelegentlich Gegner."),
    "Mini Ghost": ("👻", "Lässt Gegner gelegentlich vor Angst erstarren."),
    "Mini Shapeshifter": ("🫥", "Wirft gelegentlich übrige Körperteile auf Gegner."),
    "Mini Guardian": ("🛡️", "Fängt gelegentlich einen Treffer für dich ab."),
    "Mini Impostor": ("🔪", "Sticht gelegentlich auf Gegner ein."),
    "Mini Scientist": ("🧪", "Wirft gelegentlich Wissenschaft auf Gegner."),
    "Mini Horse": ("🐴", "Steckt dich gelegentlich mit unerbittlicher Fröhlichkeit an."),
}
_MINI = ["Mini Crewmate", "Mini Engineer", "Mini Ghost", "Mini Shapeshifter", "Mini Guardian", "Mini Impostor", "Mini Scientist", "Mini Horse"]
PASSIVE_FLAGS = {name: {"ignoresSlotLimit": True} for name in _MINI}
STAGE_ONLY = set()
EVOLUTION_DE = {}
CHARACTER_NOTES = {}
CHARACTER_WEAPON_OVERRIDES = {}
RECOMMENDATIONS = {}
MORPH_RELIC_LEVEL = "Charakter erreicht Level 80"
