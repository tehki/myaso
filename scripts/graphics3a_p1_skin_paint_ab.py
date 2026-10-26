"""Conservative neutral-gray facepaint isolation for P1 private lookdev only.

The approved Quaternius Base Characters Dark atlas intentionally includes
neutral gray paint on the scalp and cheeks. This rule is an experimental
skin-tone replacement test, not an author-approved recoloring or game asset.
"""


NEUTRAL_MIN_RGB_MEAN = 25
NEUTRAL_MAX_RGB_MEAN = 185
NEUTRAL_MAX_CHANNEL_SPAN = 10


def is_neutral_source_paint(rgb) -> bool:
    """Select near-gray atlas pixels within the surveyed source-color range."""
    if len(rgb) != 3:
        raise ValueError("RGB pixel must have three channels")
    channels = tuple(int(v) for v in rgb)
    if any(not isinstance(v, (int,float)) or int(v) != v or not 0 <= v <= 255 for v in rgb):
        raise ValueError("Invalid source RGB sample")
    return (max(channels) - min(channels) <= NEUTRAL_MAX_CHANNEL_SPAN
            and NEUTRAL_MIN_RGB_MEAN <= sum(channels) / 3 <= NEUTRAL_MAX_RGB_MEAN)


def skin_sample_is_valid(rgb) -> bool:
    if len(rgb) != 3:
        raise ValueError("RGB reference must have three channels")
    if any(int(v) != v or not 0 <= v <= 255 for v in rgb):
        raise ValueError("Invalid skin reference")
    return max(rgb) - min(rgb) >= 24


def skin_reference_uv() -> tuple[float, float]:
    """Publisher Dark body atlas sample verified to be skin for both genders."""
    return 0.5, 0.5
