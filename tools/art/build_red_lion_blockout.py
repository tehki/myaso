#!/usr/bin/env python3
"""Produce Blender-editable OBJ/MTL geometry for the Red Lion INN A1 blockout.

Authoring source only. Not a textured photorealistic final and not used by live
gameplay. Pure stdlib; no Blender dependency to reproduce its deterministic mesh.
Coordinates use meters, X game-right, Y game-down (front/door at +Y), Z height.

Run: python3 tools/art/build_red_lion_blockout.py
Import generated .obj into Blender to refine the modular 3D-source asset.
"""
from __future__ import annotations

import argparse
from pathlib import Path

MATERIALS = {
    "old_timber": "#71523C",
    "limewash": "#D4C9B2",
    "limestone": "#A39A85",
    "roof_tile": "#884F3F",
    "dark_wood": "#423226",
    "window": "#403C32",
    "iron": "#4C4945",
    "red_lion": "#B45F4A",
}
W, D = 6.25, 4.25  # PR #336 Red Lion 250 x 170 world units at 0.025 m/unit
BASE, EAVE, RIDGE = 0.48, 3.40, 4.86


class Obj:
    def __init__(self) -> None:
        self.vertices: list[tuple[float, float, float]] = []
        self.faces: list[tuple[str, tuple[int, ...], str]] = []
        self.group = "foundation"

    def section(self, name: str) -> None:
        self.group = name

    def poly(self, points: list[tuple[float, float, float]], material: str) -> None:
        assert material in MATERIALS
        assert len(points) >= 3
        indices = []
        for point in points:
            assert len(point) == 3 and all(abs(q) < 100 for q in point)
            self.vertices.append(point)
            indices.append(len(self.vertices))
        self.faces.append((material, tuple(indices), self.group))

    def box(self, x0: float, y0: float, z0: float, x1: float, y1: float, z1: float, mat: str) -> None:
        assert x0 < x1 and y0 < y1 and z0 < z1
        p = [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),
             (x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]
        for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
            self.poly([p[i] for i in f], mat)

    def cylinder(self, cx: float, cy: float, z0: float, z1: float, radius: float,
                 mat: str, sides: int = 12) -> None:
        import math
        circle = [(cx + radius*math.cos(i*2*math.pi/sides),
                   cy + radius*math.sin(i*2*math.pi/sides)) for i in range(sides)]
        self.poly([(x,y,z1) for x,y in circle], mat)
        for i in range(sides):
            x0,y0 = circle[i]
            x1,y1 = circle[(i+1) % sides]
            self.poly([(x0,y0,z0),(x1,y1,z0),(x1,y1,z1),(x0,y0,z1)], mat)

    def out(self, directory: Path) -> tuple[Path, Path]:
        directory.mkdir(parents=True, exist_ok=True)
        obj = directory / "red_lion_blockout.obj"
        mtl = directory / "red_lion_blockout.mtl"
        rows = [
            "# myaso.io Red Lion Inn -- A1 deterministic Blender-ready blockout",
            "# Source: tools/art/build_red_lion_blockout.py (not a release-ready art model)",
            "# 1 OBJ unit = 1 meter; outdoor map XY aligned, +Y points toward front door",
            "mtllib red_lion_blockout.mtl",
        ]
        for x,y,z in self.vertices:
            rows.append(f"v {x:.5f} {y:.5f} {z:.5f}")
        prev_group, prev_mat = None, None
        for mat, face, group in self.faces:
            if group != prev_group:
                rows.append(f"g {group}")
                prev_group = group
            if mat != prev_mat:
                rows.append(f"usemtl {mat}")
                prev_mat = mat
            rows.append("f " + " ".join(str(idx) for idx in face))
        obj.write_text("\n".join(rows)+"\n", encoding="utf8")

        mtlrows = ["# source material IDs; PBR textures and polish come in A2"]
        for mat, hexadecimal in MATERIALS.items():
            rgb = [int(hexadecimal[i:i+2], 16)/255.0 for i in (1,3,5)]
            mtlrows += [
                f"newmtl {mat}",
                f"Kd {rgb[0]:.6f} {rgb[1]:.6f} {rgb[2]:.6f}",
                "Ka 0.000000 0.000000 0.000000",
                "Ks 0.025000 0.025000 0.025000",
                "Ns 7.000",
                "illum 2",
                "",
            ]
        mtl.write_text("\n".join(mtlrows), encoding="utf8")
        return obj, mtl


def build() -> Obj:
    m = Obj()
    x0,x1,y0,y1=-W/2,W/2,-D/2,D/2

    m.section("foundation_stone")
    m.box(x0-.11,y0-.12,0,x1+.11,y1+.12,BASE,"limestone")
    # Irregular but authored (never per-user randomly placed) stone plinth blocks.
    for side in (-1,1):
        yy = side*(D/2 + .125)
        for ix in range(9):
            xx = -W/2 + ix*W/9
            m.box(xx+.04, yy-.048, .13+(ix%2)*.06, xx+W/9-.06, yy+.048,.36,"limestone")

    m.section("limewash_walls")
    m.box(x0+.13,y0+.13,BASE,x1-.13,y1-.13,EAVE,"limewash")

    m.section("timber_frame_posts")
    for xx in (x0+.08,x0+1.66,0,x1-1.66,x1-.08):
        for yy in (y0-.045,y1+.045):
            m.box(xx-.07,yy-.09,BASE,xx+.07,yy+.09,EAVE,"old_timber")
    for yy in (y0+.08,y1-.08):
        for xx in (x0-.055,x1+.055):
            m.box(xx-.09,yy-.09,BASE,xx+.09,yy+.09,EAVE,"old_timber")
    m.section("timber_frame_bands")
    for yy in (y0-.07,y1+.07):
        for zz in (.58,1.53,2.85,EAVE-.15):
            m.box(x0-.12,yy-.075,zz,x1+.12,yy+.075,zz+.14,"old_timber")
    for xx in (x0-.06,x1+.06):
        for zz in (.58,1.53,2.85,EAVE-.15):
            m.box(xx-.08,y0-.13,zz,xx+.08,y1+.13,zz+.14,"old_timber")

    # Sloped roof planes and front/back gables; fit within historical footprints.
    m.section("gables")
    for yy in (y0-.07,y1+.07):
        m.poly([(x0,yy,EAVE),(x1,yy,EAVE),(0,yy,RIDGE)],"limewash")
        for side in (-1,1):
            xx = side*1.44
            m.box(xx-.065,yy-.09,EAVE-.11,xx+.065,yy+.09,EAVE+.55,"old_timber")

    m.section("roof_slopes")
    left_edge,right_edge=x0-.28,x1+.28
    front,back=y1+.39,y0-.39
    # Ridge along the Y direction; tiles slope to X edges. Eaves cast visible
    # silhouettes from the game's top-down visual camera.
    roof_z=EAVE+.10
    m.poly([(left_edge,back,roof_z),(0,back,RIDGE+.14),
            (0,front,RIDGE+.14),(left_edge,front,roof_z)],"roof_tile")
    m.poly([(0,back,RIDGE+.14),(right_edge,back,roof_z),
            (right_edge,front,roof_z),(0,front,RIDGE+.14)],"roof_tile")
    # Slender tile/ridge courses are 3D geometry for the first test import;
    # in A2 these become textured PBR planes/atlas, not thousands of quads.
    m.section("roof_tile_courses")
    for yy in (-1.8,-1.05,-.30,.45,1.20,1.88):
        for side in (-1,1):
            x_at = side*2.4
            z_at = roof_z + (RIDGE+.14-roof_z)*(1-abs(x_at)/(W/2+.28))
            m.box(x_at-.6,yy-.033,z_at-.035,x_at+.6,yy+.033,z_at+.015,"dark_wood")
    m.section("roof_ridge")
    m.box(-.10,back-.03,RIDGE+.09,.10,front+.03,RIDGE+.19,"old_timber")

    m.section("chimney")
    m.box(1.65,-.84,2.85,2.28,-.24,5.12,"limestone")
    m.box(1.52,-.97,5.08,2.42,-.12,5.34,"limestone")
    m.box(1.78,-.71,5.29,2.15,-.38,5.35,"dark_wood")

    # Front facade is +Y; entrance is centered under corresponding map portal.
    m.section("door_front")
    m.box(-.58,y1-.055,.15,.58,y1+.15,2.35,"dark_wood")
    m.box(-.70,y1+.13,.12,-.56,y1+.20,2.50,"old_timber")
    m.box(.56,y1+.13,.12,.70,y1+.20,2.50,"old_timber")
    m.box(-.73,y1+.13,2.36,.73,y1+.21,2.51,"old_timber")
    m.cylinder(.37,y1+.23,1.15,1.19,.045,"iron")
    m.section("entrance_steps")
    m.box(-.74,y1+.15,.02,.74,y1+.60,.22,"limestone")
    m.box(-.90,y1+.55,.01,.90,y1+.83,.12,"limestone")

    m.section("windows_and_shutters")
    for xx in (-1.78,1.78):
        m.box(xx-.38,y1+.13,1.69,xx+.38,y1+.18,2.50,"dark_wood")
        m.box(xx-.27,y1+.18,1.79,xx+.27,y1+.20,2.42,"window")
        m.box(xx-.28,y1+.21,2.08,xx+.28,y1+.24,2.14,"old_timber")
        m.box(xx-.025,y1+.21,1.79,xx+.025,y1+.24,2.43,"old_timber")
        for side in (-1,1):
            xsh=xx+side*.50
            m.box(xsh-.15,y1+.17,1.74,xsh+.15,y1+.27,2.47,"old_timber")

    m.section("red_lion_sign")
    m.box(-.55,y1+.30,2.66,.55,y1+.38,3.10,"dark_wood")
    m.cylinder(0,y1+.44,2.88,2.93,.17,"red_lion")
    for xx in (-.44,.44):
        m.box(xx-.028,y1+.28,3.09,xx+.028,y1+.48,3.15,"iron")

    m.section("tavern_barn_accessories")
    # Barrels (low-poly blockout circles), authored and adjacent to door.
    for bx,by in ((-2.32,y1+.65),(-2.62,y1+.45),(2.43,y1+.53)):
        m.cylinder(bx,by,.05,.83,.29,"old_timber",sides=10)
        m.cylinder(bx,by,.74,.78,.31,"iron",sides=10)
    m.section("lantern_mount")
    m.box(.88,y1+.16,2.12,.96,y1+.44,2.21,"iron")
    m.box(.85,y1+.41,1.83,.99,y1+.58,2.13,"iron")
    return m


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path,
        default=Path(__file__).resolve().parents[2]/"assets/environment/greyhaven")
    args = parser.parse_args()
    mesh = build()
    obj, mtl = mesh.out(args.output_dir)
    print(f"A1 Red Lion editable blockout: {obj} and {mtl}, "
          f"{len(mesh.vertices)} vertices, {len(mesh.faces)} faces")
