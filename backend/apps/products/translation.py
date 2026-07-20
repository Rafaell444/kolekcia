from modeltranslation.translator import translator, TranslationOptions
from .models import Category, Product


class CategoryTranslationOptions(TranslationOptions):
    fields = ("name", "meta_title", "meta_description", "meta_keywords")


class ProductTranslationOptions(TranslationOptions):
    fields = ("title", "description", "meta_title", "meta_description", "meta_keywords")


translator.register(Category, CategoryTranslationOptions)
translator.register(Product, ProductTranslationOptions)
