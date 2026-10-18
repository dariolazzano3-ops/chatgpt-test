#!/usr/bin/env python3
"""Offline, reusable 9:16 motion-video renderer for approved marketing images.
Requirements: pillow, numpy, ffmpeg, ffprobe. Generates a video from licensed
art + storyboard copy; DOES NOT call paid video/AI providers or post externally.
Usage: python scripts/marketing-video-compositor-v2.py \
 --plan projects/marketing-factory/drafts/lunara-2026-10-19.json \
 --art /path/to/owned-or-approved-ai-art.png --out /path/to/video.mp4
"""
import argparse, json, math, os, subprocess, tempfile, wave
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np

W,H,FPS=720,1280,24
SANS='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
SERIF='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
def source_as_canvas(path):
  im=Image.open(path).convert('RGB')
  factor=max(W/im.width,H/im.height)
  im=im.resize((math.ceil(im.width*factor),math.ceil(im.height*factor)),Image.Resampling.LANCZOS)
  x=(im.width-W)//2;y=(im.height-H)//2
  return im.crop((x,y,x+W,y+H))
def fit_font(d,txt,max_w,size=43):
  for s in range(size,17,-1):
    font=ImageFont.truetype(SERIF,s)
    if d.textbbox((0,0),txt,font=font)[2]<=max_w:return font
  return ImageFont.truetype(SERIF,18)
def scene_art(background,brand,main,sub,idx,count,output):
  im=background.copy().convert('RGBA')
  shade=Image.new('RGBA',(W,H))
  pix=shade.load()
  for y in range(H):
    alpha=min(210,int(76+100*max(0,1-y/620)+80*max(0,(y-680)/600)))
    for x in range(W):pix[x,y]=(10,14,35,alpha)
  im=Image.alpha_composite(im,shade)
  d=ImageDraw.Draw(im)
  brand_font=ImageFont.truetype(SANS,18)
  d.text((W//2,108),brand.upper(),font=brand_font,anchor='mm',fill='#F2D9B6')
  # Centered headline and subtitle in a vertical-safe text area
  lines=main.split('\n')[:3]
  y=790
  for line in lines:
    font=fit_font(d,line,W-100)
    d.text((W//2,y),line,font=font,anchor='mm',fill='#FFF9F0',stroke_width=1,stroke_fill='#101321')
    y+=70
  sf=fit_font(d,sub,W-120,26)
  d.text((W//2,min(1110,y+40)),sub,font=sf,anchor='mm',fill='#F7D2A1')
  for i in range(count):
    cx=W//2+(i-(count-1)/2)*34
    d.rounded_rectangle((cx-10,H-90,cx+10,H-86),radius=2,fill='#F7D2A1' if i==idx else '#6A718A')
  im.convert('RGB').save(output)
def synth_original_ambient(path,seconds):
  sr=24000;t=np.arange(int(seconds*sr),dtype=np.float64)/sr
  a=np.zeros_like(t)
  for freq in (196.0,246.94,293.66):
    a+=0.02*np.sin(2*np.pi*freq*t)
  for at,freq in zip([0,4,8,14,19],[659.25,783.99,659.25,523.25,587.33]):
    dx=t-at;a+=0.04*np.sin(2*np.pi*freq*np.maximum(dx,0))*(dx>=0)*np.exp(-np.maximum(dx,0)*3)
  a*=np.minimum(1,t/1.1)*np.minimum(1,(seconds-t)/1.1)
  with wave.open(str(path),'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr)
    w.writeframes((np.clip(a,-1,1)*32767).astype('<i2').tobytes())
def run(*args):
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)
def main():
  a=argparse.ArgumentParser()
  a.add_argument('--plan',required=True);a.add_argument('--art',required=True);a.add_argument('--out',required=True)
  cfg=a.parse_args()
  plan=json.loads(Path(cfg.plan).read_text())
  if plan.get('schema')!='jarvis.universal-marketing-factory.plan.v1':raise ValueError('PLAN_REQUIRED')
  if not Path(cfg.art).is_file():raise FileNotFoundError(cfg.art)
  shots=plan['production']['storyboard']
  durations=[]
  for shot in shots:
    st,en=map(int,shot['seconds'].split('-'))
    if en<=st or en-st>30:raise ValueError('INVALID_SCENE_TIMING')
    durations.append(en-st)
  total=sum(durations)
  if total>180:raise ValueError('VIDEO_TOO_LONG')
  bg=source_as_canvas(cfg.art)
  with tempfile.TemporaryDirectory(prefix='jarvis-marketing-') as td:
    td=Path(td);clips=[]
    for i,(shot,duration) in enumerate(zip(shots,durations)):
      jpg=td/f'frame{i}.png';clip=td/f'clip{i}.mp4'
      headline=(plan['creative']['hook'] if i==0 else shot['overlay'])
      sub=(plan['creative']['cta'] if i==len(shots)-1 else shot['scene'])
      scene_art(bg,plan['brand_id'],headline,sub,i,len(shots),jpg)
      run('-loop','1','-framerate',FPS,'-i',jpg,
          '-vf',f"zoompan=z='min(zoom+0.00008,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=720x1280:fps=24,fade=t=in:st=0:d=0.25,fade=t=out:st={duration-0.25}:d=0.25,format=yuv420p",
          '-frames:v',FPS*duration,'-an','-c:v','libx264','-preset','ultrafast','-crf','23',clip)
      clips.append(clip)
    concat=td/'concat.txt';concat.write_text(''.join("file '"+str(x)+"'\n" for x in clips))
    silent=td/'silent.mp4';run('-f','concat','-safe','0','-i',concat,'-c','copy',silent)
    wav=td/'ambient.wav';synth_original_ambient(wav,total)
    Path(cfg.out).parent.mkdir(parents=True,exist_ok=True)
    run('-i',silent,'-i',wav,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','96k','-t',total,'-movflags','+faststart',cfg.out)
  print(json.dumps({'file':str(cfg.out),'duration':total,'status':'RENDERED_LOCAL_ONLY','published':False}))
if __name__=='__main__':main()
