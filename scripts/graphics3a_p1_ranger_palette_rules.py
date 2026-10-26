"""Private Graphics 3A lookdev: reversible, nonproduction Ranger cloth palette.

The source ZIP stays unchanged. This rule operates only on in-memory copies
of the exact approved Quaternius Ranger baseColor, not any game asset.
"""


def is_ranger_green(rgb):
    if not isinstance(rgb,(tuple,list)) or len(rgb)!=3:
        raise ValueError("Expected three Ranger RGB color channels")
    if any(not isinstance(x,int) or isinstance(x,bool) or not 0<=x<=255 for x in rgb):
        raise ValueError("Invalid Ranger source color channel")
    r,g,b=rgb
    return g>=25 and g>r*1.08 and g>b*1.10


def earth_brown_color(rgb):
    """Preserve source variation while shifting *only* green accent to umber.

    Float math intentionally mirrors the optional vectorized private renderer.
    The result is not an author-approved medieval fabric material.
    """
    if not isinstance(rgb,(tuple,list)) or len(rgb)!=3:
        raise ValueError("Expected three Ranger RGB color channels")
    if any(not isinstance(x,int) or isinstance(x,bool) or not 0<=x<=255 for x in rgb):
        raise ValueError("Invalid Ranger source color channel")
    if not is_ranger_green(rgb):
        return tuple(rgb)
    r,g,b=rgb
    return (
        min(255,int(.87*g+.14*r)),
        min(255,int(.54*g+.24*r)),
        min(255,int(.27*g+.17*b)),
    )
