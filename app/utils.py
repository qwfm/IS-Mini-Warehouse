from decimal import Decimal, ROUND_HALF_UP, getcontext

# Set precision for all Decimal operations
getcontext().prec = 28


def to_decimal(value, quant_str=None):
    """
    Convert value to Decimal with optional quantization
    
    Args:
        value: Value to convert (int, float, str, Decimal)
        quant_str: Quantization string (e.g., "0.01" for 2 decimal places)
    
    Returns:
        Decimal: Converted and optionally quantized value
    """
    d = Decimal(str(value))
    if quant_str:
        return d.quantize(Decimal(quant_str), rounding=ROUND_HALF_UP)
    return d