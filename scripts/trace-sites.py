"""Rebuild reference geometry from the vault captures and macOS Vision OCR JSON.
Usage: swift scripts/read-site-text.swift vault/assets/sites/*.png > /tmp/iris-text.json
       python3 scripts/trace-sites.py /tmp/iris-text.json  (Pillow, numpy, opencv-python)
Run from the repository root. Normal plugin builds use the committed geometry.
"""
from pathlib import Path
import json
import sys

import cv2
import numpy as np
from PIL import Image

def hexcolor(rgb):
    return '#' + ''.join(f'{int(v):02X}' for v in rgb)

def lettering(rgb, observations):
    height, width = rgb.shape[:2]
    mask = np.zeros((height, width), np.uint8)
    labels = []
    for entry in observations:
        text = entry['text'].strip()
        if not text or not any(c.isalnum() for c in text):
            continue
        xf, yf, wf, hf = entry['box']
        x, y = max(0, round(xf*width)-1), max(0, round(yf*height)-1)
        right, bottom = min(width, round((xf+wf)*width)+1), min(height, round((yf+hf)*height)+1)
        patch = rgb[y:bottom, x:right]
        if patch.size == 0:
            continue
        # Estimate the surface under each glyph from above and below its line.
        edge = np.median([patch[0], patch[-1]], axis=0)
        delta = np.linalg.norm(patch.astype(float)-edge, axis=2)
        foreground = delta > max(16, np.percentile(delta, 78)*.6)
        ink = patch[delta >= np.percentile(delta, 93)]
        mask[y:bottom, x:right] |= foreground.astype(np.uint8)*255
        w, h = right-x, bottom-y
        heavy = sum(c in 'MW@%' for c in text)
        units = sum(.27 if c in " il.,:'|" else .72 if c.isupper() else .55 for c in text) + .22*heavy
        size = round(max(6, min(120, h*1.12, w/max(1, units))), 1)
        weight = 600 if foreground.mean() > .30 else 400
        labels.append([x,y,w,h,size,weight,hexcolor(np.median(ink,axis=0)),text])
    return cv2.inpaint(rgb,cv2.dilate(mask,np.ones((3,3),np.uint8)),4,cv2.INPAINT_TELEA),labels

def trace(path, observations):
    source = np.asarray(Image.open(path).convert('RGB'))
    clean, labels = lettering(source, observations)
    im = Image.fromarray(clean).resize((480,300), Image.Resampling.LANCZOS)
    indexed = im.quantize(colors=28, method=Image.Quantize.MEDIANCUT)
    grid = np.asarray(indexed)
    palette = np.array(indexed.getpalette()).reshape(-1,3)
    colors = np.argsort(-np.bincount(grid.ravel(),minlength=len(palette)))
    pieces = []
    for color in colors[1:]:
        if np.linalg.norm(palette[color]-palette[colors[0]]) < 7:
            continue
        binary = (grid == color).astype(np.uint8)
        cs, hierarchy = cv2.findContours(binary,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
        if hierarchy is None:
            continue
        regions = []
        for i, contour in enumerate(cs):
            area = cv2.contourArea(contour)
            if hierarchy[0,i,3] != -1 or area < 3:
                continue
            loops = [cv2.approxPolyDP(contour,.65,True).reshape(-1,2)]
            child = hierarchy[0,i,2]
            while child != -1:
                if cv2.contourArea(cs[child]) >= 3:
                    loops.append(cv2.approxPolyDP(cs[child],.65,True).reshape(-1,2))
                child = hierarchy[0,child,0]
            loops = [loop for loop in loops if len(loop)>=3]
            if loops:
                regions.append((area,loops))
        regions.sort(key=lambda r:-r[0])
        # Large connected objects get their own layer. Detail shares a vector by colour.
        groups = [[loops] for area,loops in regions[:7] if area>=45]
        remaining = [loops for area,loops in regions[len(groups):]]
        if remaining:
            groups.append(remaining)
        for group in groups:
            loops = [loop for region in group for loop in region]
            points = np.concatenate(loops)
            ox, oy = points.min(axis=0)
            w, h = points.max(axis=0)-[ox,oy]
            if min(w,h)<1:
                continue
            data = ' '.join('M '+' L '.join(f'{x-ox} {y-oy}' for x,y in loop)+' Z' for loop in loops)
            rect = len(loops)==1 and len(loops[0])==4 and abs(cv2.contourArea(loops[0])-w*h)<=1
            pieces.append([int(ox)*3,int(oy)*3,int(w)*3,int(h)*3,hexcolor(palette[color]),None if rect else data])
    return {'bg':hexcolor(palette[colors[0]]),'shapes':pieces,'text':labels}

ocr = json.loads(Path(sys.argv[1]).read_text())
folder = Path(sys.argv[2]) if len(sys.argv)>2 else Path('vault/assets/sites')
sites = {p.stem:trace(p,ocr[p.stem]) for p in sorted(folder.glob('*.png'))}
if len(sys.argv)==2:
    Path('references/source-text.json').write_text(json.dumps({k:v['text'] for k,v in sites.items()},ensure_ascii=False,separators=(',',':'))+'\n')
Path('references/sites.json').write_text(json.dumps(sites,ensure_ascii=False,separators=(',',':'))+'\n')
