"""Generate lossless replacement patches for the original 1440 × 900 vault images.
Only patches are stored. The studio composites them onto the local source PNG.
Requires Pillow and NumPy. Run from the repository root on macOS.
"""
from pathlib import Path
import base64
import io
import json
import re
import sys
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import cv2

root=Path('references')
sites=json.loads((root/'source-text.json').read_text())
preview=Path(sys.argv[1]) if len(sys.argv)>1 else None
if preview: preview.mkdir(parents=True,exist_ok=True)
observations={}
names=json.loads((root/'brands.json').read_text())
sources={
'adelfaure':'Adel Faure|Adelfaure','animata':'animata','apple-liquid-glass':'Apple','emilkowal':'Emil Kowalski',
'godly':'godly','grainient':'grainient','gumroad':'gumroad|gумroad|gumrodd|gumclaw','horizonx':'horizonx',
'metalforge':'MetalForge','paco':'Paco Coursey','poolsuite':'Poolsuite','rauno':'Rauno Freiberg','raycast':'Raycast',
'scrollshaders':'scrollshaders','scrolltide':'scrolltide','snapblocks':'snapblocks','stripe':'Stripe',
'teenage-engineering':'Teenage Engineering','ui-chords':'ui[- ]chords','uiarc':'uiarc|Arc','vercel':'Vercel','winamp-ui-sdk':'winamp'}
partners={'OpenRouter':'Waygate','OpenAI|OpenAl':'Northstar','FreshBooks':'Ledgerline','amazon':'Evergrove',
'SKIP':'Swiftcart','nVIDIA':'Verdant','JOBBE[R]?':'Crewbook','Google':'Daymark','Meta':'Fable','DOORDASH':'Fleetbox',
'SPACEX':'Starline','Polymarket':'Crowdline','The Weather Company':'Skyline','Linear':'Linework','Mobbin':'Gridbook',
'Opendoor':'Doorway','Pocket':'Pouch','Blackstar':'Inkstar','Align Canvas':'Paperplane','OVHcloud':'Nimbus',
'Carbon':'Charcoal','Devouring Details':'Small Gestures','Gumclaw':'Lemon Club','iPhone':'Phone','iPad':'Tablet',
'AirPods':'Earbuds','iOS':'Mobile OS','macOS':'Desktop OS','Mac':'Desktop','Windows':'Desktop','Toyota':'Nova',
'Instagram':'Photo feed','HiChord':'Tonepad','GitHub':'Codebase','Figma':'Canvas','Claude Code':'Code Studio','Cursor':'Caret','Codex':'Workbench'}
# Custom regions for stylized words missed by OCR. Coordinates use the original viewport.
manual={
'adelfaure':[(8,157,1120,89,'Glyph Harbor','#232329',65)],
'godly':[(12,14,45,35,'F','#121212',26)],
'vercel':[(20,19,30,28,'C','#FFFFFF',22),(1030,803,113,69,'Skyline','#FFFFFF',16)],
'winamp-ui-sdk':[(493,337,441,15,'Wave Deck','#24222D',11)],
'teenage-engineering':[(60,13,151,69,'Signal Objects','#B9BAB5',19)]}
# Lines with unusually stylized lettering or wordmarks OCR misread.
overrides={'gumroad':{'GUmrOdD @ 10.1k *':'Lemonstall  ©  10.1k'},
'uiarc':{'nl Arc':'Arcwell'},'apple-liquid-glass':{'Мac':'Desktop'},
'stripe':{'@ JOBBE':'Crewbook','@ nVIDIA':'Verdant','F FreshBooks':'Ledgerline','G Sign up with Google':'Sign up with Daymark'},
'vercel':{'00 Meta':'Fable','O DOORDASH':'Fleetbox','The':'Skyline','Weather':'Forecast','Company':'Group'},
'teenage-engineering':{'teenage':'Signal','engineering':'Objects'}}
def replacement(site,label):
    if label in overrides.get(site,{}): return overrides[site][label]
    out=label
    for key,pattern in sources.items():
        if key=='uiarc' and site!='uiarc': continue
        out=re.sub(r'(?<!\w)(?:'+pattern+r')(?!\w)',names[key],out,flags=re.I)
    for pattern,to in partners.items():
        out=re.sub(r'(?<!\w)(?:'+pattern+r')(?!\w)',to,out,flags=re.I)
    return out

result=json.loads((root/'brand-patches.json').read_text())
fontroot=Path('/System/Library/Fonts/Supplemental')
for key,site in sites.items():
    im=Image.open('vault/assets/sites/'+key+'.png').convert('RGB')
    blocks=[]; substitutions={}; rects=[]; lines=[]
    cleaned=im.copy()
    for x,y,w,h,size,weight,ink,original in site:
        changed=replacement(key,original)
        if not any(x < a+c and x+w > a and y < b+d and y+h > b for a,b,c,d,*_ in manual.get(key,[])):
            lines.append((x,y,w,h,changed))
        if changed!=original:
            substitutions[original]=changed
            rects.append((x,y,w,h,changed,ink,size,weight))
    rects += [(*r,600) for r in manual.get(key,[])]
    lines += [r[:5] for r in manual.get(key,[])]
    for x,y,w,h,label,ink,size,weight in rects:
        x0,y0=max(0,x-2),max(0,y-2)
        x1,y1=min(im.width,x+w+2),min(im.height,y+h+2)
        w,h=x1-x0,y1-y0
        above=np.asarray(im.crop((x0,max(0,y0-1),x1,max(0,y0-1)+1)),dtype=float)
        below=np.asarray(im.crop((x0,min(im.height-1,y1),x1,min(im.height-1,y1)+1)),dtype=float)
        t=np.linspace(0,1,h)[:,None,None]
        tile=Image.fromarray(np.round(above*(1-t)+below*t).astype('uint8'))
        if key=='adelfaure' and label=='Glyph Harbor':
            tile=Image.new('RGB',(w,h),'white')
        if key=='rauno':
            # Black letters straddle a hard white/yellow circle. Preserve that edge.
            raw=np.asarray(im.crop((x0,y0,x1,y1)))
            dark=np.max(raw,axis=2)<185
            mask=cv2.dilate(dark.astype(np.uint8)*255,np.ones((3,3),np.uint8))
            tile=Image.fromarray(cv2.inpaint(raw,mask,4,cv2.INPAINT_TELEA))
        fontpath=fontroot/('Arial Bold.ttf' if weight>=600 else 'Arial.ttf')
        pt=max(6,min(round(size),h))
        font=ImageFont.truetype(str(fontpath),pt)
        while pt>6 and font.getlength(label)>w-3:
            pt-=1; font=ImageFont.truetype(str(fontpath),pt)
        # Match the reference line's contrast when the original OCR sampled its surface.
        surface=np.asarray(tile).mean(axis=(0,1)); rgb=np.array(list(bytes.fromhex(ink[1:])))
        if np.linalg.norm(surface-rgb)<45: ink='#FAFAFA' if surface.mean()<130 else '#19191B'
        ImageDraw.Draw(tile).text((2,h/2),label,font=font,fill=ink,anchor='lm')
        cleaned.paste(tile,(x0,y0))
        buf=io.BytesIO();tile.save(buf,format='PNG',optimize=True)
        blocks.append([x0,y0,base64.b64encode(buf.getvalue()).decode()])
    if preview:
        cleaned.save(preview/(key+'.png'))
        observations[key]=[{'text':label,'box':[x/1440,y/900,w/1440,h/900]} for x,y,w,h,label in lines]
    result[key]={'copy':substitutions,'patches':blocks}
(root/'brand-patches.json').write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False)+'\n')

if preview: (preview/'observations.json').write_text(json.dumps(observations))
