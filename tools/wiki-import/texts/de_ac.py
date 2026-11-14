# Ante Chamber
CHARACTERS = {
    "Jimbo": ("🃏", "Findet immer Survarots, startet mit einer Survarot-Auswahl und hat einen Survarot-Stufenmultiplikator von 4."),
    "Canio": ("🎭", "Überspringen beim Level-up kann eine Survarot-Auswahl auslösen."),
    "Chicot": ("🤡", "Findet immer Survarots und startet mit einer Survarot-Auswahl; senkt die Gesundheit von Bossen und blockt einige Spezialangriffe."),
    "Perkeo": ("🎴", "Findet immer Survarots; kann bis zu 100 passive Gegenstände tragen."),
}
WEAPONS = {
    "Infernolatro": ("🔥", "Erzeugt eine Flammenzone in Blickrichtung; wird durch besiegte Gegner stärker."),
    "Gros Michel": ("🍌", "Wirft gebogene Bananen; 1 zu 6 Chance auf kritischen Treffer mit Explosion."),
    "Fibonacci Spritz": ("🫧", "Versprüht spiralförmig Sprudelwasser; kann eine andere ausgerüstete Waffe mit auslösen."),
    "Celestial Booster": ("🪐", "Planeten kreisen um dich; der Schaden steigt mit den in diesem Lauf gesammelten Münzen."),
    "NaneInferno": ("🔥", "Entwicklung von Infernolatro: fügt eine zweite Zone hinzu; überlagerte Zonen vervielfachen ihre Wirkung."),
    "Cavendish": ("🍌", "Entwicklung von Gros Michel: trifft immer kritisch und explodiert immer; andere Waffen treffen öfter kritisch."),
    "Royal Flush": ("🂡", "Entwicklung von Fibonacci Spritz: 55 % Chance, 1, 2, 3 oder 5 andere Waffen mit auszulösen."),
    "Negative Space": ("🌌", "Entwicklung von Celestial Booster: enthüllt geheime Planeten, die gelegentlich negativ werden."),
}
PASSIVES = {
    "Outer Saboteur": ("🃏", "Gibt dir Goldmünzen und macht dann unpassenden Gebrauch von deinen Ersparnissen; erscheint automatisch mit der ersten Ante-Chamber-Waffe und belegt keinen Slot."),
}
PASSIVE_FLAGS = {"Outer Saboteur": {"noSlot": True}}
STAGE_ONLY = set()
EVOLUTION_DE = {}
CHARACTER_NOTES = {"Perkeo": "Kann bis zu 100 passive Gegenstände tragen; die Slot-Warnungen der App gelten für Perkeo nicht."}
CHARACTER_WEAPON_OVERRIDES = {}
RECOMMENDATIONS = {}
MORPH_RELIC_LEVEL = "Charakter erreicht Level 80"
