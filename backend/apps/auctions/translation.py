from modeltranslation.translator import translator, TranslationOptions
from .models import Auction


class AuctionTranslationOptions(TranslationOptions):
    fields = ("title", "meta_title", "meta_description", "meta_keywords")


translator.register(Auction, AuctionTranslationOptions)
