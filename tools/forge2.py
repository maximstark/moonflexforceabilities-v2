"""
MoonFlexForceAbilities — ASSET FORGE 2  (expansion roster: the whole dream)
Run from repo root:  python tools/forge2.py
  -> writes new assets/*.png, MERGES entries into assets/manifest.json,
     and renders assets/_preview2.png
Same conventions as forge.py: horizontal strip sheets, fixed cell size,
dark outline pass, chunky readable shapes. Palette extends the v1 set
toward the gpt_style_refs mockups (sunset golds, twilight purples, teal
deeps, hot pink).
"""
from PIL import Image, ImageDraw
import numpy as np, json, os, math

OUT = "assets"
os.makedirs(OUT, exist_ok=True)
T = (0, 0, 0, 0); OUTLINE = (38, 26, 53, 255)

# ---- v1 palette (kept in sync with forge.py) ----
WHITE=(245,244,250,255); LAV=(201,187,226,255); LAV2=(170,152,202,255)
BEAK=(240,150,50,255); BEAKS=(201,110,30,255); FOOT=(236,140,45,255); FOOTS=(193,104,28,255)
EYE=(30,20,40,255); EYEW=(245,245,250,255)
BFUR=(150,110,148,255); BFURD=(112,80,112,255); BBEL=(202,162,124,255)
HORN=(186,154,94,255); HORND=(140,108,58,255)
STINK=(150,202,96,255); STINKD=(108,164,66,255); GOLD=(236,200,82,255); GEM=(234,92,150,255); TOOTH=(248,248,240,255)
GRASS=(122,182,82,255); GRASSD=(82,140,56,255); DIRT=(132,90,64,255); DIRTD=(96,62,44,255); STONE=(120,104,128,255)
HRT=(226,72,112,255); POP=(238,236,228,255); BOX=(222,86,120,255); CHERRY=(220,70,90,255)
YEL=(248,206,80,255); PETAL=(246,140,180,255)
MTAIL=(224,120,182,255); MTAILD=(184,80,144,255); MFIN=(246,172,212,255)
FGN=(110,182,74,255); FGND=(70,132,46,255)

# ---- expansion palette (from the mockups) ----
PINK=(236,130,164,255); PINKD=(186,82,122,255); PINKL=(250,196,216,255); CREAM=(250,228,206,255)
GLOW=(255,150,210,255)
STEEL=(226,228,240,255); STEELD=(168,170,196,255); STEELDD=(120,120,150,255); CORE=(242,92,150,255); TRIM=(240,200,90,255)
HOG=(152,92,66,255); HOGD=(108,60,44,255); HOGL=(192,132,92,255); SNOUT=(216,150,124,255); DROOL=(170,220,170,255)
GATOR=(104,164,84,255); GATORD=(66,116,52,255); GATORB=(196,216,150,255)
CATF=(248,226,222,255); CATP=(244,170,190,255)
MUSH=(168,110,196,255); MUSHD=(120,70,150,255); MUSHS=(232,222,240,255)
FIRE1=(252,196,80,255); FIRE2=(244,120,52,255); FIRE3=(220,70,40,255)
ROCK=(126,92,148,255); ROCKD=(88,58,108,255); TEALG=(96,196,160,255); TEALGD=(56,148,116,255)
WATERC=(74,156,196,235); WATERD=(48,116,160,235); CREST=(225,245,255,255)
CLOUD=(244,242,252,255); CLOUDD=(206,198,232,255)
CANDY=(246,166,198,255); CANDYD=(206,112,152,255); WAFER=(240,208,150,255); WAFERD=(198,158,100,255); MINT=(152,226,190,255)
NGRASS=(88,150,110,255); NGRASSD=(56,108,80,255); NDIRT=(98,70,104,255); NDIRTD=(68,46,76,255)
WOOD=(170,118,74,255); WOODD=(126,82,50,255); PAPER=(238,214,196,255); PAPERD=(214,182,166,255)
LAMP=(255,236,170,255); SHELF=(146,98,62,255)
TURT=(120,180,120,255); TURTD=(80,132,84,255); SHELL2=(176,136,90,255); SHELLD=(130,96,60,255)
MOONC=(248,238,200,255); MOOND=(216,200,150,255)
BEAD1=(236,200,82,255); BEAD2=(180,100,220,255); BEAD3=(96,196,160,255)

def cell(w,h): return Image.new("RGBA",(w,h),T)
def outline(img,w,h):
    a=np.array(img); al=a[:,:,3]>0; edge=np.zeros_like(al)
    for sy,sx in [(-1,0),(1,0),(0,-1),(0,1)]:
        s=np.zeros_like(al)
        ys=slice(max(0,sy),h+min(0,sy)); xs=slice(max(0,sx),w+min(0,sx))
        yd=slice(max(0,-sy),h+min(0,-sy)); xd=slice(max(0,-sx),w+min(0,-sx))
        s[yd,xd]=al[ys,xs]; edge|=s&(~al)
    a[edge]=OUTLINE; return Image.fromarray(a,"RGBA")
def star(d,cx,cy,r,col):
    pts=[]
    for i in range(10):
        ang=-math.pi/2+i*math.pi/5; rr=r if i%2==0 else r*0.45
        pts.append((cx+rr*math.cos(ang),cy+rr*math.sin(ang)))
    d.polygon(pts,fill=col)
def heart(d,x0,y0,w,h,col):
    d.ellipse([x0,y0,x0+w*0.55,y0+h*0.6],fill=col)
    d.ellipse([x0+w*0.45,y0,x0+w,y0+h*0.6],fill=col)
    d.polygon([(x0,y0+h*0.32),(x0+w,y0+h*0.32),(x0+w*0.5,y0+h)],fill=col)

# =====================================================================
#  CHARACTERS
# =====================================================================
def charmgirl_frames():
    """P2: small pink T-Rex with a heart charm on her belly."""
    W,H=30,28
    def base(d,legA=0,legB=0,bob=0):
        d.polygon([(2,16+bob),(9,13+bob),(9,20+bob)],fill=PINK)                  # tail
        d.ellipse([6,9+bob,24,25+bob],fill=PINK)                                  # body
        d.ellipse([10,14+bob,22,25+bob],fill=CREAM)                               # belly
        heart(d,13,16+bob,6,6,CHERRY)                                             # the charm
        d.ellipse([15,1+bob,29,14+bob],fill=PINK)                                 # head
        d.ellipse([18,7+bob,28,14+bob],fill=PINKL)                                # muzzle
        d.point((22,6+bob),fill=EYE); d.point((23,6+bob),fill=EYE)
        d.arc([21,9+bob,26,12+bob],0,180,fill=PINKD)                              # smile
        d.point((22,5+bob),fill=WHITE)                                            # eye sparkle
        d.ellipse([18,9+bob,20,11+bob],fill=(228,104,146,255))                    # cheek blush
        d.ellipse([16,2+bob,21,5+bob],fill=PINKL)                                 # head sheen
        for sx in (10,14,18): d.polygon([(sx,9+bob),(sx+2,5+bob),(sx+4,9+bob)],fill=PINKD)  # back spikes
        d.line([(12,18+bob),(14,20+bob)],fill=PINKD,width=1)                      # lil arm
        d.rectangle([10,24+legA,13,27],fill=PINKD)                                # legs
        d.rectangle([17,24+legB,20,27],fill=PINK)
    def mk(la,lb,bob):
        im=cell(W,H);base(ImageDraw.Draw(im),la,lb,bob);return outline(im,W,H)
    def jump():
        im=cell(W,H);d=ImageDraw.Draw(im);base(d,-2,-2,-1)
        d.line([(9,26),(6,28)],fill=PINKD,width=1);d.line([(19,26),(22,28)],fill=PINKD,width=1)
        return outline(im,W,H)
    return (W,H,[mk(0,0,0),mk(-1,1,0),mk(1,-1,1),jump()],["idle","walk1","walk2","jump"])

def trex_frames():
    """Charmgirl moonlit: full T-Rex, glowing eyes, ground-shaking."""
    W,H=52,48
    def base(d,legA=0,legB=0,roar=False):
        d.polygon([(1,26),(14,20),(14,32)],fill=PINK)                             # tail
        d.ellipse([10,14,40,42],fill=PINK)                                        # body
        d.ellipse([16,22,38,42],fill=CREAM)                                       # belly
        heart(d,23,27,9,9,CHERRY)
        hy=-2 if roar else 0
        d.ellipse([26,1+hy,50,22+hy],fill=PINK)                                   # head
        d.ellipse([34,10+hy,50,22+hy],fill=PINKL)                                  # jaw/muzzle
        d.ellipse([14,16,26,23],fill=PINKL)                                        # cool body sheen
        d.ellipse([28,3+hy,38,9+hy],fill=PINKL)                                    # head sheen
        if roar:
            d.polygon([(34,16+hy),(51,12+hy),(51,24+hy),(36,22+hy)],fill=PINKD)   # open mouth
            for tx in (38,43,47): d.polygon([(tx,15+hy),(tx+2,18+hy),(tx+4,15+hy)],fill=TOOTH)
        else:
            d.line([(36,17+hy),(48,17+hy)],fill=PINKD,width=1)
            d.polygon([(40,17+hy),(42,20+hy),(44,17+hy)],fill=TOOTH)
        d.ellipse([33,6+hy,37,10+hy],fill=GLOW); d.point((35,8+hy),fill=(255,255,255,255))  # glowing eye
        for sx in (14,20,26,32): d.polygon([(sx,16),(sx+3,10),(sx+6,16)],fill=PINKD)
        d.line([(20,28),(24,32)],fill=PINKD,width=2)                              # arm
        d.rectangle([16,40+legA,23,47],fill=PINKD)                                # chunky legs
        d.rectangle([29,40+legB,36,47],fill=PINK)
        for fx in (16,29): d.rectangle([fx,45,fx+9,47],fill=PINKL)                # toes
    def mk(la,lb,roar=False):
        im=cell(W,H);base(ImageDraw.Draw(im),la,lb,roar);return outline(im,W,H)
    return (W,H,[mk(0,-2),mk(-2,0),mk(0,0,True)],["walk1","walk2","roar"])

def mecha_frames():
    """The endgame: GIANT MECHA SWAN. White armor, pink core, gold trim."""
    W,H=64,60
    def base(d,ly=0,wing=0,fly=False):
        # legs / thrusters
        if fly:
            for lx in (22,36):
                d.rectangle([lx,44,lx+6,50],fill=STEELD)
                d.polygon([(lx,50),(lx+6,50),(lx+3,57+wing)],fill=FIRE1)
                d.polygon([(lx+1,50),(lx+5,50),(lx+3,54+wing)],fill=FIRE2)
        else:
            for i,lx in enumerate((20,36)):
                lo=ly if i==0 else -ly
                d.rectangle([lx,42+lo,lx+7,52+lo],fill=STEELD)
                d.rectangle([lx-2,52+lo,lx+10,55+lo],fill=TRIM)                   # gold foot
        # wings (layered metal feathers)
        for k in range(3):
            wy=18-k*4+wing; d.ellipse([2,wy,26,wy+14],fill=STEEL if k%2 else STEELD)
        for k in range(3):
            wy=18-k*4+wing; d.ellipse([40,wy,62,wy+14],fill=STEEL if k%2 else STEELD)
        for x in (8,14,46,52): d.line([(x,20+wing),(x+4,28+wing)],fill=STEELDD,width=1)
        # torso
        d.ellipse([14,18,50,48],fill=STEEL)
        d.ellipse([20,24,44,44],fill=STEELD)
        d.ellipse([26,29,38,41],fill=(60,40,70,255))
        d.ellipse([28,31,36,39],fill=CORE)                                        # power core
        d.point((31,33),fill=(255,220,240,255))
        for bx,by in [(17,22),(45,22),(17,42),(45,42)]: d.point((bx,by),fill=TRIM) # rivets
        d.line([(19,22),(25,22)],fill=(255,255,255,255),width=1)                  # torso specular
        d.point((22,24),fill=(255,255,255,255))
        # neck + head (armored swan)
        d.rectangle([30,6,36,20],fill=STEEL); d.line([(33,6),(33,20)],fill=STEELD,width=1)
        d.ellipse([28,0,44,12],fill=STEEL); d.ellipse([30,2,42,10],fill=STEELD)
        d.ellipse([31,1,37,4],fill=(255,255,255,255))                             # head dome shine
        d.polygon([(42,4),(50,6),(42,9)],fill=TRIM)                               # gold beak
        d.rectangle([34,3,37,5],fill=CORE)                                        # visor eye
        d.point((35,4),fill=(255,240,250,255))
        # crest fin
        d.polygon([(30,0),(34,-4),(36,1)],fill=CORE)
    def mk(ly,wing,fly=False):
        im=cell(W,H);base(ImageDraw.Draw(im),ly,wing,fly);return outline(im,W,H)
    return (W,H,[mk(0,0),mk(2,0),mk(-2,0),mk(0,-2,True),mk(0,2,True)],
            ["idle","walk1","walk2","fly1","fly2"])

def babyswan_frames():
    W,H=18,16
    def mk(bob):
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([2,7+bob,14,15],fill=WHITE); d.ellipse([4,11+bob,13,15],fill=LAV)
        d.rectangle([10,3+bob,12,9+bob],fill=WHITE)
        d.ellipse([8,1+bob,15,7+bob],fill=WHITE)
        d.polygon([(14,3+bob),(17,4+bob),(14,5+bob)],fill=BEAK)
        d.point((12,3+bob),fill=EYE)
        d.ellipse([4,8+bob,10,13],fill=LAV)                                       # fluffy wing
        return outline(im,W,H)
    return (W,H,[mk(0),mk(1)],["bob1","bob2"])

def alligator_frames():
    """The cat face that is ACTUALLY AN ALLIGATOR. AGH!"""
    W,H=48,26
    def catface(d,cx,cy,wink=False):
        d.ellipse([cx-7,cy-6,cx+7,cy+7],fill=CATF)                                # face
        d.polygon([(cx-7,cy-4),(cx-9,cy-10),(cx-2,cy-6)],fill=CATF)               # ears
        d.polygon([(cx+7,cy-4),(cx+9,cy-10),(cx+2,cy-6)],fill=CATF)
        d.polygon([(cx-6,cy-5),(cx-7,cy-8),(cx-3,cy-6)],fill=CATP)
        d.polygon([(cx+6,cy-5),(cx+7,cy-8),(cx+3,cy-6)],fill=CATP)
        if wink: d.arc([cx-5,cy-3,cx-1,cy+1],0,180,fill=EYE)
        else: d.point((cx-3,cy-1),fill=EYE)
        d.point((cx+3,cy-1),fill=EYE)
        d.ellipse([cx-1,cy+1,cx+1,cy+3],fill=CATP)                                # nose
        d.arc([cx-4,cy+1,cx,cy+5],0,180,fill=EYE); d.arc([cx,cy+1,cx+4,cy+5],0,180,fill=EYE)
        for wy in (cy,cy+2):
            d.line([(cx-12,wy),(cx-8,wy)],fill=CATF,width=1); d.line([(cx+8,wy),(cx+12,wy)],fill=CATF,width=1)
        d.ellipse([cx-4,cy+3,cx-2,cy+5],fill=CATP); d.ellipse([cx+2,cy+3,cx+4,cy+5],fill=CATP)  # blush
    def gatorbody(d,x0,jaw=0):
        d.ellipse([x0,10,x0+30,24],fill=GATOR)                                    # body
        d.ellipse([x0+4,16,x0+26,24],fill=GATORB)
        d.polygon([(x0-6,18),(x0+4,13),(x0+4,23)],fill=GATOR)                     # tail
        for sx in range(x0+4,x0+26,5): d.polygon([(sx,11),(sx+2,7),(sx+4,11)],fill=GATORD)
        for lx in (x0+6,x0+20): d.rectangle([lx,22,lx+3,25],fill=GATORD)
        if jaw:                                                                    # open jaws
            d.polygon([(x0+24,12),(x0+46,4),(x0+44,12)],fill=GATOR)
            d.polygon([(x0+24,14),(x0+46,22),(x0+44,14)],fill=GATORD)
            for tx in range(x0+28,x0+42,4):
                d.polygon([(tx,10),(tx+1,13),(tx+2,10)],fill=TOOTH)
                d.polygon([(tx+1,16),(tx+2,13),(tx+3,16)],fill=TOOTH)
    def f_catface():
        im=cell(W,H);d=ImageDraw.Draw(im);catface(d,24,12,wink=True);return outline(im,W,H)
    def f_reveal():
        im=cell(W,H);d=ImageDraw.Draw(im);gatorbody(d,6);catface(d,36,9);return outline(im,W,H)
    def f_chomp():
        im=cell(W,H);d=ImageDraw.Draw(im);gatorbody(d,2,jaw=1);catface(d,28,6)
        d.polygon([(26,2),(28,-2),(30,2)],fill=CATF)                              # startled ears up
        return outline(im,W,H)
    return (W,H,[f_catface(),f_reveal(),f_chomp()],["catface","reveal","chomp"])

def fish_frames():
    W,H=14,10
    def mk(ph):
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([2,2,11,9],fill=PETAL); d.polygon([(10,5),(14,2+ph),(14,8-ph)],fill=CATP)
        d.point((4,4),fill=EYE); d.arc([3,4,7,8],300,80,fill=CATP)
        return outline(im,W,H)
    return (W,H,[mk(0),mk(2)],["swim1","swim2"])

def turtles_frames():
    """The ending: momma sea turtle and her babies, calm after the storm."""
    W,H=96,40
    def turtle(d,x,y,s,col,shell):
        d.ellipse([x,y,x+16*s,y+9*s],fill=shell)                                  # shell
        for px,py in [(0.3,0.25),(0.62,0.25),(0.45,0.55)]:
            d.ellipse([x+16*s*px-1.5*s,y+9*s*py-1*s,x+16*s*px+1.5*s,y+9*s*py+1.5*s],fill=SHELLD)
        d.ellipse([x+13*s,y+3*s,x+19*s,y+8*s],fill=col)                           # head
        d.point((x+16.5*s,y+4.5*s),fill=EYE)
        d.ellipse([x+2*s,y+7*s,x+7*s,y+10*s],fill=col)                            # flipper
        d.ellipse([x+9*s,y+7*s,x+14*s,y+10*s],fill=col)
    def mk(bob):
        im=cell(W,H);d=ImageDraw.Draw(im)
        turtle(d,4,12+bob,2.0,TURT,SHELL2)                                        # momma
        for i,bx in enumerate((46,64,80)):
            turtle(d,bx,24+(i%2)*2-bob,0.9,TURT,SHELL2)
        return outline(im,W,H)
    return (W,H,[mk(0),mk(2)],["calm1","calm2"])

# =====================================================================
#  BOSSES
# =====================================================================
def boss_papa_frames():
    """Papa Grumpis: gigantic, crowned, infamously stinky armpits."""
    W,H=96,80
    def torso(d,arms="down"):
        d.ellipse([10,34,86,79],fill=BFUR)                                        # huge body
        d.ellipse([28,46,68,79],fill=BBEL)                                        # belly
        d.ellipse([45,62,51,68],fill=BFURD)                                       # navel
        if arms=="up":
            for ax in (8,76):
                d.ellipse([ax,18,ax+14,52],fill=BFUR)
                for c in range(3): d.line([(ax+3+c*4,18),(ax+3+c*4,12)],fill=BBEL,width=1)
        else:
            for ax in (4,78):
                d.ellipse([ax,40,ax+14,72],fill=BFUR)
                for c in range(3): d.line([(ax+3+c*4,70),(ax+3+c*4,76)],fill=BBEL,width=1)
    def head(d,dy=0):
        d.ellipse([26,8+dy,70,52+dy],fill=BFUR)
        for hx,fl in [(28,1),(60,-1)]:                                            # great curled horns
            d.ellipse([hx-4,2+dy,hx+10,18+dy],fill=HORN)
            d.ellipse([hx-4+fl*4,-4+dy,hx+10+fl*4,8+dy],fill=HORN)
            d.arc([hx-6,-4+dy,hx+12,20+dy],0,360,fill=HORND)
        d.polygon([(34,2+dy),(48,-6+dy),(62,2+dy),(56,6+dy),(40,6+dy)],fill=GOLD) # crown
        for cx in (38,48,58): d.ellipse([cx-2,-4+dy,cx+2,0+dy],fill=GEM)
        d.ellipse([38,30+dy,58,46+dy],fill=BFURD)                                  # snout
        d.point((44,36+dy),fill=EYE); d.point((52,36+dy),fill=EYE)
    def face_angry(d,dy=0):
        for ex in (36,60):
            d.ellipse([ex-4,20+dy,ex+4,28+dy],fill=YEL); d.rectangle([ex-1,23+dy,ex+1,25+dy],fill=EYE)
            d.line([(ex-6,17+dy),(ex+4,21+dy)] if ex==36 else [(ex-4,21+dy),(ex+6,17+dy)],fill=OUTLINE,width=2)
        d.arc([38,46+dy,58,58+dy],180,360,fill=OUTLINE)                            # frown
        d.polygon([(40,48+dy),(43,53+dy),(46,48+dy)],fill=TOOTH)
        d.polygon([(50,48+dy),(53,53+dy),(56,48+dy)],fill=TOOTH)
    def face_happy(d,dy=0):
        for ex in (36,60): d.arc([ex-4,20+dy,ex+4,28+dy],10,170,fill=OUTLINE)
        d.arc([40,44+dy,56,54+dy],0,180,fill=OUTLINE)
    def necklace(d,dy=0):
        d.arc([30,48+dy,66,70+dy],200,340,fill=GOLD)
        d.ellipse([43,62+dy,53,72+dy],fill=GEM); d.point((46,65+dy),fill=(255,200,230,255))
    def stink(d,x,y,big):
        r=5 if big else 3
        for ox,oy in [(0,0),(r,r-1),(-r,r),(0,r*2-1),(r+2,r*2),(-r-1,r*2+1)]:
            d.ellipse([x+ox-r,y+oy-r,x+ox+r,y+oy+r],fill=STINK)
            d.arc([x+ox-r,y+oy-r,x+ox+r,y+oy+r],20,200,fill=STINKD)
    def f_idle():
        im=cell(W,H);d=ImageDraw.Draw(im);torso(d,"down");head(d);face_angry(d);necklace(d)
        stink(d,12,38,False);stink(d,84,38,False);return outline(im,W,H)
    def f_attack():
        im=cell(W,H);d=ImageDraw.Draw(im);torso(d,"up");head(d,-2);face_angry(d,-2);necklace(d,-2)
        stink(d,10,24,True);stink(d,86,24,True);stink(d,48,4,True);return outline(im,W,H)
    def f_hurt():
        im=cell(W,H);d=ImageDraw.Draw(im);torso(d,"up");head(d,4);face_happy(d,4);necklace(d,4)
        for sx in (10,30,66,86): star(d,sx,10,3,YEL)
        return outline(im,W,H)
    return (W,H,[f_idle(),f_attack(),f_hurt()],["idle","attack","hurt"])

def boss_hogdog_frames():
    """The BIG HOG DOG. Throws yucky mushrooms. Wants to steal the babies. We hate him."""
    W,H=96,88
    def body(d,lean=0):
        d.ellipse([14+lean,30,90+lean,87],fill=HOG)                                # mass
        d.ellipse([30+lean,48,76+lean,87],fill=HOGL)                               # chest
        for px,py in [(24,40),(70,36),(50,30)]:                                    # shaggy patches
            d.ellipse([px+lean,py,px+14+lean,py+10],fill=HOGD)
        for lx in (26,62):                                                          # stumpy legs
            d.rectangle([lx+lean,78,lx+12+lean,87],fill=HOGD)
        d.ellipse([40,80,56,88],fill=HOGD)                                          # skull belt buckle
        d.ellipse([44,82,52,87],fill=TOOTH); d.point((46,84),fill=EYE); d.point((50,84),fill=EYE)
    def head(d,dx=0,dy=0,jaw=0):
        d.ellipse([34+dx,2+dy,86+dx,46+dy],fill=HOG)                                # head
        d.polygon([(38+dx,8+dy),(28+dx,-6+dy),(48+dx,4+dy)],fill=HOGD)              # torn ears
        d.polygon([(74+dx,6+dy),(86+dx,-8+dy),(86+dx,8+dy)],fill=HOGD)
        d.ellipse([58+dx,18+dy,90+dx,44+dy],fill=SNOUT)                              # big snout
        d.ellipse([76+dx,24+dy,82+dx,32+dy],fill=HOGD); d.ellipse([84+dx,24+dy,89+dx,32+dy],fill=HOGD)
        for ex in (44,58):
            d.ellipse([ex+dx-4,10+dy,ex+dx+4,18+dy],fill=YEL)
            d.rectangle([ex+dx-1,13+dy,ex+dx+1,15+dy],fill=EYE)
            d.line([(ex+dx-5,8+dy),(ex+dx+4,12+dy)] if ex==44 else [(ex+dx-4,12+dy),(ex+dx+5,8+dy)],fill=OUTLINE,width=2)
        if jaw:
            d.polygon([(58+dx,38+dy),(90+dx,40+dy),(86+dx,54+dy),(60+dx,48+dy)],fill=HOGD)  # open maw
            for tx in range(62,86,6):
                d.polygon([(tx+dx,40+dy),(tx+2+dx,46+dy),(tx+4+dx,40+dy)],fill=TOOTH)
            d.line([(66+dx,52+dy),(64+dx,60+dy)],fill=DROOL,width=2)                # drool
        else:
            d.line([(60+dx,40+dy),(84+dx,42+dy)],fill=OUTLINE,width=2)
            d.polygon([(62+dx,40+dy),(64+dx,36+dy),(66+dx,41+dy)],fill=TOOTH)        # underbite tusks
            d.polygon([(78+dx,42+dy),(80+dx,37+dy),(82+dx,42+dy)],fill=TOOTH)
    def arm(d,x,y,up):
        if up:
            d.ellipse([x-6,y-26,x+8,y+2],fill=HOG)
            d.ellipse([x-7,y-32,x+9,y-20],fill=HOGD)                                 # fist
        else:
            d.ellipse([x-6,y-2,x+8,y+22],fill=HOG)
    def f_idle():
        im=cell(W,H);d=ImageDraw.Draw(im);body(d);arm(d,16,52,False);head(d);return outline(im,W,H)
    def f_attack():
        im=cell(W,H);d=ImageDraw.Draw(im);body(d,2);arm(d,14,46,True);head(d,-2,-2,jaw=1)
        m=ImageDraw.Draw(im)                                                        # mushroom in fist
        m.ellipse([6,8,22,20],fill=MUSH); m.rectangle([11,18,17,26],fill=MUSHS)
        for px,py in [(9,11),(16,10)]: m.point((px,py),fill=MUSHS)
        return outline(im,W,H)
    def f_hurt():
        im=cell(W,H);d=ImageDraw.Draw(im);body(d,-2);arm(d,16,50,True);head(d,2,6)
        for ex in (44,58): d.line([(ex-3,16),(ex+5,12)],fill=OUTLINE,width=2)
        for sx in (8,28,72,90): star(d,sx,8,3,YEL)
        return outline(im,W,H)
    return (W,H,[f_idle(),f_attack(),f_hurt()],["idle","attack","hurt"])

# =====================================================================
#  GEAR (costume overlays worn on the swan) & FX & ITEMS
# =====================================================================
def gear_frames():
    W,H=28,28
    def goosefeet():
        im=cell(W,H);d=ImageDraw.Draw(im)
        for fx in (2,15):                                                            # GIANT goose feet
            d.polygon([(fx,18),(fx+11,18),(fx+13,24),(fx+9,23),(fx+7,25),(fx+4,23),(fx,24)],fill=FOOT)
            d.line([(fx+2,19),(fx+3,23)],fill=FOOTS,width=1); d.line([(fx+8,19),(fx+9,23)],fill=FOOTS,width=1)
        return outline(im,W,H)
    def visor():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rounded_rectangle([4,11,24,17],2,fill=STEELD)                              # laser visor
        d.rectangle([7,13,21,15],fill=CHERRY); d.point((9,14),fill=(255,180,180,255))
        return outline(im,W,H)
    def spoon(up):
        im=cell(W,H);d=ImageDraw.Draw(im)
        if up:
            d.line([(8,26),(18,8)],fill=WOODD,width=2)
            d.ellipse([14,0,26,12],fill=GOLD); d.ellipse([17,3,23,9],fill=(255,232,170,255))
        else:
            d.line([(6,10),(20,20)],fill=WOODD,width=2)
            d.ellipse([16,14,28,26],fill=GOLD); d.ellipse([19,17,25,23],fill=(255,232,170,255))
        return outline(im,W,H)
    def kirbycap():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([6,10,22,22],fill=PETAL); d.ellipse([8,12,20,18],fill=PINKL)        # round pink cap
        d.ellipse([18,8,24,14],fill=YEL); d.polygon([(20,8),(22,4),(24,8)],fill=YEL)  # lil star
        return outline(im,W,H)
    return (W,H,[goosefeet(),visor(),spoon(True),spoon(False),kirbycap()],
            ["goosefeet","visor","spoon_up","spoon_down","kirbycap"])

def fx_frames():
    W,H=16,16
    def fireball(ph):
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([2+ph,4,12+ph,14],fill=FIRE2); d.ellipse([4+ph,6,10+ph,12],fill=FIRE1)
        d.polygon([(2+ph,9),(-2+ph,5),(3+ph,6)],fill=FIRE3)
        return outline(im,W,H)
    def nut():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([4,6,12,14],fill=WOOD); d.polygon([(4,8),(8,2),(12,8)],fill=WOODD); d.point((8,10),fill=WOODD)
        return outline(im,W,H)
    def mushroom():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([2,3,14,11],fill=MUSH); d.rectangle([6,9,10,14],fill=MUSHS)
        for px,py in [(5,5),(10,4),(8,7)]: d.point((px,py),fill=MUSHS)
        d.point((6,12),fill=EYE); d.point((9,12),fill=EYE)                           # it is yucky AND alive
        return outline(im,W,H)
    def stinkpuff():
        im=cell(W,H);d=ImageDraw.Draw(im)
        for ox,oy,r in [(5,7,4),(10,6,3),(8,11,3),(12,10,2)]:
            d.ellipse([ox-r,oy-r,ox+r,oy+r],fill=STINK); d.arc([ox-r,oy-r,ox+r,oy+r],20,200,fill=STINKD)
        return outline(im,W,H)
    def pinkring(big):
        im=cell(W,H);d=ImageDraw.Draw(im)
        r=7 if big else 4
        d.ellipse([8-r,8-r,8+r,8+r],outline=GLOW,width=2)
        if big:
            for a in range(0,360,45):
                d.point((8+int(r*1.3*math.cos(a*math.pi/180)),8+int(r*1.3*math.sin(a*math.pi/180))),fill=PINKL)
        return im
    def laserbeam():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,6,15,9],fill=CHERRY); d.rectangle([0,7,15,8],fill=(255,170,190,255))
        return im
    def lasertip():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([4,3,14,13],fill=CHERRY); d.ellipse([6,5,12,11],fill=(255,190,200,255)); star(d,9,8,3,(255,240,240,255))
        return im
    def splash(ph):
        im=cell(W,H);d=ImageDraw.Draw(im)
        for i,(x,dy) in enumerate([(2,4),(6,0),(10,2),(14,5)]):
            d.line([(x,12),(x,5+dy+ph)],fill=CREST,width=1); d.point((x,4+dy+ph),fill=WATERC)
        return im
    def sparkle(big):
        im=cell(W,H);d=ImageDraw.Draw(im)
        r=5 if big else 3
        d.line([(8-r,8),(8+r,8)],fill=LAMP,width=1); d.line([(8,8-r),(8,8+r)],fill=LAMP,width=1)
        d.point((8,8),fill=(255,255,255,255))
        return im
    def feather():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([4,4,11,13],fill=WHITE); d.line([(7,4),(9,13)],fill=LAV,width=1)
        return outline(im,W,H)
    def poof(big):
        im=cell(W,H);d=ImageDraw.Draw(im)
        pts=[(4,8),(8,4),(12,8),(8,12)] if big else [(6,8),(8,6),(10,8),(8,10)]
        for x,y in pts:
            r=3 if big else 2; d.ellipse([x-r,y-r,x+r,y+r],fill=CLOUD)
        return im
    def bubble():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([4,4,12,12],outline=CREST,width=1); d.point((6,6),fill=CREST)
        return im
    def moonspark():
        im=cell(W,H);d=ImageDraw.Draw(im); star(d,8,8,5,MOONC); d.point((8,8),fill=(255,255,255,255))
        return im
    fns=[fireball(0),fireball(2),nut(),mushroom(),stinkpuff(),pinkring(False),pinkring(True),
         laserbeam(),lasertip(),splash(0),splash(2),sparkle(False),sparkle(True),feather(),
         poof(False),poof(True),bubble(),moonspark()]
    labs=["fireball1","fireball2","nut","mushroom","stink","ring1","ring2",
          "beam","beamtip","splash1","splash2","spark1","spark2","feather",
          "poof1","poof2","bubble","moonspark"]
    return (W,H,fns,labs)

def items_frames():
    W,H=16,16
    def moon():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([2,2,14,14],fill=MOONC)
        for px,py in [(6,5),(10,8),(7,10)]: d.ellipse([px-1,py-1,px+1,py+1],fill=MOOND)
        return outline(im,W,H)
    def beads():
        im=cell(W,H);d=ImageDraw.Draw(im)
        cols=[BEAD1,BEAD2,BEAD3]
        for i in range(8):
            a=math.pi*(0.1+0.8*i/7)
            x,y=8+6*math.cos(a),3+9*math.sin(a)
            c=cols[i%3]; d.ellipse([x-2,y-2,x+2,y+2],fill=c)
        d.ellipse([5,10,11,16],fill=GOLD); d.point((7,12),fill=EYE); d.point((9,12),fill=EYE)
        d.arc([6,12,10,15],0,180,fill=EYE)                                          # smiley medal
        return outline(im,W,H)
    def icon_fire():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.polygon([(8,1),(12,7),(11,13),(5,13),(4,7)],fill=FIRE2); d.ellipse([6,7,10,13],fill=FIRE1)
        return outline(im,W,H)
    def icon_pink():
        im=cell(W,H);d=ImageDraw.Draw(im); heart(d,2,3,12,11,GLOW); d.point((6,6),fill=PINKL)
        return outline(im,W,H)
    def icon_tree():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([7,9,9,14],fill=WOODD); d.ellipse([2,1,14,11],fill=FGN); d.ellipse([4,3,9,8],fill=GRASS)
        return outline(im,W,H)
    def icon_kirby():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([2,3,14,15],fill=PETAL); d.point((6,8),fill=EYE); d.point((10,8),fill=EYE)
        d.arc([6,9,10,12],0,180,fill=EYE); d.ellipse([3,10,6,13],fill=CATP); d.ellipse([10,10,13,13],fill=CATP)
        return outline(im,W,H)
    def pickup_mermaid():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.polygon([(5,2),(11,2),(9,9),(7,9)],fill=MTAIL)
        d.polygon([(8,9),(3,14),(8,12)],fill=MFIN); d.polygon([(8,9),(13,14),(8,12)],fill=MFIN)
        return outline(im,W,H)
    def pickup_goosefeet():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.polygon([(2,6),(10,6),(13,11),(9,10),(7,12),(4,10),(1,11)],fill=FOOT)
        d.line([(4,7),(5,10)],fill=FOOTS,width=1)
        return outline(im,W,H)
    def pickup_laser():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rounded_rectangle([2,5,14,11],2,fill=STEELD); d.rectangle([4,7,12,9],fill=CHERRY)
        return outline(im,W,H)
    def pickup_spoon():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.line([(3,13),(10,5)],fill=WOODD,width=2); d.ellipse([8,1,15,8],fill=GOLD)
        return outline(im,W,H)
    def baby_icon():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([3,7,12,14],fill=WHITE); d.ellipse([7,2,13,8],fill=WHITE)
        d.polygon([(12,4),(15,5),(12,6)],fill=BEAK); d.point((10,4),fill=EYE)
        return outline(im,W,H)
    def charm_icon():
        im=cell(W,H);d=ImageDraw.Draw(im); heart(d,3,3,10,10,CHERRY); d.point((7,6),fill=PINKL)
        return outline(im,W,H)
    def phone():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rounded_rectangle([4,1,12,15],2,fill=(220,225,240,90))                     # the INVISIBLE phone
        d.rectangle([6,3,10,10],fill=(255,255,255,50))
        d.ellipse([6,11,10,14],fill=GLOW)                                            # the unvisible button
        return im
    fns=[moon(),beads(),icon_fire(),icon_pink(),icon_tree(),icon_kirby(),
         pickup_mermaid(),pickup_goosefeet(),pickup_laser(),pickup_spoon(),
         baby_icon(),charm_icon(),phone()]
    labs=["moon","beads","icon_fire","icon_pink","icon_tree","icon_kirby",
          "pickup_mermaid","pickup_goosefeet","pickup_laser","pickup_spoon",
          "baby_icon","charm_icon","phone"]
    return (W,H,fns,labs)

# =====================================================================
#  TILES 2 (world tilesets) + HUB + ELEVATOR
# =====================================================================
def tiles2_frames():
    W,H=16,16
    def water_surf(ph):
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,2,15,15],fill=WATERC)
        for x in range(0,16,4):
            d.point((x+ph,2),fill=CREST); d.line([(x+ph,3),(x+2+ph,3)],fill=(170,220,245,255))
        d.point((4+ph,8),fill=(140,200,235,255)); d.point((11-ph,12),fill=(140,200,235,255))
        return im
    def water_deep():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,0,15,15],fill=WATERD)
        for x,y in [(3,4),(10,9),(6,13)]: d.point((x,y),fill=WATERC)
        return im
    def rock_top():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,4,15,15],fill=ROCK)
        d.rectangle([0,4,15,6],fill=TEALG)
        for x in range(0,16,3): d.line([(x,4),(x,2)],fill=TEALG,width=1); d.point((x,2),fill=TEALGD)
        for x,y in [(4,9),(11,12),(7,14)]: d.point((x,y),fill=ROCKD)
        return im
    def rock_fill():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,0,15,15],fill=ROCK)
        for x,y in [(3,3),(9,6),(12,11),(5,12),(1,8),(14,2)]: d.point((x,y),fill=ROCKD)
        d.ellipse([6,8,9,11],fill=ROCKD)
        return im
    def seaweed(ph):
        im=cell(W,H);d=ImageDraw.Draw(im)
        for bx,h0 in [(4,3),(9,1),(13,5)]:
            for y in range(15,h0,-2):
                off=int(math.sin((y+ph*3)/3)*1.5)
                d.point((bx+off,y),fill=TEALGD); d.point((bx+off+1,y),fill=TEALG)
        return im
    def coral():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.line([(8,15),(8,9)],fill=CANDYD,width=2)
        d.line([(8,11),(4,6)],fill=CANDYD,width=2); d.line([(8,12),(12,8)],fill=CANDYD,width=2)
        for px,py in [(4,5),(12,7),(8,8)]: d.ellipse([px-1,py-2,px+2,py+1],fill=CANDY)
        return outline(im,W,H)
    def chest(open_):
        im=cell(W,H);d=ImageDraw.Draw(im)
        if open_:
            d.rectangle([2,8,14,15],fill=WOOD); d.rectangle([2,8,14,9],fill=WOODD)
            d.rectangle([1,2,15,6],fill=WOODD)
            d.rectangle([7,9,9,11],fill=GOLD)
            for px,py in [(5,7),(11,7),(8,6)]: star(d,px,py,2,GOLD)
        else:
            d.rectangle([2,5,14,15],fill=WOOD)
            d.arc([2,1,14,11],180,360,fill=WOODD); d.rectangle([2,5,14,7],fill=WOODD)
            d.rectangle([7,9,9,12],fill=GOLD); d.point((8,10),fill=GEM)
        return outline(im,W,H)
    def cloud_top():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,8,15,15],fill=CLOUD)
        for x in (2,7,12): d.ellipse([x-3,4,x+4,12],fill=CLOUD)
        for x in (4,10): d.point((x,12),fill=CLOUDD)
        return im
    def cloud_fill():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,0,15,15],fill=CLOUD)
        for x,y in [(3,5),(10,3),(13,10),(6,12)]: d.point((x,y),fill=CLOUDD)
        return im
    def candy_top():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,4,15,15],fill=WAFER)
        d.rectangle([0,4,15,7],fill=CANDY)
        for x in range(0,16,4): d.line([(x,4),(x+2,7)],fill=CANDYD,width=1)
        for x,y in [(4,10),(11,12)]: d.point((x,y),fill=WAFERD)
        return im
    def candy_fill():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,0,15,15],fill=WAFER)
        for y in (3,8,13): d.line([(0,y),(15,y)],fill=WAFERD,width=1)
        d.point((5,5),fill=CANDYD); d.point((12,10),fill=CANDYD)
        return im
    def gumdrop():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.ellipse([3,5,13,15],fill=MINT); d.ellipse([5,7,9,11],fill=(200,245,220,255))
        for px,py in [(6,13),(10,8)]: d.point((px,py),fill=(255,255,255,200))
        return outline(im,W,H)
    def spring(ext):
        im=cell(W,H);d=ImageDraw.Draw(im)
        if ext:
            d.rectangle([3,1,13,4],fill=STEELD)
            for y in (6,9,12): d.line([(4,y),(12,y-2)],fill=STEELDD,width=1)
        else:
            d.rectangle([3,7,13,10],fill=STEELD)
            for y in (12,14): d.line([(4,y),(12,y-1)],fill=STEELDD,width=1)
        d.rectangle([2,14,14,15],fill=STEELDD)
        return outline(im,W,H)
    def night_grass():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,5,15,15],fill=NDIRT); d.rectangle([0,5,15,7],fill=NGRASS)
        for x in range(0,16,3): d.line([(x,5),(x,2)],fill=NGRASS,width=1); d.point((x,2),fill=NGRASSD)
        for x in (3,9,13): d.point((x,10),fill=NDIRTD)
        d.point((6,3),fill=MOONC)
        return im
    def night_dirt():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,0,15,15],fill=NDIRT)
        for x,y in [(3,4),(9,2),(12,9),(5,11),(1,8)]: d.point((x,y),fill=NDIRTD)
        return im
    def fire(ph):
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.polygon([(8,1+ph),(13,8),(12,15),(4,15),(3,8)],fill=FIRE2)
        d.polygon([(8,5+ph),(11,10),(10,15),(6,15),(5,10)],fill=FIRE1)
        d.point((8,12),fill=(255,255,230,255))
        if ph: d.point((3,4),fill=FIRE1); d.point((13,3),fill=FIRE1)
        return outline(im,W,H)
    def tree_trunk():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([4,0,11,15],fill=WOOD)
        d.line([(6,0),(6,15)],fill=WOODD,width=1); d.line([(9,3),(9,12)],fill=WOODD,width=1)
        return im
    def tree_leaves():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,0,15,15],fill=FGN)
        for x,y in [(3,3),(10,5),(6,9),(13,12),(2,13)]: d.ellipse([x-2,y-2,x+2,y+2],fill=GRASS)
        d.point((8,4),fill=FGND); d.point((4,10),fill=FGND)
        return im
    def mush_block():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([1,1,14,14],fill=MUSH)
        d.rectangle([1,1,14,4],fill=MUSHS); d.rectangle([3,3,12,12],outline=MUSHD)
        d.point((6,8),fill=EYE); d.point((9,8),fill=EYE); d.arc([5,9,10,12],0,180,fill=EYE)
        return outline(im,W,H)
    def fence():
        im=cell(W,H);d=ImageDraw.Draw(im)
        for x in (2,8,14): d.rectangle([x-1,6,x,15],fill=WOODD)
        d.rectangle([0,8,15,9],fill=WOOD); d.rectangle([0,12,15,13],fill=WOOD)
        return outline(im,W,H)
    def flower():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.line([(8,15),(8,9)],fill=GRASSD,width=1)
        for ax,ay in [(0,-3),(3,0),(0,3),(-3,0)]: d.ellipse([8+ax-2,7+ay-2,8+ax+2,7+ay+2],fill=PETAL)
        d.ellipse([6,5,10,9],fill=YEL)
        return outline(im,W,H)
    def sign():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([7,8,9,15],fill=WOODD)
        d.polygon([(2,2),(11,2),(14,5),(11,8),(2,8)],fill=WOOD)
        d.line([(4,5),(9,5)],fill=WOODD,width=1)
        return outline(im,W,H)
    fns=[water_surf(0),water_surf(2),water_deep(),rock_top(),rock_fill(),seaweed(0),seaweed(1),
         coral(),chest(False),chest(True),cloud_top(),cloud_fill(),candy_top(),candy_fill(),
         gumdrop(),spring(False),spring(True),night_grass(),night_dirt(),fire(0),fire(2),
         tree_trunk(),tree_leaves(),mush_block(),fence(),flower(),sign()]
    labs=["water_surf1","water_surf2","water_deep","rock_top","rock_fill","seaweed1","seaweed2",
          "coral","chest_closed","chest_open","cloud_top","cloud_fill","candy_top","candy_fill",
          "gumdrop","spring1","spring2","night_grass","night_dirt","fire1","fire2",
          "tree_trunk","tree_leaves","mush_block","fence","flower","sign"]
    return (W,H,fns,labs)

def hub_frames():
    W,H=16,16
    def wall():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,0,15,15],fill=WOOD)
        for y in (4,9,14): d.line([(0,y),(15,y)],fill=WOODD,width=1)
        d.point((4,2),fill=WOODD); d.point((11,7),fill=WOODD)
        return im
    def paper():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,0,15,15],fill=PAPER)
        for x,y in [(4,4),(12,4),(4,12),(12,12)]: heart(d,x-2,y-2,4,4,PAPERD)
        return im
    def floor():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,0,15,15],fill=WOODD)
        d.rectangle([0,0,15,3],fill=WOOD)
        for x in (5,11): d.line([(x,4),(x,15)],fill=(100,64,40,255),width=1)
        return im
    def window():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([1,1,14,14],fill=WOODD)
        d.rectangle([3,3,12,12],fill=LAMP)
        d.line([(7,3),(7,12)],fill=WOODD,width=1); d.line([(3,7),(12,7)],fill=WOODD,width=1)
        d.point((5,5),fill=(255,255,255,255))
        return im
    def door():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rounded_rectangle([2,0,13,15],3,fill=WOODD)
        d.rounded_rectangle([4,2,11,15],2,fill=WOOD)
        d.point((10,8),fill=GOLD)
        return im
    def bed_l():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([1,8,15,13],fill=BOX); d.rectangle([1,6,6,9],fill=CLOUD)
        d.rectangle([0,8,1,15],fill=WOODD); d.rectangle([1,13,15,14],fill=WOOD)
        return outline(im,W,H)
    def bed_r():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,8,14,13],fill=BOX)
        for x in (3,8): d.line([(x,9),(x+3,12)],fill=PINKL,width=1)
        d.rectangle([14,8,15,15],fill=WOODD); d.rectangle([0,13,14,14],fill=WOOD)
        return outline(im,W,H)
    def shelf():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([1,2,14,14],fill=SHELF)
        for y in (5,9,13): d.rectangle([2,y,13,y+1],fill=WOODD)
        for bx,by,c in [(3,3,BOX),(6,3,MINT),(9,3,GOLD),(4,7,GLOW),(8,7,WATERC),(11,7,PETAL)]:
            d.rectangle([bx,by,bx+2,by+2 if by==3 else by+2],fill=c)
        return outline(im,W,H)
    def lamp():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([7,8,8,15],fill=WOODD)
        d.polygon([(4,8),(11,8),(10,2),(5,2)],fill=GOLD); d.ellipse([6,4,9,8],fill=LAMP)
        return outline(im,W,H)
    def plant():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.polygon([(5,11),(10,11),(9,15),(6,15)],fill=BOX)
        for ang in (-2,0,2):
            d.line([(8,11),(8+ang*2,5)],fill=GRASSD,width=1); d.ellipse([8+ang*2-1,3,8+ang*2+2,6],fill=GRASS)
        return outline(im,W,H)
    def shaft():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rectangle([0,0,15,15],fill=(60,46,66,255))
        for x in (2,13): d.rectangle([x,0,x+1,15],fill=STEELDD)
        for y in range(0,16,4): d.point((7,y),fill=STEELDD); d.point((8,y+2),fill=STEELDD)
        return im
    def roofL():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.polygon([(15,0),(15,15),(0,15)],fill=(120,60,90,255))
        d.line([(2,14),(13,3)],fill=(160,90,120,255),width=1)
        return im
    def roofR():
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.polygon([(0,0),(0,15),(15,15)],fill=(120,60,90,255))
        d.line([(2,3),(13,14)],fill=(160,90,120,255),width=1)
        return im
    fns=[wall(),paper(),floor(),window(),door(),bed_l(),bed_r(),shelf(),lamp(),plant(),shaft(),roofL(),roofR()]
    labs=["wall","paper","floor","window","door","bed_l","bed_r","shelf","lamp","plant","shaft","roof_l","roof_r"]
    return (W,H,fns,labs)

def elevator_frames():
    W,H=24,32
    def car(open_):
        im=cell(W,H);d=ImageDraw.Draw(im)
        d.rounded_rectangle([1,1,22,30],2,fill=GOLD)
        d.rectangle([3,4,20,26],fill=(90,70,50,255) if open_ else WOODD)
        if not open_:
            d.line([(11,4),(11,26)],fill=GOLD,width=1)
            d.rectangle([5,8,9,14],fill=LAMP); d.rectangle([13,8,18,14],fill=LAMP)
        d.rectangle([9,0,14,2],fill=STEELDD)
        d.point((11,28),fill=GEM)
        return outline(im,W,H)
    return (W,H,[car(False),car(True)],["closed","open"])

# =====================================================================
#  SKIES (vertical gradients) & PARALLAX STRIPS
# =====================================================================
def grad_sky(stops):
    """stops: [(y, (r,g,b)), ...] -> 4x240 vertical gradient"""
    W,H=4,240
    im=cell(W,H); px=im.load()
    for y in range(H):
        lo=stops[0]; hi=stops[-1]
        for i in range(len(stops)-1):
            if stops[i][0]<=y<=stops[i+1][0]: lo,hi=stops[i],stops[i+1]; break
        t=0 if hi[0]==lo[0] else (y-lo[0])/(hi[0]-lo[0]); t=max(0,min(1,t))
        c=tuple(int(lo[1][k]+(hi[1][k]-lo[1][k])*t) for k in range(3))+(255,)
        for x in range(W): px[x,y]=c
    return im

SKIES={
  "sky_lake":  [(0,(98,62,128)),(70,(196,98,108)),(150,(244,158,96)),(210,(252,212,128)),(239,(252,226,150))],
  "sky_night": [(0,(16,14,44)),(90,(44,32,84)),(180,(88,56,124)),(239,(124,80,148))],
  "sky_under": [(0,(10,52,74)),(90,(22,96,116)),(180,(34,138,148)),(239,(60,176,168))],
  "sky_candy": [(0,(168,110,190)),(80,(238,150,190)),(170,(252,200,190)),(239,(255,234,200))],
  "sky_fever": [(0,(96,16,80)),(70,(180,36,96)),(150,(240,100,70)),(239,(252,180,90))],
  "sky_hub":   [(0,(120,80,140)),(90,(210,120,120)),(180,(248,180,110)),(239,(252,222,150))],
  "sky_finale":[(0,(50,12,70)),(80,(140,30,110)),(160,(220,80,120)),(239,(250,150,110))],
}

def strip(name):
    """192x110 horizontally-tileable parallax strip, transparent background."""
    W,H=192,110
    im=cell(W,H); d=ImageDraw.Draw(im)
    def hills(base,amp,per,col,ph=0):
        for x in range(W):
            y=base+int(amp*math.sin((x+ph)*2*math.pi*per/W))
            d.line([(x,y),(x,H)],fill=col)
    if name=="par_lake":
        d.ellipse([130,28,166,64],fill=(252,222,140,255))                         # the low sun
        d.ellipse([136,34,160,58],fill=(255,240,180,255))
        hills(64,10,2,(150,84,120,255),20); hills(74,8,3,(120,64,104,255),90)
        # the impossibly tall house, far away
        d.rectangle([28,18,44,70],fill=(96,52,92,255))
        d.polygon([(24,20),(48,20),(36,6)],fill=(80,40,76,255))
        for wy in range(26,62,9): d.rectangle([33,wy,38,wy+4],fill=(252,222,140,255))
        for x in range(0,W,7): d.line([(x,84+(x//7)%3*5),(x+3,84+(x//7)%3*5)],fill=(252,216,130,140))  # lake glints
    elif name=="par_night":
        d.ellipse([120,10,168,58],fill=MOONC); d.ellipse([130,18,150,38],fill=MOOND)
        d.ellipse([152,40,160,48],fill=MOOND)
        for sx,sy in [(12,12),(40,30),(70,8),(96,22),(176,30),(58,44),(20,52),(110,40),(150,70),(86,58)]:
            d.point((sx,sy),fill=(230,230,255,255))
            if sx%3==0: d.point((sx+1,sy),fill=(160,160,220,255))
        hills(70,12,2,(52,36,88,255),50); hills(82,8,3,(38,26,66,255))
    elif name=="par_under":
        for bx in (30,80,130,170):                                                 # sunbeams
            d.polygon([(bx,0),(bx+16,0),(bx+34,H),(bx+6,H)],fill=(200,240,230,28))
        for sx,h0 in [(10,40),(26,60),(60,30),(100,50),(120,36),(150,56),(184,44)]:
            for y in range(H,h0,-3):
                off=int(math.sin(y/6+sx)*2)
                d.line([(sx+off,y),(sx+off+2,y)],fill=(20,80,84,200))              # seaweed forest
        for fx,fy in [(50,70),(90,84),(140,76)]: d.ellipse([fx,fy,fx+3,fy+2],fill=(16,70,76,255))
    elif name=="par_candy":
        for cx,cy,r in [(20,70,16),(60,50,20),(110,76,14),(150,44,22),(184,70,12)]:
            for ox in (-r,0,r):
                d.ellipse([cx+ox-r,cy-r//2,cx+ox+r,cy+r],fill=(252,228,240,210))
        d.line([(96,30),(96,80)],fill=(238,120,160,255),width=3)                    # far lollipop
        d.ellipse([84,12,108,36],fill=(250,170,200,255))
        d.arc([84,12,108,36],0,300,fill=(255,255,255,255))
    elif name=="par_fever":
        for i in range(10):                                                         # mad rays
            a0=i*36; col=(232,70,110,70) if i%2 else (250,160,80,70)
            d.polygon([(96,40),(96+200*math.cos(math.radians(a0)),40+200*math.sin(math.radians(a0))),
                       (96+200*math.cos(math.radians(a0+18)),40+200*math.sin(math.radians(a0+18)))],fill=col)
        d.rectangle([150,40,170,90],fill=(70,20,60,255))                            # warped castle
        d.polygon([(146,44),(174,44),(160,22)],fill=(56,14,48,255))
        for wy in (52,66,80): d.rectangle([157,wy,163,wy+5],fill=(250,120,90,255))
        hills(92,8,4,(96,24,72,255))
    elif name=="par_hub":
        hills(60,8,2,(170,100,110,255),30); hills(72,7,3,(140,80,100,255))
        for x in range(0,W,9): d.line([(x,88),(x+4,88)],fill=(252,216,130,150))
        for sx in (40,120):                                                          # distant swans on the lake
            d.ellipse([sx,82,sx+6,86],fill=(252,240,230,255)); d.point((sx+5,80),fill=(252,240,230,255))
    elif name=="par_finale":
        for i,(by,col) in enumerate([(20,(110,20,90,255)),(44,(150,40,100,255)),(68,(190,70,110,255))]):
            for x in range(W):
                y=by+int(6*math.sin((x+i*30)*2*math.pi*3/W))
                d.line([(x,y),(x,y+16)],fill=col)
        for sx,sy in [(30,10),(80,6),(140,14),(170,4)]: d.point((sx,sy),fill=(255,220,230,255))
    return im

def wisp_frames():
    """a floating dream-wisp: bobs and drifts toward you (stompable)."""
    W,H=18,18
    def body(d,t):
        d.ellipse([4,3,15,14],fill=(196,214,244,255))        # round body
        d.ellipse([6,5,12,10],fill=(234,242,253,255))        # shine
        d.rectangle([7,8,8,9],fill=EYE); d.rectangle([11,8,12,9],fill=EYE)   # sleepy eyes
        d.point((7,8),fill=EYEW); d.point((11,8),fill=EYEW)
        d.arc([8,10,12,13],10,170,fill=(120,140,180,255))    # tiny mouth
        if t:
            d.polygon([(5,12),(8,12),(6,17)],fill=(176,198,236,255))
            d.polygon([(10,13),(13,13),(12,16)],fill=(176,198,236,255))
        else:
            d.polygon([(6,13),(9,13),(8,16)],fill=(176,198,236,255))
            d.polygon([(11,12),(14,12),(13,17)],fill=(176,198,236,255))
    def mk(t): im=cell(W,H); body(ImageDraw.Draw(im),t); return outline(im,W,H)
    return (W,H,[mk(0),mk(1)],["bob1","bob2"])

# =====================================================================
#  BUILD + MANIFEST MERGE + PREVIEW
# =====================================================================
REGISTRY2={
 "charmgirl":charmgirl_frames,"trex":trex_frames,"mecha":mecha_frames,
 "babyswan":babyswan_frames,"alligator":alligator_frames,"fish":fish_frames,"wisp":wisp_frames,
 "turtles":turtles_frames,"boss_papa":boss_papa_frames,"boss_hogdog":boss_hogdog_frames,
 "gear":gear_frames,"fx":fx_frames,"items":items_frames,
 "tiles2":tiles2_frames,"hub":hub_frames,"elevator":elevator_frames,
}

manifest=json.load(open(f"{OUT}/manifest.json"))
rows=[]
for name,fn in REGISTRY2.items():
    w,h,frames,labels=fn()
    sheet=Image.new("RGBA",(w*len(frames),h),T)
    for i,f in enumerate(frames): sheet.paste(f,(i*w,0),f)
    sheet.save(f"{OUT}/{name}.png")
    manifest[name]={"frame_w":w,"frame_h":h,"frames":labels,"file":f"assets/{name}.png"}
    rows.append((name,w,h,frames,labels))

for name,stops in SKIES.items():
    im=grad_sky(stops); im.save(f"{OUT}/{name}.png")
    manifest[name]={"frame_w":4,"frame_h":240,"frames":["g"],"file":f"assets/{name}.png"}
for name in ["par_lake","par_night","par_under","par_candy","par_fever","par_hub","par_finale"]:
    im=strip(name); im.save(f"{OUT}/{name}.png")
    manifest[name]={"frame_w":192,"frame_h":110,"frames":["s"],"file":f"assets/{name}.png"}
    rows.append((name,192,110,[im],["s"]))

json.dump(manifest,open(f"{OUT}/manifest.json","w"),indent=2)

S=3; pad=12
pw=max((w*len(fr))*S for _,w,h,fr,_ in rows)+pad*2
ph=sum(h*S for _,w,h,fr,_ in rows)+pad*(len(rows)+1)
prev=Image.new("RGBA",(pw,ph),(27,23,38,255)); pd=ImageDraw.Draw(prev); y=pad
for name,w,h,frames,labels in rows:
    x=pad
    for f,lab in zip(frames,labels):
        big=f.resize((w*S,h*S),Image.NEAREST); prev.paste(big,(x,y),big)
        pd.rectangle([x,y,x+w*S-1,y+h*S-1],outline=(70,60,90,255)); pd.text((x+3,y+3),lab,fill=(210,200,228,255)); x+=w*S+6
    pd.text((x+4,y+4),f"<- {name} {w}x{h}",fill=(150,200,150,255)); y+=h*S+pad
prev.save(f"{OUT}/_preview2.png")
print("forge2 complete:",len(rows),"sheets;",len(manifest),"manifest entries")
