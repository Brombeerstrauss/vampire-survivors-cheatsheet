# Operation Guns
CHARACTERS = {
    "Bill Rizer": ("🎖️", "Erhält bei vielen besiegten Gegnern mehr Projektilgeschwindigkeit (max. 50 %) und Macht; findet spezielle Pickups."),
    "Lance Bean": ("🪖", "Erhält bei vielen besiegten Gegnern mehr Geschwindigkeit (max. 50 %) und kürzere Abklingzeit (max. −25 %); findet spezielle Pickups."),
    "Ariana": ("🏃‍♀️", "Laufgeschwindigkeit erhöht die Rüstung; findet spezielle Pickups."),
    "Lucia Zero": ("🔴", "Erhält nach einer Wiederbelebung einen Bonus auf alle Werte; findet spezielle Pickups."),
    "Brad Fang": ("🐺", "Bei wenig Gesundheit kürzere Abklingzeit sowie mehr Lauf- und Projektilgeschwindigkeit; findet spezielle Pickups."),
    "Browny": ("🤖", "Kürzere Abklingzeit vergrößert die Fläche; findet spezielle Pickups."),
    "Sheena Etranzi": ("🎯", "Laufgeschwindigkeit senkt die Abklingzeit; findet spezielle Pickups."),
    "Probotector": ("🦾", "Rüstung erhöht die Macht; findet spezielle Pickups."),
    "Stanley": ("🧔", "Macht erhöht die Rüstung; findet spezielle Pickups."),
    "Newt Plissken": ("💣", "Projektilgeschwindigkeit erhöht die Macht; findet zusätzliche explosive Objekte und spezielle Pickups."),
    "Colonel Bahamut": ("👾", "Gier und Fluch erhöhen die Macht; findet spezielle Pickups."),
    "Simondo Belmont": ("🧑‍🦲", "Braucht angeblich gar keine Waffen; erhält alle 20 Level mehr Projektile (max. +4)."),
}
WEAPONS = {
    "Long Gun": ("🔫", "Feuert ununterbrochen in Blickrichtung."),
    "Short Gun": ("🔫", "Feuert waagerechte Salven kurzlebiger Projektile."),
    "Spread Shot": ("🎆", "Feuert breit gestreut in Blickrichtung."),
    "C-U-Laser": ("🔦", "Feuert ein durchdringendes Projektil in Blickrichtung."),
    "Firearm": ("🔥", "Feuert rotierende Projektile auf den nächsten Gegner."),
    "Sonic Bloom": ("🌸", "Feuert wachsende Projektile in Blickrichtung."),
    "Homing Miss": ("🚀", "Feuert explodierende, zielsuchende Projektile."),
    "Diver Mines": ("💣", "Feuert explosive Projektile, die an Wänden entlanglaufen."),
    "Blade Crossbow": ("🏹", "Feuert zielsuchende Projektile, die sich beim Treffer auf der Stelle drehen."),
    "Prism Lass": ("💎", "Kann Gegner mit kleiner Chance einfrieren."),
    "Metal Claw": ("🦀", "Die Abklingzeit hängt von der fehlenden Gesundheit ab."),
    "Prototype A": ("🛸", "Entwicklung von Long Gun: ruft 2 Drohnen zur Feuerunterstützung."),
    "Prototype B": ("🛸", "Entwicklung von Short Gun: ruft 2 Drohnen zur Feuerunterstützung."),
    "Prototype C": ("🛸", "Entwicklung von Spread Shot: ruft 2 Drohnen zur Feuerunterstützung."),
    "Pronto Beam": ("🔆", "Entwicklung von C-U-Laser: Laser teilen sich beim Treffer in mehrere Strahlen."),
    "Fire-L3GS": ("🔥", "Entwicklung von Firearm: feuert erneut, wenn eine Lichtquelle oder ein zerstörbares Objekt zerstört wird."),
    "Wave Beam": ("〰️", "Entwicklung von Sonic Bloom: lädt im Stehen einen stärkeren, automatisch zielenden Schuss auf."),
    "Multistage Missiles": ("🚀", "Entwicklung von Homing Miss: Projektile teilen sich beim Treffer in kleinere."),
    "Atmo-Torpedo": ("🌀", "Entwicklung von Diver Mines: erzeugt Schadenszonen, die Gegner anziehen."),
    "BFC2000-AD": ("✝️", "Entwicklung von Blade Crossbow: ruft göttliches Eingreifen, je öfter, desto mehr Glück."),
    "Time Warp": ("⏳", "Entwicklung von Prism Lass: kann Gegner einfrieren, verlangsamen oder entwaffnen."),
    "Big Fuzzy Fist": ("👊", "Entwicklung von Metal Claw: verprügelt die stärksten sichtbaren Gegner."),
}
PASSIVES = {
    "Weapon Power-Up": ("⬆️", "Erhöht eine zufällige ausgerüstete Waffe um eine Stufe und gibt +1 Wiederbelebung; belegt keinen Slot."),
}
PASSIVE_FLAGS = {"Weapon Power-Up": {"noSlot": True}}
CONSUMED = {"Weapon Power-Up"}
STAGE_ONLY = set()
EVOLUTION_DE = {}
CHARACTER_NOTES = {}
CHARACTER_WEAPON_OVERRIDES = {}
RECOMMENDATIONS = {}
MORPH_RELIC_LEVEL = "Charakter erreicht Level 80"
