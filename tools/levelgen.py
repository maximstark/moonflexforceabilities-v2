"""
MoonFlexForceAbilities — LEVEL GENERATOR (the whole dream)
Run from repo root:  python tools/levelgen.py  ->  levels/*.json
Hand-designed layouts expressed as code so they stay reproducible and
tweakable. Schema v2 (engine reads):
  name, world, sky, par, music, tileSize, tileNames, grid, water,
  spawn, enemies[], pickups[], boss, goalX, doors[], elevator,
  happinessDrain, letterCost, forceForm, next
"""
import json, os, math

os.makedirs("levels", exist_ok=True)
TS = 16

# one global tile vocabulary; index = value in grid; engine maps names->atlas
TILES = [
 "grass_top","dirt","edge_left","edge_right","platform","lilypad","cattail","lantern",     # 0-7
 "water_surf1","water_deep","rock_top","rock_fill","seaweed1","coral","cloud_top",          # 8-14
 "cloud_fill","candy_top","candy_fill","gumdrop","spring1","night_grass","night_dirt",      # 15-21
 "fire1","tree_trunk","tree_leaves","mush_block","fence","flower","sign",                   # 22-28
 "wall","paper","floor","window","door","bed_l","bed_r","shelf","lamp","plant","shaft",     # 29-39
 "roof_l","roof_r",                                                                          # 40-41
]
IX = {n:i for i,n in enumerate(TILES)}

class L:
    def __init__(self, name, world, w, h, sky, par, music, drain=0.04):
        self.meta = dict(name=name, world=world, sky=sky, par=par, music=music)
        self.w, self.h = w, h
        self.g = [[-1]*w for _ in range(h)]
        self.water = []; self.enemies = []; self.pickups = []
        self.boss = None; self.goalX = (w-4)*TS; self.spawn = (32, 8*TS)
        self.doors = []; self.elevator = None
        self.drain = drain; self.letterCost = 100; self.forceForm = None; self.next = None
    def set(s,c,r,t):
        if 0<=c<s.w and 0<=r<s.h: s.g[r][c]=IX[t]
    def fill(s,c0,c1,r0,r1,t):
        for r in range(r0,r1+1):
            for c in range(c0,c1+1): s.set(c,r,t)
    def ground(s,c0,c1,top,gt="grass_top",ft="dirt",edges=True):
        for c in range(c0,c1+1): s.set(c,top,gt)
        s.fill(c0,c1,top+1,s.h-1,ft)
        if edges and gt=="grass_top":
            if c0>0: s.set(c0,top,"edge_left")
            if c1<s.w-1: s.set(c1,top,"edge_right")
    def plat(s,c0,c1,row,t="platform"):
        for c in range(c0,c1+1): s.set(c,row,t)
    def pool(s,c0,c1,surf,floor_r,deco=True):
        """water basin: surface row -> floor; visual tiles + physics rect"""
        s.water.append([c0,surf,c1-c0+1,floor_r-surf])
        for c in range(c0,c1+1):
            s.set(c,surf,"water_surf1")
            for r in range(surf+1,floor_r): s.set(c,r,"water_deep")
        s.fill(c0,c1,floor_r,s.h-1,"dirt")
    def deco(s,pairs):
        for c,r,t in pairs: s.set(c,r,t)
    def enemy(s,typ,c,r,**kw): s.enemies.append(dict(type=typ,x=c*TS,y=r*TS,**kw))
    def pick(s,typ,c,r,**kw): s.pickups.append(dict(type=typ,x=c*TS,y=r*TS,**kw))
    def pops(s,cols,r):
        for c in cols: s.pick("popcorn",c,r)
    def out(s,fname):
        d = dict(**s.meta, tileSize=TS, tileNames=TILES, grid=s.g, water=s.water,
                 spawn=dict(x=s.spawn[0],y=s.spawn[1]), enemies=s.enemies,
                 pickups=s.pickups, boss=s.boss, goalX=s.goalX, doors=s.doors,
                 elevator=s.elevator, happinessDrain=s.drain, letterCost=s.letterCost,
                 forceForm=s.forceForm, next=s.next)
        json.dump(d, open(f"levels/{fname}","w"), separators=(",",":"))
        print(f"levels/{fname}: {s.w}x{s.h} tiles, {len(s.enemies)} enemies, {len(s.pickups)} pickups")

# =====================================================================
#  LEVEL 1 — THE DREAM LAKE  (the slice level, upgraded)
# =====================================================================
def level1():
    v = L("THE DREAM LAKE", 1, 120, 17, "sky_lake", "par_lake", "lake")
    v.next = 2
    v.spawn = (32, 160)
    for a,b in [(0,15),(18,31),(34,54),(69,87),(90,119)]: v.ground(a,b,12)
    v.fill(55,68,16,16,"dirt")
    v.pool(55,68,12,16)
    for c in (57,62,66): v.set(c,12,"lilypad")           # now one-way stepping pads
    v.plat(10,12,9); v.plat(25,27,9); v.plat(29,31,6)
    v.plat(43,45,9); v.plat(80,82,9); v.plat(98,100,9); v.plat(110,112,9)
    v.plat(28,30,2)                                       # secret loft: baby swan
    v.fill(119,119,3,11,"dirt")                           # arena wall
    v.deco([(3,11,"cattail"),(7,11,"lantern"),(5,11,"flower"),(13,11,"fence"),
            (50,11,"lantern"),(70,11,"cattail"),(71,11,"flower"),(84,11,"lantern"),
            (93,11,"lantern"),(116,11,"lantern"),(36,11,"fence"),(37,11,"flower"),
            (2,11,"sign")])
    v.enemy("frog",22,10); v.enemy("cockroach",38,11); v.enemy("cockroach",42,11)
    v.enemy("cockroach",46,11); v.enemy("frog",52,10); v.enemy("dino",75,10)
    v.pops([10,11,12],8); v.pops([16,17],10); v.pops([26],8)
    v.pops([36,38,40],11); v.pops([58,60],14); v.pops([72,74],11); v.pops([76],9)
    v.pops([78],10); v.pops([95,97,99],11)
    v.pick("star",30,5); v.pick("star",63,14); v.pick("star",111,7)
    v.pick("treat",44,8); v.pick("treat",66,15); v.pick("treat",81,8)
    v.pick("babyswan",29,1)                                # up on the secret loft
    v.boss = dict(type="grumpis", x=1680, y=144)
    v.goalX = 1848
    return v

# =====================================================================
#  LEVEL 2 — MOONLIGHT LAKE  (night; goose feet; the tree rescue; twins)
# =====================================================================
def level2():
    v = L("MOONLIGHT LAKE", 2, 150, 18, "sky_night", "par_night", "night", drain=0.045)
    v.next = 3
    v.spawn = (32, 176)
    G,D = "night_grass","night_dirt"
    for a,b in [(0,20),(23,40),(43,69),(72,99),(102,116),(119,149)] :
        v.ground(a,b,13,G,D,edges=False)
    v.pool(100,101,13,17)                                  # narrow moat
    v.pool(117,118,13,17)
    v.plat(8,10,10); v.plat(14,16,7)
    v.plat(30,32,9)
    # goose-feet showcase: a ledge too tall for a base jump
    v.fill(38,40,9,12,D); v.set(38,9,G); v.set(39,9,G); v.set(40,9,G)
    v.fill(62,69,9,12,D)
    for c in range(62,70): v.set(c,9,G)
    v.plat(50,52,10)
    # ---- THE TREE RESCUE: a fire up a tree and a baby swan stuck in it ----
    v.fill(80,80,7,12,"tree_trunk")
    v.fill(77,83,5,6,"tree_leaves")
    v.set(76,6,"tree_leaves"); v.set(84,6,"tree_leaves")
    v.set(77,4,"fire1"); v.set(80,4,"fire1"); v.set(83,4,"fire1")  # stomp the flames!
    v.pick("babyswan",80,3,rescue=True)
    v.plat(74,75,8); v.plat(86,87,8)                       # rescue approach pads
    v.plat(90,92,10)
    v.plat(105,107,9); v.plat(110,112,7)
    v.fill(149,149,4,12,D)                                 # arena wall
    v.deco([(4,12,"fence"),(5,12,"flower"),(11,12,"lantern"),(26,12,"cattail"),
            (35,12,"lantern"),(46,12,"fence"),(47,12,"fence"),(55,12,"flower"),
            (75,12,"lantern"),(88,12,"cattail"),(95,12,"lantern"),(108,12,"flower"),
            (122,12,"lantern"),(146,12,"lantern"),(2,12,"sign")])
    v.pick("pickup_goosefeet",33,7)                        # wear the GIANT GOOSE FEET
    v.pick("moon",39,6)                                    # moonlight on the high ledge
    v.pick("moon",111,4)
    v.enemy("frog",27,11); v.enemy("frog",47,11); v.enemy("frog",56,11)
    v.enemy("dino",65,6); v.enemy("cockroach",75,12); v.enemy("cockroach",78,12)
    v.enemy("dino",94,11); v.enemy("frog",109,11); v.enemy("cockroach",112,12)
    v.pops([8,9,10],9); v.pops([14,15,16],6); v.pops([24,25],12)
    v.pops([44,45,46],12); v.pops([63,65,67],8); v.pops([74],7); v.pops([86],7)
    v.pops([105,106,107],8); v.pops([124,126,128],12)
    v.pick("star",15,5); v.pick("star",80,8); v.pick("star",111,5)
    v.pick("treat",31,7); v.pick("treat",51,8); v.pick("treat",91,8); v.pick("treat",126,12)
    v.boss = dict(type="twins", x=2080, y=144)
    v.goalX = 2360
    return v

# =====================================================================
#  LEVEL 3 — THE DEEP  (underwater dream; cat-face alligators; Papa)
# =====================================================================
def level3():
    v = L("THE DEEP", 3, 160, 20, "sky_under", "par_under", "under", drain=0.045)
    v.next = 4
    v.spawn = (32, 96)
    R,F = "rock_top","rock_fill"
    # entry shelf above the water
    v.ground(0,14,8,R,F,edges=False)
    # the great water body: surface row 6 across the whole rest
    v.water.append([15,6,145,13])
    for c in range(15,160): v.set(c,6,"water_surf1")
    # sea floor
    v.fill(15,159,17,19,F)
    for c in range(15,160):
        if v.g[16][c]==-1: v.set(c,17,R)
    # rock formations to weave through
    v.fill(30,33,10,16,F); v.set(30,9,R); v.set(31,9,R); v.set(32,9,R); v.set(33,9,R)
    v.fill(48,50,9,11,F)
    v.fill(60,63,12,16,F); v.set(60,11,R); v.set(61,11,R); v.set(62,11,R); v.set(63,11,R)
    v.fill(76,78,9,13,F)
    v.fill(92,95,10,16,F); v.set(92,9,R); v.set(93,9,R); v.set(94,9,R); v.set(95,9,R)
    v.fill(108,110,9,11,F)
    # mid-level air pocket island
    v.ground(120,128,5,R,F,edges=False)
    v.fill(120,128,6,7,F)
    for c in range(120,129):
        if v.g[6][c]==IX["water_surf1"]: v.set(c,6,F)
    # boss arena: lilypad islands at the surface
    for c in (138,139,144,145,150,151,156,157): v.set(c,6,"lilypad")
    v.deco([(20,16,"seaweed1"),(26,16,"seaweed1"),(38,16,"coral"),(44,16,"seaweed1"),
            (56,16,"coral"),(68,16,"seaweed1"),(72,16,"seaweed1"),(84,16,"coral"),
            (100,16,"seaweed1"),(104,16,"coral"),(116,16,"seaweed1"),(13,7,"cattail"),
            (3,7,"lantern"),(124,4,"lantern"),(31,9,"flower")])
    v.enemy("alligator",42,14); v.enemy("alligator",70,9); v.enemy("alligator",100,14)
    v.enemy("alligator",114,9)
    for c,r in [(24,12),(36,8),(54,14),(66,9),(88,12),(98,8),(112,13),(130,10)]:
        v.enemy("fish",c,r)
    v.pick("chest",22,16); v.pick("chest",86,16)           # sunken treasure: stars
    v.pops([18,20],10); v.pops([34,36],13); v.pops([52,54],9); v.pops([64,66],14)
    v.pops([80,82],9); v.pops([96,98],13); v.pops([112,114],11); v.pops([130,132],8)
    v.pick("star",45,15); v.pick("star",79,15); v.pick("star",105,8)
    v.pick("treat",28,9); v.pick("treat",58,13); v.pick("treat",90,8); v.pick("treat",123,4)
    v.pick("pickup_laser",124,3)                           # laser eyes, for the deep dark
    v.pick("babyswan",109,5)                               # bobbing in a quiet cove
    v.boss = dict(type="papa", x=2300, y=88)
    v.goalX = 2520
    return v

# =====================================================================
#  LEVEL 4 — CANDY CLOUDS  (sky world; springs; kirby cap; the reunion)
# =====================================================================
def level4():
    v = L("CANDY CLOUDS", 4, 160, 18, "sky_candy", "par_candy", "candy", drain=0.05)
    v.next = 5
    v.spawn = (32, 128)
    C,Cf,K,Kf = "cloud_top","cloud_fill","candy_top","candy_fill"
    # candy launch ridge
    v.ground(0,14,10,K,Kf,edges=False)
    v.set(13,9,"spring1")
    # cloud hop chains over the void (fall = lost heart)
    # gentle main path (descents and one-row rises); the sky goodies reward flapping
    v.plat(18,21,8,C); v.plat(25,27,7,C); v.plat(31,34,8,C)
    v.plat(38,40,7,C); v.plat(44,47,8,C)
    v.enemy("wisp",27,5); v.enemy("wisp",36,4); v.enemy("wisp",45,5)  # dream-wisps drift over the void
    # candy mesa with mush-block vault (baby inside)
    v.ground(50,68,9,K,Kf,edges=False)
    v.fill(60,60,6,8,"mush_block"); v.fill(64,64,6,8,"mush_block")
    v.set(62,8,"gumdrop")
    v.pick("babyswan",62,7)                                 # walled in by mush blocks
    v.set(53,8,"spring1")
    v.plat(72,74,6,C); v.plat(78,80,4,C); v.plat(84,87,7,C)
    # gumdrop garden
    v.ground(92,112,10,K,Kf,edges=False)
    v.deco([(95,9,"gumdrop"),(101,9,"gumdrop"),(107,9,"gumdrop"),(98,9,"flower"),(104,9,"flower")])
    v.set(110,9,"spring1")
    v.plat(116,118,7,C); v.plat(122,124,5,C)
    # reunion arena: wide candy stage
    v.ground(128,159,11,K,Kf,edges=False)
    v.plat(134,136,7,C); v.plat(150,152,7,C)
    v.fill(159,159,2,10,Kf)
    v.deco([(130,10,"lantern"),(156,10,"lantern"),(93,9,"sign")])
    v.pick("pickup_kirby",26,3)                              # the kirby cap: one more flap
    v.pick("pickup_goosefeet",54,7)                          # to pound the mush vault
    v.pick("moon",79,2)
    v.enemy("frog",20,6); v.enemy("frog",32,6); v.enemy("frog",45,5)
    v.enemy("cockroach",56,8); v.enemy("cockroach",66,8); v.enemy("dino",70,7,fly=False)
    v.enemy("frog",73,4); v.enemy("cockroach",96,9); v.enemy("cockroach",100,9)
    v.enemy("dino",105,8); v.enemy("frog",117,5)
    v.pops([18,19,20,21],7); v.pops([25,26,27],5); v.pops([38,39,40],4)
    v.pops([55,57],8); v.pops([72,73,74],5); v.pops([78,79,80],3)
    v.pops([95,97,99,101],8); v.pops([116,117,118],6); v.pops([122,123,124],4)
    v.pick("star",39,2); v.pick("star",62,5); v.pick("star",123,3)
    v.pick("treat",46,6); v.pick("treat",85,6); v.pick("treat",103,7); v.pick("treat",135,6)
    v.boss = dict(type="family", x=2280, y=96)
    v.goalX = 2520
    return v

# =====================================================================
#  LEVEL 5 — THE FEVER SWARM  (too much on screen, on purpose)
# =====================================================================
def level5():
    v = L("THE FEVER SWARM", 5, 180, 17, "sky_fever", "par_fever", "fever", drain=0.06)
    v.next = 6
    v.spawn = (32, 160)
    for a,b in [(0,38),(41,82),(85,128),(131,179)]: v.ground(a,b,12)
    v.pool(39,40,12,16); v.pool(83,84,12,16); v.pool(129,130,12,16)
    v.plat(10,12,9); v.plat(20,22,8); v.plat(30,32,9)
    v.fill(26,26,10,11,"mush_block")
    v.plat(48,50,9); v.plat(56,58,7); v.plat(64,66,9); v.plat(74,76,8)
    v.fill(70,70,9,11,"mush_block"); v.fill(71,71,9,11,"mush_block")
    v.set(45,11,"fire1"); v.set(61,11,"fire1"); v.set(79,11,"fire1")
    v.plat(92,94,9); v.plat(102,104,7); v.plat(112,114,9); v.plat(120,122,8)
    v.set(98,11,"fire1"); v.set(108,11,"fire1"); v.set(118,11,"fire1")
    v.fill(124,124,9,11,"mush_block")
    v.plat(138,140,9); v.plat(146,148,7)
    v.fill(179,179,3,11,"dirt")
    v.deco([(5,11,"lantern"),(36,11,"lantern"),(54,11,"flower"),(68,11,"lantern"),
            (90,11,"cattail"),(110,11,"lantern"),(135,11,"lantern"),(150,11,"lantern"),
            (2,11,"sign")])
    # THE SWARM
    for c in (8,14,17,24,28,34,46,52,55,60,63,68,72,78,88,91,96,101,106,111,116,121,126):
        v.enemy("cockroach",c,11)
    for c in (13,29,49,67,93,113,139): v.enemy("frog",c,10)
    for c in (37,75,107,143): v.enemy("dino",c,10)
    v.enemy("alligator",40,13); v.enemy("alligator",130,13)
    v.pick("pickup_spoon",21,6)                              # THE GIANT SPOON
    v.pick("pickup_goosefeet",57,5); v.pick("pickup_laser",103,5); v.pick("pickup_kirby",147,5)
    v.pick("moon",65,6); v.pick("moon",121,5)
    v.pick("chest",116,8)
    v.pops([10,11,12],7); v.pops([16,18],11); v.pops([30,31,32],7)
    v.pops([48,49,50],7); v.pops([56,57,58],5); v.pops([64,65,66],7)
    v.pops([92,93,94],7); v.pops([102,103,104],5); v.pops([112,113,114],7)
    v.pops([138,139,140],7); v.pops([146,147,148],5)
    v.pick("star",26,8); v.pick("star",71,7); v.pick("star",124,7)
    for c in (18,44,62,86,100,117,136,144): v.pick("treat",c,11)
    v.pick("babyswan",148,4)
    v.boss = dict(type="hogdog", x=2660, y=104, flees=True)
    v.goalX = 2840
    return v

# =====================================================================
#  LEVEL 6 — MOONFLEX FINALE  (you are the GIANT MECHA SWAN)
# =====================================================================
def level6():
    v = L("MOONFLEX FINALE", 6, 200, 18, "sky_finale", "par_finale", "mecha", drain=0.0)
    v.next = None
    v.forceForm = "mecha"
    v.letterCost = 1000000
    v.spawn = (48, 160)
    for a,b in [(0,52),(56,110),(114,199)]: v.ground(a,b,13)
    v.pool(53,55,13,17); v.pool(111,113,13,17)
    # walls of mush to SMASH THROUGH (you are huge now)
    for c in (20,21,38,39,62,63,80,81,98,99,124,125):
        v.fill(c,c,8,12,"mush_block")
    v.plat(30,33,8); v.plat(70,73,8); v.plat(90,93,7); v.plat(105,108,8)
    v.plat(134,137,8); v.plat(144,147,7)
    v.fill(199,199,2,12,"dirt")
    v.deco([(6,12,"lantern"),(46,12,"lantern"),(76,12,"lantern"),(120,12,"lantern"),
            (160,12,"lantern"),(196,12,"lantern"),(2,12,"sign")])
    # popcorn rivers: the ten-million-point victory lap
    for r,cs in [(11,range(8,18)),(10,range(24,36)),(11,range(42,52)),
                 (10,range(64,78)),(9,range(86,96)),(10,range(102,110)),
                 (11,range(116,124)),(10,range(128,142)),(9,range(150,158))]:
        v.pops(list(cs),r)
    for c in (16,44,74,94,118,140): v.pick("treat",c,8)
    v.pick("star",31,6); v.pick("star",91,5); v.pick("star",145,5)
    v.boss = dict(type="hogdog_final", x=2860, y=96)
    v.goalX = 3120
    return v

# =====================================================================
#  THE HUB — the impossibly tall house (always neat)
# =====================================================================
def hub():
    v = L("HOME", 0, 26, 62, "sky_hub", "par_hub", "hub", drain=0.0)
    v.spawn = (5*TS, 57*TS)
    W,P,F = "wall","paper","floor"
    FLOORS = [58, 50, 42, 34, 26, 18]            # row of each storey's floor (bottom-up)
    # outer shell
    v.fill(2,23,10,61,P)                          # cozy wallpaper interior
    v.fill(1,1,10,61,W); v.fill(24,24,10,61,W)    # walls
    v.fill(2,23,60,61,W)                          # foundation
    for fr in FLOORS: v.fill(2,23,fr,fr,F)        # storeys
    # roof
    v.fill(2,23,9,9,F)
    for i in range(5):
        v.set(2+i,8-i,"roof_l"); v.set(23-i,8-i,"roof_r")
        v.fill(3+i,22-i,8-i,8-i,W)
    v.set(12,3,"lantern"); v.set(13,3,"lantern")
    # elevator shaft down the middle
    v.fill(12,13,11,57,"shaft")
    v.elevator = dict(x=12*TS+4, stops=[fr*TS for fr in FLOORS])   # car centred in shaft; stops flush with each floor
    # per-floor doors & tidy furniture (it is ALWAYS neat)
    LV = [1,2,3,4,5,6]
    for i,fr in enumerate(FLOORS):
        v.set(20,fr-1,"door"); v.set(20,fr-2,"sign")
        v.doors.append(dict(x=20*TS, y=(fr-1)*TS, level=LV[i]))
        v.set(4,fr-1,"lamp"); v.set(8,fr-2,"window"); v.set(17,fr-2,"window")
        if i%3==0: v.set(6,fr-1,"bed_l"); v.set(7,fr-1,"bed_r")
        elif i%3==1: v.set(6,fr-1,"shelf"); v.set(7,fr-1,"plant")
        else: v.set(6,fr-1,"plant"); v.set(7,fr-1,"shelf")
        v.set(9,fr-1,"plant") if i%2 else v.set(16,fr-1,"lamp")
    # ground floor: the front door to the lake (title) & a welcome
    v.set(3,57,"sign")
    v.goalX = 10**9                               # no goal; you leave through doors
    return v

if __name__ == "__main__":
    level1().out("level1.json")
    level2().out("level2.json")
    level3().out("level3.json")
    level4().out("level4.json")
    level5().out("level5.json")
    level6().out("level6.json")
    hub().out("hub.json")
    print("all levels written")
