from modeltranslation.translator import translator, TranslationOptions
from .models import Vendor


class VendorTranslationOptions(TranslationOptions):
    fields = ("name", "description", "meta_title", "meta_description", "meta_keywords")


translator.register(Vendor, VendorTranslationOptions)
