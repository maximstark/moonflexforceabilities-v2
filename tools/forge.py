"""
MoonFlexForceAbilities — ASSET FORGE  (v2, full vertical-slice roster)
Run:  python forge.py  ->  assets/*.png + assets/manifest.json + assets/_preview.png
Animations (swan, mermaid, boss, frog, cockroach, dino) are sprite sheets:
frames laid out left-to-right at a fixed cell size.
Atlases (tiles, hud) use the same layout; each "frame" label is a named cell.
To upgrade art for v2: redraw any PNG at the SAME cell size; no code changes.
"""
from PIL import Image, ImageDraw
import numpy as np, json, os, math

OUT = "assets"; os.makedirs(OUT, exist_ok=True)
T = (0, 0, 0, 0); OUTLINE = (38, 26, 53, 255)

WHITE=(245,244,250,255); LAV=(201,187,226,255); LAV2=(170,152,202,255)
BEAK=(240,150,50,255); BEAKS=(201,110,30,255); FOOT=(236,140,45,255); FOOTS=(193,104,28,255)
EYE=(30,20,40,255); EYEW=(245,245,250,255)
FGN=(110,182,74,255); FGND=(70,132,46,255); FBELLY=(214,236,170,255)
RBR=(132,86,46,255); RBRD=(92,56,28,255); RHI=(172,122,70,255)
DGN=(96,176,86,255); DGND=(62,122,56,255); DBELLY=(212,228,162,255); SPIKE=(236,122,152,255)
MTAIL=(224,120,182,255); MTAILD=(184,80,144,255); MFIN=(246,172,212,255); PETAL=(246,140,180,255); YEL=(248,206,80,255)
BFUR=(150,110,148,255); BFURD=(112,80,112,255); BBEL=(202,162,124,255); HORN=(186,154,94,255); HORND=(140,108,58,255)
STINK=(150,202,96,255); STINKD=(108,164,66,255); GOLD=(236,200,82,255); GEM=(234,92,150,255); TOOTH=(248,248,240,255)
GRASS=(122,182,82,255); GRASSD=(82,140,56,255); DIRT=(132,90,64,255); DIRTD=(96,62,44,255); STONE=(120,104,128,255)
HRT=(226,72,112,255); HRTD=(150,40,70,255); POP=(238,236,228,255); BOX=(222,86,120,255); CHERRY=(220,70,90,255)

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

def swan_frames():
    W,H=40,36
    HI=(255,255,255,255); BLUSH=(247,176,198,255)
    def neck(d,dx=0,dy=0,low=0):
        p0=(22,18+low);p1=(24,6+low);p2=(31+dx,5+dy+low)
        for t in [i/28 for i in range(29)]:
            x=(1-t)**2*p0[0]+2*(1-t)*t*p1[0]+t*t*p2[0]
            y=(1-t)**2*p0[1]+2*(1-t)*t*p1[1]+t*t*p2[1]
            d.ellipse([x-2,y-2,x+2,y+2],fill=WHITE)
            d.point((x-1,y),fill=HI)                                 # soft sheen down the neck
    def body(d,low=0):
        d.ellipse([5,17+low,31,31+low],fill=WHITE); d.ellipse([7,24+low,30,32+low],fill=LAV)
        d.ellipse([10,27+low,27,32+low],fill=LAV2); d.polygon([(7,18+low),(3,13+low),(10,19+low)],fill=WHITE)
    def head(d,dx=0,dy=0,low=0,blink=False):
        d.ellipse([28+dx,1+dy+low,37+dx,9+dy+low],fill=WHITE)
        d.ellipse([29+dx,2+dy+low,33+dx,5+dy+low],fill=HI)              # forehead shine
        d.polygon([(36+dx,4+dy+low),(40+dx,5+dy+low),(36+dx,7+dy+low)],fill=BEAK)
        d.point((38+dx,5+dy+low),fill=BEAKS)
        d.ellipse([30+dx,6+dy+low,32+dx,8+dy+low],fill=BLUSH)           # rosy cheek
        if blink:
            d.line([(31+dx,4+dy+low),(34+dx,4+dy+low)],fill=EYE,width=1)
        else:
            d.rectangle([32+dx,3+dy+low,33+dx,4+dy+low],fill=EYE)
            d.point((33+dx,3+dy+low),fill=EYEW)                        # eye catchlight
    def wing(d,low=0):
        d.ellipse([9,18+low,26,28+low],fill=WHITE)
        for x in [13,17,21]: d.line([(x,20+low),(x+3,26+low)],fill=LAV,width=1)
        d.line([(11,22+low),(24,22+low)],fill=LAV,width=1)
        d.line([(11,20+low),(23,20+low)],fill=HI)                      # wing top highlight
    def leg(d,x,fx=0,lift=0):
        d.line([(x,30),(x,33-lift)],fill=FOOT,width=1)
        d.line([(x-2+fx,33-lift),(x+2+fx,33-lift)],fill=FOOT,width=1); d.point((x+fx,33-lift),fill=FOOTS)
    def f_idle():
        im=cell(W,H);d=ImageDraw.Draw(im);body(d);leg(d,15);leg(d,20);neck(d);wing(d);head(d);return outline(im,W,H)
    def f_blink():
        im=cell(W,H);d=ImageDraw.Draw(im);body(d);leg(d,15);leg(d,20);neck(d);wing(d);head(d,blink=True);return outline(im,W,H)
    def f_walk(sw,low=0):
        im=cell(W,H);d=ImageDraw.Draw(im);body(d)
        (leg(d,14,-2,0),leg(d,21,2,2)) if sw else (leg(d,14,2,2),leg(d,21,-2,0))
        neck(d,sw,-sw+low);wing(d,low);head(d,sw,-sw+low);return outline(im,W,H)
    def f_jump():
        im=cell(W,H);d=ImageDraw.Draw(im);body(d)
        d.line([(15,31),(13,33)],fill=FOOT,width=1);d.line([(20,31),(22,33)],fill=FOOT,width=1)
        d.ellipse([7,10,20,22],fill=WHITE);d.ellipse([18,12,30,22],fill=WHITE)
        for x in [11,15,22,26]: d.line([(x,13),(x,19)],fill=LAV,width=1)
        neck(d,1,-2);head(d,1,-2);return outline(im,W,H)
    def f_swim(bob):
        im=cell(W,H);d=ImageDraw.Draw(im);body(d,low=3+bob);wing(d,low=3+bob);neck(d,low=bob);head(d,low=bob)
        for wx in (4,32): d.line([(wx,33),(wx+4,33)],fill=LAV2,width=1)
        return outline(im,W,H)
    return (W,H,[f_idle(),f_blink(),f_walk(True),f_walk(False),f_walk(True,1),f_walk(False,1),f_jump(),f_swim(0),f_swim(2)],
            ["idle","blink","walk1","walk2","walk3","walk4","jump","swim1","swim2"])

def mermaid_frames():
    W,H=40,40
    def upper(d):
        d.ellipse([10,8,30,24],fill=WHITE); d.ellipse([12,15,29,24],fill=LAV)
        for t in [i/22 for i in range(23)]:
            x=(1-t)*22+t*31; y=(1-t)*12+t*4
            d.ellipse([x-2,y-2,x+2,y+2],fill=WHITE)
        d.ellipse([28,1,37,10],fill=WHITE)
        d.polygon([(36,4),(40,5),(36,7)],fill=BEAK); d.point((38,5),fill=BEAKS); d.rectangle([32,3,33,4],fill=EYE)
        for ax,ay in [(0,-3),(3,0),(0,3),(-3,0)]: d.ellipse([28+ax-2,3+ay-2,28+ax+2,3+ay+2],fill=PETAL)
        d.ellipse([27,2,30,5],fill=YEL)
        d.point((33,3),fill=EYEW)                          # eye catchlight
        d.ellipse([30,5,32,7],fill=PETAL)                  # rosy cheek
        d.ellipse([12,9,18,13],fill=(255,255,255,255))     # soft body sheen
    def tail(d,flick):
        pts=[(16,22),(14,28),(18,34+flick),(15,38+flick)]
        for i,(x,y) in enumerate(pts):
            r=6-i; d.ellipse([x-r,y-r,x+r,y+r],fill=MTAIL); d.arc([x-r,y-r,x+r,y+r],20,160,fill=MTAILD)
            d.arc([x-r,y-r,x+r,y+r],200,330,fill=MFIN)     # scale sheen on top of each segment
        fy=38+flick; d.polygon([(15,fy),(7,fy+2),(13,fy-3)],fill=MFIN); d.polygon([(15,fy),(23,fy+2),(17,fy-3)],fill=MFIN)
    def mk(flick):
        im=cell(W,H);d=ImageDraw.Draw(im);tail(d,flick);upper(d);return outline(im,W,H)
    return (W,H,[mk(0),mk(-2),mk(2)],["idle","swim1","swim2"])

def boss_frames():
    W,H=64,64
    def torso(d):
        d.ellipse([8,26,56,63],fill=BFUR); d.ellipse([20,36,44,63],fill=BBEL); d.ellipse([12,30,52,50],fill=BFUR)
    def head(d,dy=0):
        d.ellipse([18,10+dy,46,40+dy],fill=BFUR)
        for hx,flip in [(20,1),(44,-1)]:
            d.ellipse([hx-2,6+dy,hx+6,16+dy],fill=HORN); d.ellipse([hx-2+flip*2,2+dy,hx+6+flip*2,10+dy],fill=HORN)
            d.arc([hx-4,2+dy,hx+8,18+dy],0,360,fill=HORND)
        d.polygon([(16,18+dy),(10,14+dy),(17,24+dy)],fill=BFURD); d.polygon([(48,18+dy),(54,14+dy),(47,24+dy)],fill=BFURD)
        d.ellipse([26,26+dy,38,36+dy],fill=BFURD); d.point((29,30+dy),fill=EYE); d.point((35,30+dy),fill=EYE)
    def face_angry(d,dy=0):
        for ex in (24,40):
            d.ellipse([ex-3,20+dy,ex+3,26+dy],fill=YEL); d.point((ex,23+dy),fill=EYE)
            d.line([(ex-4,18+dy),(ex+3,21+dy)] if ex==24 else [(ex-3,21+dy),(ex+4,18+dy)],fill=OUTLINE,width=1)
        d.line([(27,37+dy),(37,37+dy)],fill=OUTLINE,width=1)
        d.polygon([(28,36+dy),(30,40+dy),(32,36+dy)],fill=TOOTH); d.polygon([(32,36+dy),(34,40+dy),(36,36+dy)],fill=TOOTH)
    def face_shut(d,dy=0):
        for ex in (24,40): d.arc([ex-3,20+dy,ex+3,27+dy],180,360,fill=OUTLINE)
        d.arc([26,34+dy,38,42+dy],0,180,fill=OUTLINE)
    def necklace(d,dy=0):
        d.arc([20,40+dy,44,56+dy],200,340,fill=GOLD); d.ellipse([29,50+dy,35,57+dy],fill=GEM); d.point((31,52+dy),fill=(255,200,230,255))
    def stink(d,x,y,big):
        r=4 if big else 2
        for ox,oy in [(0,0),(r,r-1),(-r,r),(0,r*2-1),(r,r*2)]:
            d.ellipse([x+ox-r,y+oy-r,x+ox+r,y+oy+r],fill=STINK); d.arc([x+ox-r,y+oy-r,x+ox+r,y+oy+r],20,200,fill=STINKD)
    def arm(d,x,y,raised):
        if raised:
            d.ellipse([x-5,y-16,x+5,y+2],fill=BFUR)
            for c in range(3): d.line([(x-4+c*4,y-16),(x-4+c*4,y-20)],fill=BBEL,width=1)
        else:
            d.ellipse([x-5,y-2,x+5,y+14],fill=BFUR)
            for c in range(3): d.line([(x-4+c*4,y+13),(x-4+c*4,y+17)],fill=BBEL,width=1)
    def f_idle():
        im=cell(W,H);d=ImageDraw.Draw(im);torso(d);arm(d,11,40,False);arm(d,53,40,False)
        head(d);face_angry(d);necklace(d);stink(d,10,34,False);stink(d,54,34,False);return outline(im,W,H)
    def f_attack():
        im=cell(W,H);d=ImageDraw.Draw(im);torso(d);arm(d,11,38,True);arm(d,53,38,True)
        head(d);face_angry(d);d.ellipse([28,34,38,44],fill=BFURD);necklace(d);stink(d,8,26,True);stink(d,56,26,True);return outline(im,W,H)
    def f_hurt():
        im=cell(W,H);d=ImageDraw.Draw(im);torso(d);arm(d,9,42,True);arm(d,55,42,True)
        head(d,dy=2);face_shut(d,dy=2);necklace(d,dy=2)
        for sx in (6,22,42,58): star(d,sx,12,2,YEL)
        return outline(im,W,H)
    return (W,H,[f_idle(),f_attack(),f_hurt()],["idle","attack","hurt"])

def frog_frames():
    W,H=26,22
    def base(d,sq=0):
        top=10+sq; d.ellipse([3,top,23,21],fill=FGN); d.ellipse([6,top+5,20,21],fill=FBELLY)
        d.ellipse([5,top+2,12,top+9],fill=FGND); d.ellipse([14,top+2,21,top+9],fill=FGND)
        for ex in (8,17):
            d.ellipse([ex-3,top-5,ex+3,top+2],fill=FGN); d.ellipse([ex-2,top-4,ex+2,top+1],fill=EYEW); d.point((ex,top-2),fill=EYE)
        d.arc([9,top+6,17,top+12],10,170,fill=EYE)
    def f_idle(): im=cell(W,H);base(ImageDraw.Draw(im));return outline(im,W,H)
    def f_crouch():
        im=cell(W,H);d=ImageDraw.Draw(im);base(d,3)
        d.line([(5,19),(1,21)],fill=FGND,width=2);d.line([(21,19),(25,21)],fill=FGND,width=2)
        return outline(im,W,H)
    def f_hop():
        im=cell(W,H);d=ImageDraw.Draw(im);base(d,-3)
        d.line([(4,16),(1,12)],fill=FGND,width=2);d.line([(22,16),(25,12)],fill=FGND,width=2);return outline(im,W,H)
    return (W,H,[f_idle(),f_crouch(),f_hop()],["idle","crouch","hop"])
def roach_frames():
    W,H=30,16
    def base(d,ph):
        d.ellipse([6,4,26,14],fill=RBR); d.ellipse([9,3,24,9],fill=RHI); d.ellipse([2,5,9,12],fill=RBRD); d.point((4,7),fill=EYE)
        d.line([(3,5),(-2,1)],fill=RBRD,width=1);d.line([(4,4),(0,-1)],fill=RBRD,width=1)
        for i,lx in enumerate((11,16,21)):
            off=2 if (i%2==0)==ph else -2; d.line([(lx,13),(lx+off,15)],fill=RBRD,width=1)
    def f1(): im=cell(W,H);base(ImageDraw.Draw(im),True);return outline(im,W,H)
    def f2(): im=cell(W,H);base(ImageDraw.Draw(im),False);return outline(im,W,H)
    return (W,H,[f1(),f2()],["scuttle1","scuttle2"])
def dino_frames():
    W,H=32,30
    def base(d,st):
        d.polygon([(2,18),(10,14),(10,22)],fill=DGN); d.ellipse([7,10,25,26],fill=DGN); d.ellipse([10,16,24,27],fill=DBELLY)
        d.ellipse([18,3,31,16],fill=DGN); d.polygon([(24,12),(31,11),(31,15)],fill=DGND); d.point((26,7),fill=EYE)
        for sx in (9,13,17): d.polygon([(sx,11),(sx+3,5),(sx+6,11)],fill=SPIKE)
        d.line([(20,18),(23,21)],fill=DGND,width=1)
        if st: d.rectangle([11,24,14,29],fill=DGND);d.rectangle([18,25,21,29],fill=DGN)
        else: d.rectangle([11,25,14,29],fill=DGN);d.rectangle([18,24,21,29],fill=DGND)
    def f1(): im=cell(W,H);base(ImageDraw.Draw(im),True);return outline(im,W,H)
    def f2(): im=cell(W,H);base(ImageDraw.Draw(im),False);return outline(im,W,H)
    return (W,H,[f1(),f2()],["walk1","walk2"])

def tiles_frames():
    W,H=16,16
    def grass_top():
        im=cell(W,H);d=ImageDraw.Draw(im);d.rectangle([0,5,15,15],fill=DIRT);d.rectangle([0,5,15,7],fill=GRASS)
        d.line([(0,8),(15,8)],fill=(112,76,56,255),width=1)
        for x in range(0,16,3):
            d.line([(x,6),(x-1 if x%2 else x+1,1+(x%3))],fill=GRASS,width=1)
            d.point((x,2),fill=(168,210,102,255))
        for x,y in ((3,11),(9,10),(13,13),(6,15)): d.point((x,y),fill=DIRTD)
        d.point((11,4),fill=(244,184,198,255)); d.point((12,3),fill=(255,226,154,255))
        return im
    def dirt():
        im=cell(W,H);d=ImageDraw.Draw(im);d.rectangle([0,0,15,15],fill=DIRT)
        for x,y in [(3,4),(9,2),(12,9),(5,11),(1,8),(14,14)]: d.point((x,y),fill=DIRTD)
        d.line([(7,5),(8,6),(7,8)],fill=(155,108,76,255),width=1)
        return im
    def edge(left):
        im=cell(W,H);d=ImageDraw.Draw(im);d.rectangle([0,0,15,15],fill=DIRT);d.rectangle([0,0,15,2],fill=GRASS)
        col=0 if left else 13; d.rectangle([col,0,col+2,15],fill=STONE)
        for y in (3,7,11): d.point((col+1,y),fill=DIRTD)
        return im
    def platform():
        im=cell(W,H);d=ImageDraw.Draw(im);d.rounded_rectangle([0,3,15,13],3,fill=DIRT);d.rounded_rectangle([0,3,15,6],2,fill=GRASS)
        for x in range(1,15,3): d.point((x,2),fill=GRASSD)
        return im
    def lilypad():
        im=cell(W,H);d=ImageDraw.Draw(im);d.ellipse([1,6,14,14],fill=GRASSD);d.ellipse([2,6,13,12],fill=GRASS)
        d.arc([3,7,12,13],10,170,fill=(165,210,100,255));d.line([(8,10),(8,6)],fill=GRASSD,width=1)
        d.polygon([(8,10),(8,6),(11,8)],fill=(28,63,43,255));heart(d,6,2,5,5,PETAL);d.point((8,3),fill=(255,225,160,255));return im
    def cattail():
        im=cell(W,H);d=ImageDraw.Draw(im)
        for bx in (5,10): d.line([(bx,15),(bx,4)],fill=GRASSD,width=1); d.rounded_rectangle([bx-1,4,bx+1,9],1,fill=RBR)
        return im
    def lantern():
        im=cell(W,H);d=ImageDraw.Draw(im);d.rectangle([7,6,8,15],fill=DIRTD);d.rounded_rectangle([4,2,11,8],2,fill=GOLD);d.ellipse([6,3,9,7],fill=(255,240,180,255));return im
    fns=[grass_top(),dirt(),edge(True),edge(False),platform(),lilypad(),cattail(),lantern()]
    labs=["grass_top","dirt","edge_left","edge_right","platform","lilypad","cattail","lantern"]
    return (W,H,[outline(f,W,H) for f in fns],labs)

def hud_frames():
    W,H=16,16
    def heart_full(): im=cell(W,H);heart(ImageDraw.Draw(im),2,2,12,11,HRT);return outline(im,W,H)
    def heart_empty(): im=cell(W,H);heart(ImageDraw.Draw(im),2,2,12,11,(60,45,70,255));return outline(im,W,H)
    def smiley():
        im=cell(W,H);d=ImageDraw.Draw(im);d.ellipse([1,1,14,14],fill=YEL);d.point((5,6),fill=EYE);d.point((10,6),fill=EYE);d.arc([4,6,11,12],0,180,fill=EYE);return outline(im,W,H)
    def seg():
        im=cell(W,H);d=ImageDraw.Draw(im);d.rounded_rectangle([3,3,12,12],2,fill=YEL);d.rectangle([5,5,10,6],fill=(255,235,160,255));return outline(im,W,H)
    def popcorn():
        im=cell(W,H);d=ImageDraw.Draw(im);d.polygon([(4,15),(12,15),(11,7),(5,7)],fill=BOX)
        for x in (5,8,11): d.line([(x,15),(x,8)],fill=POP,width=1)
        for ox,oy in [(5,4),(8,3),(11,5),(7,6),(10,6)]: d.ellipse([ox-2,oy-2,ox+2,oy+2],fill=POP)
        return outline(im,W,H)
    def star_i(): im=cell(W,H);star(ImageDraw.Draw(im),8,8,7,YEL);return outline(im,W,H)
    def treat():
        im=cell(W,H);d=ImageDraw.Draw(im);d.ellipse([2,2,14,14],fill=(180,220,240,160));d.rectangle([4,9,12,13],fill=BOX);d.ellipse([4,5,12,10],fill=PETAL);d.ellipse([7,4,9,6],fill=CHERRY);return outline(im,W,H)
    def trophy():
        im=cell(W,H);d=ImageDraw.Draw(im)
        for i,c in enumerate([GEM,GOLD,(150,90,200,255),GOLD]):
            ang=i*math.pi/2; d.ellipse([8+5*math.cos(ang)-2,8+5*math.sin(ang)-2,8+5*math.cos(ang)+2,8+5*math.sin(ang)+2],fill=c)
        d.ellipse([4,4,12,12],fill=GOLD);d.point((7,7),fill=EYE);d.point((10,7),fill=EYE);d.arc([6,8,11,12],0,180,fill=EYE);return outline(im,W,H)
    fns=[heart_full(),heart_empty(),smiley(),seg(),popcorn(),star_i(),treat(),trophy()]
    labs=["heart_full","heart_empty","happy_smiley","happy_seg","popcorn","star","treat","trophy"]
    return (W,H,fns,labs)

REGISTRY={"swan":swan_frames,"mermaid":mermaid_frames,"boss_grumpis":boss_frames,
          "frog":frog_frames,"cockroach":roach_frames,"dino":dino_frames,
          "tiles":tiles_frames,"hud":hud_frames}

manifest={}; rows=[]
for name,fn in REGISTRY.items():
    w,h,frames,labels=fn()
    sheet=Image.new("RGBA",(w*len(frames),h),T)
    for i,f in enumerate(frames): sheet.paste(f,(i*w,0),f)
    sheet.save(f"{OUT}/{name}.png")
    manifest[name]={"frame_w":w,"frame_h":h,"frames":labels,"file":f"assets/{name}.png"}
    rows.append((name,w,h,frames,labels))
json.dump(manifest,open(f"{OUT}/manifest.json","w"),indent=2)

S=6; pad=12
pw=max((w*len(fr))*S for _,w,h,fr,_ in rows)+pad*2
ph=sum(h*S for _,w,h,fr,_ in rows)+pad*(len(rows)+1)
prev=Image.new("RGBA",(pw,ph),(27,23,38,255)); pd=ImageDraw.Draw(prev); y=pad
for name,w,h,frames,labels in rows:
    x=pad
    for f,lab in zip(frames,labels):
        big=f.resize((w*S,h*S),Image.NEAREST); prev.paste(big,(x,y),big)
        pd.rectangle([x,y,x+w*S-1,y+h*S-1],outline=(70,60,90,255)); pd.text((x+3,y+3),lab,fill=(210,200,228,255)); x+=w*S+6
    pd.text((x+4,y+4),f"<- {name} {w}x{h}",fill=(150,200,150,255)); y+=h*S+pad
prev.save(f"{OUT}/_preview.png")
print("forge v2 complete:",list(manifest.keys()))
