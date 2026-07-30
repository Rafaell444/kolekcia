from modeltranslation.translator import translator, TranslationOptions
from .models import Category, Artist, PosterFinish, PosterFrame, PosterSize, Product, SizeVariant


class CategoryTranslationOptions(TranslationOptions):
    fields = ("name", "meta_title", "meta_description", "meta_keywords")


class ProductTranslationOptions(TranslationOptions):
    fields = ("title", "description", "meta_title", "meta_description", "meta_keywords")


class ArtistTranslationOptions(TranslationOptions):
    fields = ("name", "bio")


class OptionTranslationOptions(TranslationOptions):
    fields = ("label",)


translator.register(Category, CategoryTranslationOptions)
translator.register(Product, ProductTranslationOptions)
translator.register(Artist, ArtistTranslationOptions)
translator.register(PosterSize, OptionTranslationOptions)
translator.register(PosterFinish, OptionTranslationOptions)
translator.register(PosterFrame, OptionTranslationOptions)
translator.register(SizeVariant, OptionTranslationOptions)
