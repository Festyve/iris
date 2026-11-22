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
        if motif=='projector':
            for j in range(15):
                tip=(90+v*95,660-v*105)
                d.polygon([tip,(1000,45*j-110),(1000,45*j-84)],fill=fg)
            d.ellipse((80,90,340,350),fill=pop)
            for j in range(14):d.rectangle((18+j*75,796,51+j*75,820),fill=fg)
        elif motif=='transit':
            for j in range(5):
                y=85+j*118
                pts=[(-30,y),(220+v*60,y),(372+v*60,y+150),(734,y+150),(920,y-34),(1030,y-34)]
                d.line(pts,fill=fg if j%2==0 else pop,width=13,joint='curve')
                for x,yy in pts[1:4]:d.ellipse((x-14,yy-14,x+14,yy+14),fill=bg,outline=fg,width=6)
        elif motif=='dial':
            x,y=500,425
            for j in range(60):
                angle=j*math.tau/60;rr=302 if j%5==0 else 327
                pt=lambda r:(x+r*math.sin(angle),y-r*math.cos(angle))
                d.line((pt(rr),pt(350)),fill=fg,width=11 if j%5==0 else 4)
            angle=(v+1)*.86
            d.line([(x-55*math.sin(angle),y+55*math.cos(angle)),pt(280)],fill=pop,width=18)
            d.ellipse((476,401,524,449),fill=fg)
        elif motif=='sun':
            cx,cy=445+v*55,378
            d.ellipse((cx-220,cy-220,cx+220,cy+220),fill=pop)
            for j in range(40):
                y=430+j*11
                d.line([(-30,y+90),(360,y-55),(731,y+45),(1030,y-47)],fill=fg,width=4+j//8)
        elif motif=='bird':
            for j in range(4):
                x=65+j*178;y=520-j*86+v*36
                d.polygon([(x,y),(x+118,y-126),(x+160,y-16),(x+277,y-76),(x+178,y+49)],fill=fg)
                d.polygon([(x+118,y-126),(x+160,y-16),(x+178,y+49)],fill=pop)
        elif motif=='court':
            d.rounded_rectangle((82,72,918,778),radius=55,outline=fg,width=10)
            mid=430+v*30
            d.line([(82,mid),(918,mid)],fill=fg,width=10)
            d.ellipse((348,mid-150,648,mid+150),outline=pop,width=12)
            for x in [170,830]:d.line([(x,72),(x,778)],fill=fg,width=7)
            d.ellipse((264+v*80,218,319+v*80,273),fill=pop)
        elif motif=='meter':
            for j in range(31):
                height=int(3+20*abs(math.sin(j*.16+v)*math.cos(j*.07+v*.3)))
                for h in range(height):
                    x=39+j*30;y=730-h*28
                    d.rectangle((x,y,x+22,y+20),fill=pop if h>=16 else fg)
        elif motif=='lens':
            for j in range(7):
                x=40+j*125;y=350+int(105*math.sin(j*.65+v))
                d.ellipse((x-110,y-185,x+170,y+185),outline=fg,width=12)
            x=270+v*120
            d.ellipse((x,510,x+125,635),fill=pop)
        elif motif in ('disc','orbit'):
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
sheet=Image.new('RGB',(1120,16+math.ceil(len(rows)/4)*176),'#FAF9F5')
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
