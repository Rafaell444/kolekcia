from django.test import TestCase

from apps.products.filters import ProductFilter
from apps.products.models import Category, Product, SizeVariant
from apps.products.serializers import ProductDetailSerializer, SizeVariantSerializer
from apps.users.models import User
from apps.vendors.models import Vendor


class ProductCreationTests(TestCase):
    def test_product_can_be_saved_before_categories_are_assigned(self):
        product = Product.objects.create(title="Fresh product", base_price="25.00")

        self.assertIsNotNone(product.pk)
        self.assertEqual(product.categories.count(), 0)

    def test_serializer_assigns_categories_after_product_gets_an_id(self):
        category = Category.objects.create(name="Wallpanels", slug="wallpanels")
        serializer = ProductDetailSerializer(
            data={
                "title": "Categorized product",
                "base_price": "25.00",
                "category_slug_input": category.slug,
                "categories_input": category.slug,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        product = serializer.save()

        self.assertIsNotNone(product.pk)
        self.assertEqual(product.category_id, category.id)
        self.assertQuerySetEqual(product.categories.all(), [category])

    def test_catalog_can_filter_vendor_products_without_an_artist(self):
        user = User.objects.create_user(email="vendor@example.com", password="test-password")
        vendor = Vendor.objects.create(user=user, name="MangaMoon", slug="mangamoon")
        owned = Product.objects.create(title="Vendor product", base_price="25.00", vendor=vendor)
        Product.objects.create(title="Other product", base_price="30.00")

        products = ProductFilter(
            data={"vendor": vendor.slug},
            queryset=Product.objects.all(),
        ).qs

        self.assertQuerySetEqual(products, [owned])

    def test_size_variant_generates_unique_sku_when_omitted(self):
        product = Product.objects.create(title="Neon Dragon", base_price="25.00")

        first = SizeVariant.objects.create(product=product, label="50 x 70 cm", price_usd="25.00")
        second = SizeVariant.objects.create(product=product, label="50 x 70 cm", price_usd="30.00")

        self.assertEqual(first.sku, "KOL-NEON-DRAGON-50-X-70-CM")
        self.assertEqual(second.sku, "KOL-NEON-DRAGON-50-X-70-CM-2")

    def test_translated_product_and_variant_fields_are_serialized(self):
        product = Product.objects.create(
            title="Poster",
            title_ka="პოსტერი",
            base_price="25.00",
            material="Aluminium",
            material_ka="ალუმინი",
            tags=["anime"],
            tags_ka=["ანიმე"],
            processing_time_label="2 days",
            processing_time_label_ka="2 დღე",
        )
        variant = SizeVariant.objects.create(
            product=product,
            label="Medium",
            label_ka="საშუალო",
            price_usd="25.00",
            stock=12,
        )

        product_data = ProductDetailSerializer(product).data
        variant_data = SizeVariantSerializer(variant).data

        self.assertEqual(product_data["material_ka"], "ალუმინი")
        self.assertEqual(product_data["tags_ka"], ["ანიმე"])
        self.assertEqual(product_data["processing_time_label_ka"], "2 დღე")
        self.assertEqual(variant_data["label_ka"], "საშუალო")
        self.assertEqual(variant_data["stock"], 12)
        self.assertTrue(variant_data["sku"])
