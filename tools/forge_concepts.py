#!/usr/bin/env python3
"""Forge the approved v2 concept boards into runtime atlases.

The source boards remain untouched. Runtime sheets keep the frame labels expected
by the game while normalizing scale and baselines per character family.
"""

from __future__ import annotations

import json
import io
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
CONCEPTS = ROOT / "art" / "concepts"
ASSETS = ROOT / "assets"
TRANSPARENT = (0, 0, 0, 0)


def board(path: str) -> Image.Image:
    return Image.open(CONCEPTS / path).convert("RGBA")


def cell(image: Image.Image, cols: int, rows: int, col: int, row: int) -> Image.Image:
    x0, x1 = round(image.width * col / cols), round(image.width * (col + 1) / cols)
    y0, y1 = round(image.height * row / rows), round(image.height * (row + 1) / rows)
    return image.crop((x0, y0, x1, y1))


def trim(image: Image.Image) -> Image.Image:
    bbox = image.getbbox()
    return image.crop(bbox) if bbox else image


def clear_connected_matte(image: Image.Image, threshold: int = 34) -> Image.Image:
    '''Remove only presentation matte connected to a cell edge, preserving dark interior detail.'''
    result = image.convert('RGBA')
    for seed in ((0, 0), (result.width - 1, 0), (0, result.height - 1),
                 (result.width - 1, result.height - 1)):
        ImageDraw.floodfill(result, seed, TRANSPARENT, thresh=threshold)
    return result


def fit(image: Image.Image, width: int, height: int, pad: int = 1, baseline: bool = True) -> Image.Image:
    image = trim(image)
    max_w, max_h = max(1, width - pad * 2), max(1, height - pad * 2)
    scale = min(max_w / image.width, max_h / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    image = image.resize(size, Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (width, height), TRANSPARENT)
    x = (width - size[0]) // 2
    y = height - pad - size[1] if baseline else (height - size[1]) // 2
    result.alpha_composite(image, (x, y))
    return result


def grid(path: str, cols: int, rows: int, coords: list[tuple[int, int]]) -> list[Image.Image]:
    image = board(path)
    return [cell(image, cols, rows, col, row) for col, row in coords]


def atlas(name: str, labels: list[str], frames: list[Image.Image], size: tuple[int, int],
          manifest: dict, *, draw: tuple[int, int] | None = None) -> None:
    width, height = size
    normalized = [fit(frame, width, height) for frame in frames]
    sheet = Image.new("RGBA", (width * len(normalized), height), TRANSPARENT)
    for index, frame in enumerate(normalized):
        sheet.alpha_composite(frame, (index * width, 0))
    sheet.save(ASSETS / f"{name}.png")
    entry = {"frame_w": width, "frame_h": height, "frames": labels, "file": f"assets/{name}.png"}
    if draw:
        entry["draw_w"], entry["draw_h"] = draw
    manifest[name] = entry


def raw_atlas(name: str, labels: list[str], frames: list[Image.Image], size: tuple[int, int], manifest: dict) -> None:
    width, height = size
    sheet = Image.new("RGBA", (width * len(frames), height), TRANSPARENT)
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame.resize((width, height), Image.Resampling.LANCZOS), (index * width, 0))
    sheet.save(ASSETS / f"{name}.png")
    manifest[name] = {"frame_w": width, "frame_h": height, "frames": labels, "file": f"assets/{name}.png"}


def registered_atlas(name: str, labels: list[str], frames: list[Image.Image], size: tuple[int, int],
                     manifest: dict, pad: int = 1, baseline: bool = True) -> None:
    '''Preserve relative subject scale while registering every frame to one baseline.'''
    width, height = size
    trimmed = [trim(frame) for frame in frames]
    max_w = max(frame.width for frame in trimmed)
    max_h = max(frame.height for frame in trimmed)
    scale = min((width - pad * 2) / max_w, (height - pad * 2) / max_h)
    sheet = Image.new('RGBA', (width * len(trimmed), height), TRANSPARENT)
    for index, frame in enumerate(trimmed):
        resized = frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))), Image.Resampling.LANCZOS)
        x = index * width + (width - resized.width) // 2
        y = height - pad - resized.height if baseline else (height - resized.height) // 2
        sheet.alpha_composite(resized, (x, y))
    sheet.save(ASSETS / f'{name}.png')
    manifest[name] = {'frame_w': width, 'frame_h': height, 'frames': labels, 'file': f'assets/{name}.png'}


def make_parallax(source: Image.Image, cols: int, col: int) -> Image.Image:
    far = trim(cell(source, cols, 3, col, 1))
    mid = trim(cell(source, cols, 3, col, 2))
    out = Image.new("RGBA", (192, 110), TRANSPARENT)
    for layer, target_h, y in ((far, 52, 18), (mid, 64, 46)):
        scale = min(192 / layer.width, target_h / layer.height)
        resized = layer.resize((max(1, round(layer.width * scale)), max(1, round(layer.height * scale))), Image.Resampling.LANCZOS)
        x = (192 - resized.width) // 2
        out.alpha_composite(resized, (x, min(110 - resized.height, y)))
    return out


def environment_pair(name: str, source_path: str, cols: int, col: int, manifest: dict) -> None:
    source = board(source_path)
    sky = trim(cell(source, cols, 3, col, 0)).resize((384, 240), Image.Resampling.LANCZOS)
    sky.save(ASSETS / f"sky_{name}.png")
    manifest[f"sky_{name}"] = {"frame_w": 384, "frame_h": 240, "frames": ["g"], "file": f"assets/sky_{name}.png"}
    par = make_parallax(source, cols, col)
    par.save(ASSETS / f"par_{name}.png")
    manifest[f"par_{name}"] = {"frame_w": 192, "frame_h": 110, "frames": ["s"], "file": f"assets/par_{name}.png"}


def main() -> None:
    manifest_path = ASSETS / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    forms = "characters/playable_forms.png"
    atlas("mermaid", ["idle", "swim1", "swim2"], grid(forms, 4, 4, [(0, 0), (0, 1), (0, 2)]), (40, 40), manifest)
    atlas("charmgirl", ["idle", "walk1", "walk2", "jump"], grid(forms, 4, 4, [(1, 0), (1, 1), (1, 2), (1, 3)]), (30, 28), manifest)
    atlas("trex", ["walk1", "walk2", "roar"], grid(forms, 4, 4, [(2, 0), (2, 1), (2, 3)]), (52, 48), manifest)
    atlas("mecha", ["idle", "walk1", "walk2", "fly1", "fly2"], grid(forms, 4, 4, [(3, 0), (3, 1), (3, 2), (3, 1), (3, 3)]), (64, 60), manifest)

    world1 = "enemies/world1_roster.png"
    atlas("frog", ["idle", "crouch", "hop"], grid(world1, 4, 3, [(0, 0), (0, 1), (0, 2)]), (26, 22), manifest)
    atlas("cockroach", ["scuttle1", "scuttle2"], grid(world1, 4, 3, [(1, 0), (1, 1)]), (30, 16), manifest)
    atlas("dino", ["walk1", "walk2"], grid(world1, 4, 3, [(2, 0), (2, 1)]), (32, 30), manifest)
    atlas("boss_grumpis", ["idle", "attack", "hurt"], grid(world1, 4, 3, [(3, 0), (3, 1), (3, 2)]), (64, 64), manifest)

    water = "enemies/water_roster.png"
    atlas("alligator", ["catface", "reveal", "chomp"], grid(water, 3, 3, [(0, 0), (0, 1), (0, 2)]), (48, 26), manifest)
    atlas("fish", ["swim1", "swim2"], grid(water, 3, 3, [(1, 0), (1, 1)]), (14, 10), manifest)
    atlas("wisp", ["bob1", "bob2"], grid(water, 3, 3, [(2, 0), (2, 1)]), (18, 18), manifest)
    air = "enemies/air_roster.png"
    atlas("fly", ["buzz1", "buzz2"], grid(air, 2, 3, [(0, 0), (0, 1)]), (22, 16), manifest)
    atlas("fly_dino", ["buzz1", "buzz2"], grid(air, 2, 3, [(1, 0), (1, 1)]), (30, 24), manifest)

    family = "characters/swans_and_turtles.png"
    atlas("babyswan", ["bob1", "bob2"], grid(family, 3, 3, [(0, 0), (0, 1)]), (18, 16), manifest)
    atlas("turtles", ["calm1", "calm2"], grid(family, 3, 3, [(2, 0), (2, 1)]), (96, 40), manifest)
    bosses = "bosses/grumpis_family.png"
    atlas("boss_papa", ["idle", "attack", "hurt"], grid(bosses, 3, 3, [(2, 0), (2, 1), (2, 2)]), (96, 80), manifest)
    hog = "bosses/hogdog.png"
    atlas("boss_hogdog", ["idle", "attack", "hurt"], grid(hog, 3, 3, [(0, 0), (2, 0), (1, 1)]), (96, 88), manifest)

    bad = "enemies/bad_dreams.png"
    atlas("boss_badcode", ["idle", "attack", "hurt", "sphere", "sweep", "dissolve"],
          grid(bad, 3, 3, [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 2)]), (96, 96), manifest)
    giant = "bosses/giant_progression.png"
    atlas("boss_giant", ["idle", "step", "kneel"], grid(giant, 3, 3, [(0, 0), (0, 1), (0, 2)]), (128, 144), manifest)
    atlas("boss_colossus", ["windup", "slam", "hurt"], grid(giant, 3, 3, [(1, 0), (1, 1), (1, 2)]), (96, 128), manifest)
    atlas("boss_bigguy", ["idle", "dip", "hurt"], grid(giant, 3, 3, [(2, 0), (2, 1), (2, 2)]), (144, 144), manifest)
    atlas("finale_pair", ["hover", "laser", "shield", "track", "hit", "stagger", "orbit", "dodge", "peace"],
          grid("bosses/finale_showdown.png", 3, 3, [(c, r) for r in range(3) for c in range(3)]), (128, 128), manifest)
    atlas("nice_npcs", [f"npc{i}" for i in range(1, 7)],
          grid("characters/nice_place_npcs.png", 3, 2, [(c, r) for r in range(2) for c in range(3)]), (64, 64), manifest)

    equip = board("items-ui/equipment.png")
    # The approved Spoon source is an equipped pose, not a detachable overlay.
    # Retain the prior clean overlay geometry so stacked costumes do not draw a
    # second Swan body; all other equipment comes directly from the new board.
    legacy_gear = Image.open(io.BytesIO(subprocess.check_output(
        ["git", "show", "HEAD:assets/gear.png"], cwd=ROOT))).convert("RGBA")
    legacy_spoon_up = legacy_gear.crop((56, 0, 84, 28))
    legacy_spoon_down = legacy_gear.crop((84, 0, 112, 28))
    atlas("gear", ["goosefeet", "visor", "spoon_up", "spoon_down", "kirbycap"],
          [cell(equip, 3, 3, 0, 0), cell(equip, 3, 3, 0, 1), legacy_spoon_up, legacy_spoon_down, cell(equip, 3, 3, 0, 2)], (28, 28), manifest)

    combat = board("effects/combat_fx.png")
    movement = board("effects/movement_fx.png")
    fx_coords = [
        (combat, 4, 5, 0, 0), (combat, 4, 5, 1, 0), (combat, 4, 5, 2, 0),
        (combat, 4, 5, 0, 1), (combat, 4, 5, 2, 1), (combat, 4, 5, 2, 2),
        (combat, 4, 5, 3, 2), (combat, 4, 5, 0, 2), (combat, 4, 5, 1, 2),
        (movement, 4, 4, 0, 0), (movement, 4, 4, 1, 0), (movement, 4, 4, 2, 0),
        (movement, 4, 4, 3, 0), (movement, 4, 4, 0, 1), (movement, 4, 4, 2, 1),
        (movement, 4, 4, 3, 1), (movement, 4, 4, 0, 2), (movement, 4, 4, 2, 2),
    ]
    atlas("fx", ["fireball1", "fireball2", "nut", "mushroom", "stink", "ring1", "ring2", "beam", "beamtip", "splash1", "splash2", "spark1", "spark2", "feather", "poof1", "poof2", "bubble", "moonspark"],
          [cell(*args) for args in fx_coords], (16, 16), manifest)

    pickups = board("items-ui/powers_and_pickups.png")
    items = [cell(pickups, 4, 4, 0, 0), cell(pickups, 4, 4, 1, 0), cell(combat, 4, 5, 0, 0),
             cell(pickups, 4, 4, 0, 2), cell(combat, 4, 5, 2, 0), cell(equip, 3, 3, 0, 2),
             cell(pickups, 4, 4, 2, 2), cell(equip, 3, 3, 0, 0), cell(equip, 3, 3, 0, 1),
             cell(equip, 3, 3, 2, 1), cell(pickups, 4, 4, 3, 3), cell(pickups, 4, 4, 1, 0),
             cell(pickups, 4, 4, 2, 0), cell(pickups, 4, 4, 0, 2), cell(pickups, 4, 4, 1, 2),
             cell(pickups, 4, 4, 2, 2), cell(pickups, 4, 4, 3, 2), cell(pickups, 4, 4, 0, 3),
             cell(pickups, 4, 4, 1, 3), cell(pickups, 4, 4, 2, 3)]
    atlas("items", ["moon", "beads", "icon_fire", "icon_pink", "icon_tree", "icon_kirby", "pickup_mermaid", "pickup_goosefeet", "pickup_laser", "pickup_spoon", "baby_icon", "charm_icon", "phone",
                    "bubble", "sticky", "shell", "egg", "mace", "heart", "happiness"], items, (16, 16), manifest)

    hud = board("items-ui/hud.png")
    hud_frames = [cell(hud, 4, 4, 0, 0), cell(hud, 4, 4, 2, 0), cell(hud, 4, 4, 0, 1), cell(hud, 4, 4, 3, 1),
                  cell(pickups, 4, 4, 1, 1), cell(pickups, 4, 4, 3, 0), cell(pickups, 4, 4, 0, 1), cell(hud, 4, 4, 3, 3),
                  cell(hud, 4, 4, 0, 3), cell(hud, 4, 4, 1, 3), cell(hud, 4, 4, 2, 3), cell(hud, 4, 4, 3, 3)]
    atlas("hud", ["heart_full", "heart_empty", "happy_smiley", "happy_seg", "popcorn", "star", "treat", "trophy",
                  "boss_frame", "boss_fill", "ability_slot", "checkpoint"], hud_frames, (16, 16), manifest)

    lake = board("environments/lake_tiles.png")
    tile_frames = [cell(lake, 4, 4, *coord) for coord in [(0, 0), (3, 0), (1, 0), (2, 0), (2, 1), (0, 2), (2, 2), (0, 3)]]
    raw_atlas("tiles", ["grass_top", "dirt", "edge_left", "edge_right", "platform", "lilypad", "cattail", "lantern"], [fit(f, 16, 16, 0) for f in tile_frames], (16, 16), manifest)

    deep, candy, night = board("environments/water_deep_tiles.png"), board("environments/candy_cloud_tiles.png"), board("environments/night_rescue_tiles.png")
    tile2_specs = [
        (deep,0,0),(deep,1,0),(deep,3,0),(deep,0,1),(deep,3,1),(deep,0,2),(deep,2,2),(deep,1,2),(deep,0,3),(deep,1,3),
        (candy,0,1),(candy,0,0),(candy,2,1),(candy,3,0),(candy,1,1),(candy,0,2),(candy,1,2),
        (night,0,0),(night,3,0),(night,0,2),(night,1,2),(night,0,1),(night,3,1),(candy,2,2),(lake,1,3),(lake,3,2),(candy,1,3),
    ]
    tile2_labels = ["water_surf1","water_surf2","water_deep","rock_top","rock_fill","seaweed1","seaweed2","coral","chest_closed","chest_open","cloud_top","cloud_fill","candy_top","candy_fill","gumdrop","spring1","spring2","night_grass","night_dirt","fire1","fire2","tree_trunk","tree_leaves","mush_block","fence","flower","sign"]
    raw_atlas("tiles2", tile2_labels, [fit(cell(img,4,4,c,r),16,16,0) for img,c,r in tile2_specs], (16,16), manifest)

    hub = board("environments/hub_house_tiles.png")
    hub_labels = ["wall","paper","floor","window","door","bed_l","bed_r","shelf","lamp","plant","shaft","roof_l","roof_r"]
    bed = cell(hub,4,4,0,2); roof = cell(hub,4,4,3,0)
    hub_frames = [cell(hub,4,4,0,0),cell(hub,4,4,2,0),cell(hub,4,4,1,0),cell(hub,4,4,2,1),cell(hub,4,4,0,1),
                  bed.crop((0,0,bed.width//2,bed.height)),bed.crop((bed.width//2,0,bed.width,bed.height)),cell(hub,4,4,3,2),cell(hub,4,4,1,2),cell(hub,4,4,2,2),cell(hub,4,4,1,3),
                  roof.crop((0,0,roof.width//2,roof.height)),roof.crop((roof.width//2,0,roof.width,roof.height))]
    raw_atlas("hub", hub_labels, [fit(f,16,16,0) for f in hub_frames], (16,16), manifest)
    atlas("elevator", ["closed","open"], [cell(hub,4,4,0,1),cell(hub,4,4,0,3)], (24,32), manifest)

    panels = "items-ui/ui_panels.png"
    raw_atlas("ui_panels", ["title","story","pause","chooser","store","clear","credits","dialogue","confirm"],
              [trim(f) for f in grid(panels,3,3,[(c,r) for r in range(3) for c in range(3)])], (128,96), manifest)
    raw_atlas("overworld_art", ["map","routes","nodes","boat_idle","boat_move","dock","trophy_exterior","trophy_interior","ornaments"],
              [trim(f) for f in grid("environments/overworld.png",3,3,[(c,r) for r in range(3) for c in range(3)])], (384,240), manifest)

    environment_pair("lake", "environments/world_backdrops_1.png", 3, 0, manifest)
    environment_pair("night", "environments/world_backdrops_1.png", 3, 1, manifest)
    environment_pair("under", "environments/world_backdrops_1.png", 3, 2, manifest)
    environment_pair("candy", "environments/world_backdrops_2.png", 3, 0, manifest)
    environment_pair("fever", "environments/world_backdrops_2.png", 3, 1, manifest)
    environment_pair("hub", "environments/world_backdrops_2.png", 3, 2, manifest)
    environment_pair("finale", "environments/world_backdrops_3.png", 4, 0, manifest)
    environment_pair("ascent", "environments/world_backdrops_3.png", 4, 1, manifest)
    environment_pair("fall", "environments/world_backdrops_3.png", 4, 2, manifest)
    environment_pair("cove", "environments/world_backdrops_3.png", 4, 3, manifest)
    environment_pair("nice", "environments/world_backdrops_4.png", 3, 0, manifest)
    environment_pair("longup", "environments/world_backdrops_4.png", 3, 1, manifest)
    environment_pair("dream", "environments/world_backdrops_4.png", 3, 2, manifest)

    # Production sheets supersede concept-board slices once they have passed
    # registration and in-game validation.
    production_frog = ROOT / 'art' / 'production' / 'frog_jump_source.png'
    if production_frog.exists():
        frog_source = Image.open(production_frog).convert('RGBA')
        registered_atlas('frog', ['idle', 'anticipation', 'crouch', 'launch', 'airborne', 'landing'],
                         [cell(frog_source, 6, 1, col, 0) for col in range(6)], (32, 28), manifest)

    production_roach = ROOT / 'art' / 'production' / 'cockroach_source.png'
    if production_roach.exists():
        roach_source = Image.open(production_roach).convert('RGBA')
        registered_atlas('cockroach', ['scuttle1', 'scuttle2', 'scuttle3', 'scuttle4', 'hurt', 'defeated'],
                         [cell(roach_source, 6, 1, col, 0) for col in range(6)], (36, 20), manifest)

    production_dino = ROOT / 'art' / 'production' / 'dino_source.png'
    if production_dino.exists():
        dino_source = Image.open(production_dino).convert('RGBA')
        registered_atlas('dino', ['idle', 'walk1', 'walk2', 'walk3', 'attack', 'hurt'],
                         [cell(dino_source, 6, 1, col, 0) for col in range(6)], (40, 36), manifest)

    production_gator = ROOT / 'art' / 'production' / 'alligator_source.png'
    if production_gator.exists():
        gator_source = Image.open(production_gator).convert('RGBA')
        registered_atlas('alligator', ['catface', 'reveal', 'revealed', 'swim', 'chomp', 'hurt'],
                         [cell(gator_source, 6, 1, col, 0) for col in range(6)], (56, 32), manifest)

    production_fish = ROOT / 'art' / 'production' / 'fish_source.png'
    if production_fish.exists():
        fish_source = Image.open(production_fish).convert('RGBA')
        registered_atlas('fish', ['swim1', 'swim2', 'swim3', 'turn', 'dart', 'hurt'],
                         [cell(fish_source, 6, 1, col, 0) for col in range(6)], (20, 14), manifest)

    production_wisp = ROOT / 'art' / 'production' / 'wisp_source.png'
    if production_wisp.exists():
        wisp_source = Image.open(production_wisp).convert('RGBA')
        registered_atlas('wisp', ['bob1', 'bob2', 'bob3', 'alert', 'attack', 'hurt'],
                         [cell(wisp_source, 6, 1, col, 0) for col in range(6)], (24, 24), manifest)

    production_fly = ROOT / 'art' / 'production' / 'fly_source.png'
    if production_fly.exists():
        fly_source = Image.open(production_fly).convert('RGBA')
        registered_atlas('fly', ['buzz1', 'buzz2', 'buzz3', 'buzz4', 'dart', 'hurt'],
                         [cell(fly_source, 6, 1, col, 0) for col in range(6)], (28, 22), manifest)

    production_fly_dino = ROOT / 'art' / 'production' / 'fly_dino_source.png'
    if production_fly_dino.exists():
        fly_dino_source = Image.open(production_fly_dino).convert('RGBA')
        registered_atlas('fly_dino', ['buzz1', 'buzz2', 'buzz3', 'buzz4', 'dart', 'hurt'],
                         [cell(fly_dino_source, 6, 1, col, 0) for col in range(6)], (36, 30), manifest)

    production_mermaid = ROOT / 'art' / 'production' / 'mermaid_source.png'
    if production_mermaid.exists():
        mermaid_source = Image.open(production_mermaid).convert('RGBA')
        registered_atlas('mermaid', ['idle', 'swim1', 'swim2', 'swim3', 'upturn', 'hurt'],
                         [cell(mermaid_source, 6, 1, col, 0) for col in range(6)], (48, 44), manifest,
                         baseline=False)
        manifest['mermaid'].update({'anchor': [24, 30], 'attachments': {'head': [37, 9], 'feet': [24, 30], 'hand': [39, 20]}})

    production_charm = ROOT / 'art' / 'production' / 'charmgirl_source.png'
    if production_charm.exists():
        charm_source = Image.open(production_charm).convert('RGBA')
        registered_atlas('charmgirl', ['idle', 'walk1', 'walk2', 'walk3', 'jump', 'hurt'],
                         [cell(charm_source, 6, 1, col, 0) for col in range(6)], (36, 34), manifest)
        manifest['charmgirl'].update({'anchor': [18, 33], 'attachments': {'head': [22, 8], 'feet': [18, 33], 'hand': [28, 20]}})

    production_trex = ROOT / 'art' / 'production' / 'trex_source.png'
    if production_trex.exists():
        trex_source = Image.open(production_trex).convert('RGBA')
        registered_atlas('trex', ['idle', 'walk1', 'walk2', 'walk3', 'roar', 'hurt'],
                         [cell(trex_source, 6, 1, col, 0) for col in range(6)], (60, 54), manifest)
        manifest['trex'].update({'anchor': [30, 53], 'attachments': {'head': [42, 13], 'feet': [30, 53], 'hand': [46, 31]}})

    production_mecha = ROOT / 'art' / 'production' / 'mecha_source.png'
    if production_mecha.exists():
        mecha_source = Image.open(production_mecha).convert('RGBA')
        registered_atlas('mecha', ['idle', 'walk1', 'walk2', 'fly1', 'fly2', 'hurt'],
                         [cell(mecha_source, 6, 1, col, 0) for col in range(6)], (76, 70), manifest)
        manifest['mecha'].update({'anchor': [38, 69], 'attachments': {'head': [52, 15], 'feet': [38, 69]}})

    production_baby = ROOT / 'art' / 'production' / 'babyswan_source.png'
    if production_baby.exists():
        baby_source = Image.open(production_baby).convert('RGBA')
        registered_atlas('babyswan', ['bob1', 'bob2', 'bob3', 'flap', 'carried', 'cheer'],
                         [cell(baby_source, 6, 1, col, 0) for col in range(6)], (22, 20), manifest,
                         baseline=False)

    production_turtles = ROOT / 'art' / 'production' / 'turtles_source.png'
    if production_turtles.exists():
        turtle_source = Image.open(production_turtles).convert('RGBA')
        registered_atlas('turtles', ['calm1', 'calm2', 'wiggle', 'smile', 'cheer', 'cuddle'],
                         [cell(turtle_source, 6, 1, col, 0) for col in range(6)], (112, 52), manifest)

    production_grumpis = ROOT / 'art' / 'production' / 'grumpis_source.png'
    production_papa = ROOT / 'art' / 'production' / 'papa_grumpis_source.png'
    production_hogdog = ROOT / 'art' / 'production' / 'hogdog_source.png'
    production_giant = ROOT / 'art' / 'production' / 'giant_legs_source.png'
    production_bad_dreams = ROOT / 'art' / 'production' / 'bad_dreams_source.png'
    production_nice_npcs = ROOT / 'art' / 'production' / 'nice_npcs_source.png'
    production_effects = ROOT / 'art' / 'production' / 'effects_source.png'
    production_items = ROOT / 'art' / 'production' / 'items_source.png'
    if production_items.exists():
        items_source = Image.open(production_items).convert('RGBA')
        production_item_labels = ['moon', 'beads', 'icon_fire', 'icon_pink', 'icon_tree',
                                  'icon_kirby', 'pickup_mermaid', 'pickup_goosefeet',
                                  'pickup_laser', 'pickup_spoon', 'baby_icon', 'charm_icon',
                                  'phone', 'bubble', 'sticky', 'shell', 'egg', 'mace',
                                  'heart', 'happiness']
        registered_atlas('items', production_item_labels,
                         [cell(items_source, 5, 4, index % 5, index // 5)
                          for index in range(len(production_item_labels))],
                         (16, 16), manifest, baseline=False)

    if production_effects.exists():
        effects_source = Image.open(production_effects).convert('RGBA')
        effects_labels = ['fireball1', 'fireball2', 'nut', 'mushroom', 'stink', 'ring1',
                          'ring2', 'beam', 'beamtip', 'splash1', 'splash2', 'spark1',
                          'spark2', 'feather', 'poof1', 'poof2', 'bubble', 'moonspark']
        registered_atlas('fx', effects_labels,
                         [cell(effects_source, 6, 3, index % 6, index // 6)
                          for index in range(len(effects_labels))],
                         (16, 16), manifest, baseline=False)

    if production_nice_npcs.exists():
        nice_npcs_source = Image.open(production_nice_npcs).convert('RGBA')
        registered_atlas('nice_npcs', [f'npc{i}' for i in range(1, 7)],
                         [cell(nice_npcs_source, 6, 1, col, 0) for col in range(6)],
                         (64, 64), manifest)

    if production_bad_dreams.exists():
        bad_dreams_source = Image.open(production_bad_dreams).convert('RGBA')
        registered_atlas('boss_badcode', ['idle', 'attack', 'hurt', 'sphere', 'sweep', 'dissolve'],
                         [cell(bad_dreams_source, 6, 1, col, 0) for col in range(6)],
                         (96, 96), manifest, baseline=False)

    if production_giant.exists():
        giant_source = Image.open(production_giant).convert('RGBA')
        registered_atlas('boss_giant', ['idle', 'step', 'kneel'],
                         [cell(giant_source, 3, 1, col, 0) for col in range(3)],
                         (128, 144), manifest)

    production_colossus = ROOT / 'art' / 'production' / 'colossus_foot_source.png'
    if production_colossus.exists():
        colossus_source = Image.open(production_colossus).convert('RGBA')
        registered_atlas('boss_colossus', ['windup', 'slam', 'hurt'],
                         [cell(colossus_source, 3, 1, col, 0) for col in range(3)],
                         (96, 128), manifest)

    production_bigguy = ROOT / 'art' / 'production' / 'bigguy_face_source.png'
    if production_bigguy.exists():
        bigguy_source = Image.open(production_bigguy).convert('RGBA')
        registered_atlas('boss_bigguy', ['idle', 'dip', 'hurt'],
                         [cell(bigguy_source, 3, 1, col, 0) for col in range(3)],
                         (144, 144), manifest)

    if production_hogdog.exists():
        hogdog_source = Image.open(production_hogdog).convert('RGBA')
        registered_atlas('boss_hogdog',
                         ['idle', 'attack', 'grab', 'retreat', 'hurt', 'defeated'],
                         [cell(hogdog_source, 6, 1, col, 0) for col in range(6)],
                         (96, 88), manifest)

    if production_papa.exists():
        papa_source = Image.open(production_papa).convert('RGBA')
        registered_atlas('boss_papa',
                         ['idle', 'anticipation', 'attack', 'recovery', 'hurt', 'defeated'],
                         [cell(papa_source, 6, 1, col, 0) for col in range(6)],
                         (96, 80), manifest)

    production_gear = ROOT / 'art' / 'production' / 'gear_source.png'
    if production_gear.exists():
        gear_source = Image.open(production_gear).convert('RGBA')
        registered_atlas('gear', ['goosefeet', 'visor', 'kirbycap', 'spoon_up', 'spoon_down'],
                         [cell(gear_source, 5, 1, col, 0) for col in range(5)],
                         (28, 28), manifest, baseline=False)

    if production_grumpis.exists():
        grumpis_source = Image.open(production_grumpis).convert('RGBA')
        registered_atlas('boss_grumpis', ['idle', 'anticipation', 'attack', 'recover', 'hurt', 'defeated'],
                         [cell(grumpis_source, 6, 1, col, 0) for col in range(6)], (72, 64), manifest)

    production_lake = ROOT / 'art' / 'production' / 'dream_lake_background.png'
    if production_lake.exists():
        lake_image = Image.open(production_lake).convert('RGBA').resize((384, 240), Image.Resampling.LANCZOS)
        lake_image.save(ASSETS / 'sky_lake.png')
        manifest['sky_lake'] = {'frame_w': 384, 'frame_h': 240, 'frames': ['g'], 'file': 'assets/sky_lake.png'}
        Image.new('RGBA', (192, 110), TRANSPARENT).save(ASSETS / 'par_lake.png')
        manifest['par_lake'] = {'frame_w': 192, 'frame_h': 110, 'frames': ['s'], 'file': 'assets/par_lake.png'}

    production_terrain = ROOT / 'art' / 'production' / 'dream_lake_terrain.png'
    production_world_tiles = ROOT / 'art' / 'production' / 'world_tiles_source.png'
    production_home_tiles = ROOT / 'art' / 'production' / 'home_tiles_source.png'
    if production_home_tiles.exists():
        home_tiles = Image.open(production_home_tiles).convert('RGBA')
        home_prop_cells = {3, 4, 5, 6, 7, 8, 9, 11, 12}
        home_frames = []
        for index in range(len(hub_labels)):
            tile = cell(home_tiles, 4, 4, index % 4, index // 4)
            tile = tile.crop((2, 2, tile.width - 2, tile.height - 2))
            if index in home_prop_cells:
                tile = clear_connected_matte(tile)
            home_frames.append(tile.resize((16, 16), Image.Resampling.LANCZOS))
        raw_atlas('hub', hub_labels, home_frames, (16, 16), manifest)

    if production_world_tiles.exists():
        world_tiles = Image.open(production_world_tiles).convert('RGBA')
        prop_cells = {5, 6, 7, 8, 9, 14, 15, 16, 19, 20, 24, 25, 26}
        tile_frames = []
        for index in range(len(tile2_labels)):
            tile = cell(world_tiles, 6, 5, index % 6, index // 6)
            tile = tile.crop((2, 2, tile.width - 2, tile.height - 2))
            if index in (0, 1):
                tile = tile.crop((0, round(tile.height * .38), tile.width, tile.height))
            if index in prop_cells:
                tile = clear_connected_matte(tile)
                tile_frames.append(fit(tile, 16, 16, 0, baseline=index not in {5, 6, 7}))
            else:
                tile_frames.append(tile.resize((16, 16), Image.Resampling.LANCZOS))
        raw_atlas('tiles2', tile2_labels, tile_frames, (16, 16), manifest)

    production_candy = ROOT / 'art' / 'production' / 'candy_clouds_background.png'
    production_fever = ROOT / 'art' / 'production' / 'fever_swarm_background.png'
    late_backgrounds = {
        'ascent': ROOT / 'art' / 'production' / 'broken_ascent_background.png',
        'fall': ROOT / 'art' / 'production' / 'long_fall_background.png',
        'cove': ROOT / 'art' / 'production' / 'secret_cove_background.png',
        'nice': ROOT / 'art' / 'production' / 'nice_place_background.png',
        'longup': ROOT / 'art' / 'production' / 'long_way_up_background.png',
        'dream': ROOT / 'art' / 'production' / 'biggest_dream_background.png',
    }
    for scene_name, scene_path in late_backgrounds.items():
        if not scene_path.exists():
            continue
        scene_image = Image.open(scene_path).convert('RGBA').resize((384, 240), Image.Resampling.LANCZOS)
        scene_image.save(ASSETS / f'sky_{scene_name}.png')
        manifest[f'sky_{scene_name}'] = {
            'frame_w': 384, 'frame_h': 240, 'frames': ['g'], 'file': f'assets/sky_{scene_name}.png'
        }
        Image.new('RGBA', (192, 110), TRANSPARENT).save(ASSETS / f'par_{scene_name}.png')
        manifest[f'par_{scene_name}'] = {
            'frame_w': 192, 'frame_h': 110, 'frames': ['s'], 'file': f'assets/par_{scene_name}.png'
        }

    if production_fever.exists():
        fever_image = Image.open(production_fever).convert('RGBA').resize((384, 240), Image.Resampling.LANCZOS)
        fever_image.save(ASSETS / 'sky_fever.png')
        manifest['sky_fever'] = {'frame_w': 384, 'frame_h': 240, 'frames': ['g'], 'file': 'assets/sky_fever.png'}
        Image.new('RGBA', (192, 110), TRANSPARENT).save(ASSETS / 'par_fever.png')
        manifest['par_fever'] = {'frame_w': 192, 'frame_h': 110, 'frames': ['s'], 'file': 'assets/par_fever.png'}

    production_finale = ROOT / 'art' / 'production' / 'moonflex_finale_background.png'
    if production_finale.exists():
        finale_image = Image.open(production_finale).convert('RGBA').resize((384, 240), Image.Resampling.LANCZOS)
        finale_image.save(ASSETS / 'sky_finale.png')
        manifest['sky_finale'] = {'frame_w': 384, 'frame_h': 240, 'frames': ['g'], 'file': 'assets/sky_finale.png'}
        Image.new('RGBA', (192, 110), TRANSPARENT).save(ASSETS / 'par_finale.png')
        manifest['par_finale'] = {'frame_w': 192, 'frame_h': 110, 'frames': ['s'], 'file': 'assets/par_finale.png'}

    early_backgrounds = {
        'night': ROOT / 'art' / 'production' / 'moonlight_lake_background.png',
        'under': ROOT / 'art' / 'production' / 'the_deep_background.png',
    }
    for scene_name, scene_path in early_backgrounds.items():
        if not scene_path.exists():
            continue
        scene_image = Image.open(scene_path).convert('RGBA').resize((384, 240), Image.Resampling.LANCZOS)
        scene_image.save(ASSETS / f'sky_{scene_name}.png')
        manifest[f'sky_{scene_name}'] = {
            'frame_w': 384, 'frame_h': 240, 'frames': ['g'], 'file': f'assets/sky_{scene_name}.png'
        }
        Image.new('RGBA', (192, 110), TRANSPARENT).save(ASSETS / f'par_{scene_name}.png')
        manifest[f'par_{scene_name}'] = {
            'frame_w': 192, 'frame_h': 110, 'frames': ['s'], 'file': f'assets/par_{scene_name}.png'
        }

    production_home = ROOT / 'art' / 'production' / 'home_background.png'
    if production_home.exists():
        home_image = Image.open(production_home).convert('RGBA').resize((384, 240), Image.Resampling.LANCZOS)
        home_image.save(ASSETS / 'sky_hub.png')
        manifest['sky_hub'] = {'frame_w': 384, 'frame_h': 240, 'frames': ['g'], 'file': 'assets/sky_hub.png'}
        Image.new('RGBA', (192, 110), TRANSPARENT).save(ASSETS / 'par_hub.png')
        manifest['par_hub'] = {'frame_w': 192, 'frame_h': 110, 'frames': ['s'], 'file': 'assets/par_hub.png'}

    if production_candy.exists():
        candy_image = Image.open(production_candy).convert('RGBA').resize((384, 240), Image.Resampling.LANCZOS)
        candy_image.save(ASSETS / 'sky_candy.png')
        manifest['sky_candy'] = {'frame_w': 384, 'frame_h': 240, 'frames': ['g'], 'file': 'assets/sky_candy.png'}
        Image.new('RGBA', (192, 110), TRANSPARENT).save(ASSETS / 'par_candy.png')
        manifest['par_candy'] = {'frame_w': 192, 'frame_h': 110, 'frames': ['s'], 'file': 'assets/par_candy.png'}

    if production_terrain.exists():
        terrain = Image.open(production_terrain).convert('RGBA')
        terrain_frames = [
            cell(terrain, 4, 4, 0, 0), cell(terrain, 4, 4, 0, 1),
            cell(terrain, 4, 4, 2, 0), cell(terrain, 4, 4, 3, 0),
            cell(terrain, 4, 4, 1, 2), cell(terrain, 4, 4, 3, 2),
            cell(terrain, 4, 4, 0, 3), terrain.crop((round(terrain.width * .60), round(terrain.height * .75),
                                                    round(terrain.width * .82), terrain.height)),
        ]
        raw_atlas('tiles', ['grass_top', 'dirt', 'edge_left', 'edge_right', 'platform', 'lilypad', 'cattail', 'lantern'],
                  [fit(frame, 16, 16, 0) for frame in terrain_frames], (16, 16), manifest)

    # Preserve the already-approved Swan extraction metadata.
    manifest["swan"].update({"draw_w": 40, "draw_h": 36, "anchor": [20, 34], "attachments": {"head": [32.5, 6], "feet": [20, 34]}})
    manifest['swan']['attachments']['hand'] = [31, 21]
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Forged {len(manifest)} runtime sheets from approved concepts")


if __name__ == "__main__":
    main()
