"""Regenerate the three original graphic plates for each collection (Pillow)."""
from pathlib import Path
import json, math, random
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]/'vault/Originals'
for k,row in enumerate(json.loads((root/'collections.json').read_text())):
    name,_,_,_,_,paper,ink,accent,motif=row
    for v in range(3):
        rng=random.Random(100*k+v)
        bg,fg,pop=['#'+c for c in [(accent,ink,paper),(ink,paper,accent),(paper,accent,ink)][v]]
        im=Image.new('RGB',(1000,850),bg)
        d=ImageDraw.Draw(im)
        if motif in ('disc','orbit'):
            cx,cy=480+v*110,455-v*45
            for i in range(32):
                r=428-i*13
                d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=fg,width=6 if motif=='disc' else 2)
            d.ellipse((cx-72,cy-72,cx+72,cy+72),fill=pop)
            if motif=='orbit':
                for j in range(64):
                    x,y=rng.randrange(1000),rng.randrange(850);d.ellipse((x,y,x+3,y+3),fill=pop)
        elif motif in ('wave','ridge'):
            phase=rng.random()*6
            for j in range(64):
                pts=[]
                for x in range(-5,1011,6):
                    bend=math.sin(x/(178+v*20)+phase+j/54)*100+math.cos(x/88+phase)*32
                    if motif=='ridge':bend-=max(0,260-abs(x-(470+v*85))*.72)*math.sin((j+1)/68*math.pi)
                    pts.append((x,50+j*13+bend))
                d.line(pts,fill=fg if j%13 else pop,width=5)
        elif motif=='leaf':
            for j in range(11):
                x=55+j*94;y=600+int(120*math.cos(j*.6+v))
                d.line([(x-75,870),(x,y),(x+47,y-350)],fill=fg,width=6)
                for i in range(9):
                    yy=y-32*i;xx=x+4*i
                    d.polygon([(xx,yy),(xx-63,yy-24),(xx-93,yy-89),(xx-24,yy-49)],fill=fg)
                    d.polygon([(xx,yy-16),(xx+55,yy-62),(xx+76,yy-111),(xx+19,yy-69)],fill=pop if j%4==1 else fg)
        elif motif=='weave':
            for y in range(-80,890,44):
                for x in range(-80,1050,44):
                    flip=(x//44+y//44+v)%4
                    d.rectangle((x,y,x+(80 if flip<2 else 27),y+(27 if flip<2 else 80)),fill=fg if flip%2 else pop)
        elif motif=='vessel':
            for i in range(73):
                t=i/72;r=92+169*math.sin(math.pi*t)**(1+v*.48)+45*math.cos(2*math.pi*t+v)
                y=122+t*599
                d.ellipse((500-r,y-r*.22,500+r,y+r*.22),outline=fg,width=4)
            d.line((130,758,870,758),fill=pop,width=6)
        elif motif=='structure':
            for n in range(12):
                x=60+n*71;y=625-abs(6-n)*19
                h=200+125*math.sin(n*.4+v)
                d.polygon([(x,y),(x+68,y-35),(x+68,y-h-35),(x,y-h)],fill=fg)
                d.polygon([(x,y-h),(x+68,y-h-35),(x+104,y-h-12),(x+35,y-h+23)],fill=pop)
        else:
            for n in range(14):
                x=-180+n*88;delta=40*v
                d.polygon([(x,735),(x+180,145+delta),(x+310,110),(x+120,710)],fill=fg)
                d.polygon([(x+180,145+delta),(x+310,110),(x+260,315),(x+155,257)],fill=pop)
        path=root/'art'/f"{name.lower().replace(' ','-')}-{v}.png"
        im.resize((800,680),Image.Resampling.LANCZOS).quantize(colors=48).save(path)

# A compact, GitHub-friendly index of the artwork used by these collections.
from PIL import ImageFont
rows=json.loads((root/'collections.json').read_text())
sheet=Image.new('RGB',(1120,1068),'#FAF9F5')
labels=ImageDraw.Draw(sheet)
font=ImageFont.load_default(size=19)
for i,row in enumerate(rows):
    x=18+(i%4)*276
    y=16+(i//4)*176
    tile=Image.open(root/'art'/f"{row[0].lower().replace(' ','-')}-{i%3}.png").convert('RGB')
    from PIL import ImageOps
    sheet.paste(ImageOps.fit(tile,(255,133)),(x,y))
    labels.text((x,y+139),row[0],fill='#20251F',font=font)
sheet.save(root/'collection-index.jpg',quality=88)
