from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP


CENT = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(value or 0).quantize(CENT, rounding=ROUND_HALF_UP)


def allocate_amount(target, weights) -> list[Decimal]:
    """Allocate a monetary target proportionally, preserving the exact cent total."""
    normalized = [max(money(weight), Decimal("0")) for weight in weights]
    total_weight = sum(normalized, Decimal("0"))
    target = min(max(money(target), Decimal("0")), total_weight)
    if not normalized or target == 0 or total_weight == 0:
        return [Decimal("0.00") for _ in normalized]

    raw = [(target * weight / total_weight) for weight in normalized]
    allocated = [value.quantize(CENT, rounding=ROUND_DOWN) for value in raw]
    cents_left = int((target - sum(allocated, Decimal("0"))) / CENT)
    remainder_order = sorted(
        range(len(raw)),
        key=lambda index: (raw[index] - allocated[index], normalized[index], -index),
        reverse=True,
    )
    for index in remainder_order[:cents_left]:
        allocated[index] += CENT
    return allocated


def allocate_checkout_discounts(lines, promo, tier_discount, voucher_discount):
    """Return line-level tier and voucher allocations for checkout priced lines."""
    tier_weights = [line["product_subtotal"] if line["is_sale"] else Decimal("0") for line in lines]
    voucher_weights = [
        line["product_subtotal"]
        if not line["is_sale"] and (not promo or promo.applies_to_item(line["product"]))
        else Decimal("0")
        for line in lines
    ]
    tier_allocations = allocate_amount(tier_discount, tier_weights)
    voucher_allocations = allocate_amount(voucher_discount, voucher_weights)
    return [
        {
            "tier_discount": tier_allocations[index],
            "voucher_discount": voucher_allocations[index],
        }
        for index in range(len(lines))
    ]
