from decimal import Decimal
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Tenant
from .serializers import TenantSerializer


def is_tenant_member(user, tenant):
    return user.is_staff or tenant.owner == user


class TenantDetailView(generics.RetrieveAPIView):
    queryset = Tenant.objects.prefetch_related("products__images", "products__artist")
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if not is_tenant_member(request.user, instance):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied
        return super().retrieve(request, *args, **kwargs)


class TenantRevenueView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if not is_tenant_member(request.user, tenant):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied

        from apps.orders.models import OrderItem, Order
        product_ids = list(tenant.products.values_list("id", flat=True))
        items = OrderItem.objects.filter(
            order__status__in=["processing", "shipped", "delivered"]
        ).select_related("order")

        total_revenue = sum(
            item.line_total for item in items
            if item.order.status in ("processing", "shipped", "delivered")
        )

        return Response({"total_revenue": str(total_revenue), "product_count": len(product_ids)})
