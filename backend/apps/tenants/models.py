from django.db import models
from apps.users.models import User
from apps.products.models import Product


class Tenant(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    name = models.CharField(max_length=255)
    products = models.ManyToManyField(Product, blank=True, related_name="tenants")
    owner = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="owned_tenants")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tenants"

    def __str__(self):
        return self.name
