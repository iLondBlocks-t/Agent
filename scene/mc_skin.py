"""Minecraft player skin layout (modern 64x64 format).

Every rectangle below is ``(x_px, y_px, width_px, height_px)`` in the skin PNG,
with the origin at the top-left corner, exactly like the file itself.

The 64x64 "wide" (Steve) layout is an unfolded cuboid: for every body part the
image holds the six faces side by side, laid out as::

        [ top ][ bottom ]
    [right][front][left][back]

and a second, larger "overlay" copy of the whole thing (hat / jacket / sleeves /
pants) which is drawn on top of the base layer.
"""

SKIN_SIZE = 64

# --------------------------------------------------------------------------- #
# base layer
# --------------------------------------------------------------------------- #
# part -> face -> rect.  "right"/"left" are the character's own right/left side.
BASE = {
    "head": {
        "top":    (8, 0, 8, 8),
        "bottom": (16, 0, 8, 8),
        "right":  (0, 8, 8, 8),
        "front":  (8, 8, 8, 8),
        "left":   (16, 8, 8, 8),
        "back":   (24, 8, 8, 8),
    },
    "body": {
        "top":    (20, 16, 8, 4),
        "bottom": (28, 16, 8, 4),
        "right":  (16, 20, 4, 12),
        "front":  (20, 20, 8, 12),
        "left":   (28, 20, 4, 12),
        "back":   (32, 20, 8, 12),
    },
    "right_arm": {
        "top":    (44, 16, 4, 4),
        "bottom": (48, 16, 4, 4),
        "right":  (40, 20, 4, 12),
        "front":  (44, 20, 4, 12),
        "left":   (48, 20, 4, 12),
        "back":   (52, 20, 4, 12),
    },
    "right_leg": {
        "top":    (4, 16, 4, 4),
        "bottom": (8, 16, 4, 4),
        "right":  (0, 20, 4, 12),
        "front":  (4, 20, 4, 12),
        "left":   (8, 20, 4, 12),
        "back":   (12, 20, 4, 12),
    },
    "left_arm": {
        "top":    (36, 48, 4, 4),
        "bottom": (40, 48, 4, 4),
        "right":  (32, 52, 4, 12),
        "front":  (36, 52, 4, 12),
        "left":   (40, 52, 4, 12),
        "back":   (44, 52, 4, 12),
    },
    "left_leg": {
        "top":    (20, 48, 4, 4),
        "bottom": (24, 48, 4, 4),
        "right":  (16, 52, 4, 12),
        "front":  (20, 52, 4, 12),
        "left":   (24, 52, 4, 12),
        "back":   (28, 52, 4, 12),
    },
}

# --------------------------------------------------------------------------- #
# overlay (second) layer -- same face layout, offset by +32 in x
# --------------------------------------------------------------------------- #
OVERLAY_ORIGIN = {
    "hat":         (32, 0),
    "jacket":      (16, 32),
    "right_sleeve": (40, 32),
    "left_sleeve": (48, 48),
    "right_pant":  (0, 32),
    "left_pant":   (0, 48),
}

OVERLAY_FOR = {
    "head": "hat",
    "body": "jacket",
    "right_arm": "right_sleeve",
    "left_arm": "left_sleeve",
    "right_leg": "right_pant",
    "left_leg": "left_pant",
}

#: body part -> cuboid size in skin pixels (x = left/right, y = depth, z = height)
PART_SIZE = {
    "head":      (8, 8, 8),
    "body":      (8, 4, 12),
    "right_arm": (4, 4, 12),
    "left_arm":  (4, 4, 12),
    "right_leg": (4, 4, 12),
    "left_leg":  (4, 4, 12),
}

#: body part -> cuboid centre in skin pixels, feet on the ground at z = 0,
#: model centred on the origin, looking towards -Y.
PART_CENTER = {
    "head":      (0, 0, 28),
    "body":      (0, 0, 18),
    "right_arm": (-6, 0, 18),
    "left_arm":  (6, 0, 18),
    "right_leg": (-2, 0, 6),
    "left_leg":  (2, 0, 6),
}

#: bone -> (head_px, tail_px, parent, connected)
BONES = {
    "root":      ((0, 0, 12), (0, 0, 16), None, False),
    "body":      ((0, 0, 12), (0, 0, 24), "root", False),
    "head":      ((0, 0, 24), (0, 0, 32), "body", False),
    "right_arm": ((-6, 0, 23), (-6, 0, 12), "body", False),
    "left_arm":  ((6, 0, 23), (6, 0, 12), "body", False),
    "right_leg": ((-2, 0, 12), (-2, 0, 0), "root", False),
    "left_leg":  ((2, 0, 12), (2, 0, 0), "root", False),
}

#: bone each body part belongs to
PART_BONE = {p: p for p in BASE}


def _base_unwrap_origin(part):
    """Top-left pixel of the part's base unwrap block in the skin PNG."""
    return BASE[part]["right"][0], BASE[part]["top"][1]


def overlay_face_rects(part):
    """Face rects of the part's overlay (second) layer."""
    ox, oy = OVERLAY_ORIGIN[OVERLAY_FOR[part]]
    bx, by = _base_unwrap_origin(part)
    dx, dy = ox - bx, oy - by
    return {face: (r[0] + dx, r[1] + dy, r[2], r[3])
            for face, r in BASE[part].items()}


def face_uv_pattern(face):
    """Corner order (as fractions of the face rect) for the mesh loop winding.

    Fractions are ``(u_frac, v_frac)`` where ``u_frac`` runs left->right and
    ``v_frac`` runs bottom->top of the texture rectangle.
    """
    if face in ("-Y", "+Y", "+X", "-X"):
        return [(0, 0), (1, 0), (1, 1), (0, 1)]
    if face == "+Z":                       # top of the box
        return [(1, 1), (0, 1), (0, 0), (1, 0)]
    return [(1, 0), (1, 1), (0, 1), (0, 0)]  # bottom of the box


#: part / face -> cuboid face name used by the builder
FACE_OF = {
    "top": "+Z", "bottom": "-Z", "right": "-X", "left": "+X",
    "front": "-Y", "back": "+Y",
}
