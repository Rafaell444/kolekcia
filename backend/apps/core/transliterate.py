import re
import unicodedata

from django.utils.text import slugify

_GEORGIAN_MAP = {
    "ა": "a", "ბ": "b", "გ": "g", "დ": "d", "ე": "e",
    "ვ": "v", "ზ": "z", "თ": "t", "ი": "i", "კ": "k",
    "ლ": "l", "მ": "m", "ნ": "n", "ო": "o", "პ": "p",
    "ჟ": "zh", "რ": "r", "ს": "s", "ტ": "t", "უ": "u",
    "ფ": "p", "ქ": "k", "ღ": "gh", "ყ": "q", "შ": "sh",
    "ჩ": "ch", "ც": "ts", "ძ": "dz", "წ": "ts", "ჭ": "ch",
    "ხ": "kh", "ჯ": "j", "ჰ": "h",
}

_GEORGIAN_PATTERN = re.compile(r"[\u10A0-\u10FF]")
_CYRILLIC_PATTERN = re.compile(r"[\u0400-\u04FF]")


def _transliterate_georgian(text: str) -> str:
    return "".join(_GEORGIAN_MAP.get(ch, ch) for ch in text)


def _transliterate_russian(text: str) -> str:
    from unidecode import unidecode
    return unidecode(text)


def smart_transliterate(text: str) -> str:
    """Transliterate Georgian/Russian characters to Latin equivalents."""
    if _GEORGIAN_PATTERN.search(text):
        text = _transliterate_georgian(text)
    if _CYRILLIC_PATTERN.search(text):
        text = _transliterate_russian(text)
    return text


def smart_slugify(text: str) -> str:
    """
    Produce a lowercase, Latin-only, URL-safe slug from any script.
    Georgian chars are mapped via a hand-crafted table; Russian/Cyrillic
    chars are handled by unidecode; everything else goes through Django's
    built-in slugify.
    """
    latin = smart_transliterate(text)
    return slugify(latin) or "item"
