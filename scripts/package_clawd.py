"""Export all original-action captures as portable Clawd on Desk themes."""
import concurrent.futures
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
from PIL import Image
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/mysekai-clawd'
CATALOG = json.loads((ROOT/'build/web/catalog.json').read_text(encoding='utf8'))
SETTINGS = json.loads((ROOT/'web/export-settings.json').read_text(encoding='utf8'))
ENCODING = json.loads((ROOT/'host/encoding.json').read_text(encoding='utf8'))
ONCE = {'failed','review','sit-down','stand-up'}
WAIT_FOR_RENDERS = False


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf8')


def character(c):
    theme_dir = OUT/'themes'/c['id']
    assets = theme_dir/'assets'; assets.mkdir(parents=True, exist_ok=True)
    source = ROOT/'build/renders'/c['id']
    old_source = theme_dir/'source.json'
    previous_encoding = json.loads(old_source.read_text(encoding='utf8')).get('encoding') if old_source.exists() else None
    durations, checks = {}, []
    for key, spec in c['states'].items():
        duration = 4 if key == 'idle' else sum(json.loads((ROOT/'build/web/animations'/f'{clip}.json').read_text())['duration'] for clip in spec['sequence'])
        capture = source/'actions-hd'/f'{key}.json'
        deadline=time.monotonic()+1800
        while WAIT_FOR_RENDERS and not capture.exists() and time.monotonic()<deadline:
            time.sleep(1)
        meta = json.loads(capture.read_text(encoding='utf8'))
        for field in ['revision','fps','width','height','columns','framesPerPage']:
            assert meta[field] == SETTINGS[field], (c['id'], key, field)
        count = max(2, math.ceil(duration*SETTINGS['fps']))
        assert meta['count'] == count and abs(meta['duration']-duration) < 1e-6
        width,height,columns = meta['width'],meta['height'],meta['columns']
        frames = []
        for page in range(meta['pages']):
            n = min(meta['framesPerPage'], count-len(frames))
            with Image.open(source/'actions-hd'/f'{key}-{page:03d}.png') as image:
                sheet = image.convert('RGBA')
            assert sheet.size == (columns*width, math.ceil(n/columns)*height), (c['id'],key,page)
            frames.extend(sheet.crop((i%columns*width,i//columns*height,(i%columns+1)*width,(i//columns+1)*height)) for i in range(n))
        assert len(frames) == count
        for frame in frames:
            box = frame.getchannel('A').getbbox()
            assert box and box[0]>0 and box[1]>0 and box[2]<width and box[3]<height, (c['id'], key, box)
        distinct = len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames})
        assert distinct > 1, (c['id'], key, 'static')
        # Rounded per-frame intervals preserve the total original clip duration.
        ms = [round((i+1)*duration*1000/count)-round(i*duration*1000/count) for i in range(count)]
        filename = key+('-once' if key in ONCE else '')+'.webp'
        target = assets/filename
        if previous_encoding != ENCODING or not target.exists() or target.stat().st_mtime_ns < capture.stat().st_mtime_ns:
            frames[0].save(target, save_all=True, append_images=frames[1:], duration=ms,
                           loop=1 if key in ONCE else 0, **ENCODING)
        if key == 'idle':
            frames[0].save(assets/'portrait.png')
        durations[key] = sum(ms)
        checks.append({'state':key, 'file':filename, 'frames':count, 'distinctFrames':distinct, 'durationMs':sum(ms),
                       'width':width,'height':height,'targetFps':SETTINGS['fps']})
        print(c['id'],key,count,'frames',flush=True)
    # Older custom gaze frames are not part of the standard Clawd theme.
    for old in assets.glob('gaze-*.png'):
        old.unlink()
    for key in ONCE:
        old=assets/f'{key}.webp'
        if old.exists(): old.unlink()
    idle_choices = ['waving', 'dance', 'clap', 'nod', 'shake-head', 'peace', 'laugh']
    idle_choices += [key for key in c['states'] if key.startswith('special-')]
    state_map = {'idle':'idle', 'thinking':'running', 'working':'dance', 'juggling':'clap',
                 'error':'failed-once', 'attention':'review-once', 'notification':'surprise', 'sleeping':'seated-sleep',
                 'waking':'stand-up-once', 'yawning':'yawn', 'dozing':'doze', 'collapsing':'sit-down-once',
                 'sweeping':'shake-head', 'carrying':'nod', 'roam':'running-right'}
    manifest = {
        'schemaVersion':1, 'name':'MYSEKAI · '+c['displayName'], 'author':'MYSEKAI fan pack',
        'version':'0.4.0', 'description':f"JP {CATALOG['assetVersion']} · {len(c['states'])} native actions · 384x416 / 60 fps · unofficial fan theme",
        'viewBox':{'x':0,'y':0,'width':192,'height':208}, 'preview':'portrait.png',
        'customization':{'petTint':False},
        'objectScale':{'widthRatio':1,'heightRatio':1,'offsetX':0,'offsetY':0,
                       'imgWidthRatio':1,'imgOffsetX':0,'imgBottom':0,'objBottom':0},
        'hitBoxes':{'default':{'x':38,'y':42,'w':118,'h':151},'sleeping':{'x':38,'y':42,'w':118,'h':151}},
        'eyeTracking':{'enabled':False, 'states':[], 'eyeRatioX':.5,'eyeRatioY':.32,'maxOffset':20},
        'states':{state:[key+'.webp'] for state,key in state_map.items()},
        'sleepSequence':{'mode':'full'},
        'idleAnimations':[{'file':key+'.webp','duration':durations[key]} for key in idle_choices],
        'idleVisualOptions':[{'file':key+'.webp'} for key in c['states'] if key not in ONCE],
        'timings':{'mouseIdleTimeout':15000,'mouseSleepTimeout':120000,
                   'deepSleepTimeout':600000,
                   'yawnDuration':durations['yawn'],'wakeDuration':durations['stand-up'],
                   'collapseDuration':durations['sit-down'],
                   'minDisplay':{'error':durations['failed'],'attention':durations['review'],'notification':durations['surprise']},
                   'autoReturn':{'error':durations['failed'],'attention':durations['review'],'notification':durations['surprise']}},
        'reactions':{'drag':{'file':'surprise.webp','fileLeft':'running-left.webp','fileRight':'running-right.webp'},
                     'clickLeft':{'file':'waving.webp','duration':durations['waving']},
                     'clickRight':{'file':'peace.webp','duration':durations['peace']},
                     'double':{'files':['jumping.webp'],'duration':durations['jumping']}},
        'sounds':{'complete':None,'confirm':None}, 'miniMode':{'supported':False},
    }
    write(theme_dir/'theme.json',manifest)
    write(theme_dir/'source.json',{'region':'jp','assetVersion':CATALOG['assetVersion'],
                                  'characterId':c['characterId'],'model':c['model'],'unitId':c['unitId'],
                                  'render':SETTINGS,
                                  'encoding':ENCODING,
                                  'chair':{k:v for k,v in json.loads((ROOT/'build/web/props/chair.json').read_text()).items()
                                           if k in ['model','characterAnchor']},
                                  'actions':{key:spec['sequence'] for key,spec in c['states'].items()}})
    print(c['id'], len(checks), 'actions', sum(v['frames'] for v in checks),'frames', flush=True)
    return {'id':c['id'],'displayName':c['displayName'],'actions':checks}


def main():
    global OUT, WAIT_FOR_RENDERS
    parser=argparse.ArgumentParser(); parser.add_argument('--only',nargs='+'); parser.add_argument('--output'); parser.add_argument('--workers',type=int,default=4)
    parser.add_argument('--wait-for-renders',action='store_true')
    args=parser.parse_args(); WAIT_FOR_RENDERS=args.wait_for_renders
    if args.output: OUT=ROOT/args.output
    selected=[c for c in CATALOG['characters'] if not args.only or c['id'] in args.only]
    if args.only and len(selected)!=len(set(args.only)): parser.error('Unknown character ID')
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        checks = list(pool.map(character, selected))
    if args.only:
        write(OUT/'validation-partial.json',{'partial':True,'checks':checks}); return
    write(OUT/'pack.json',{'version':'0.4.0','host':'Clawd on Desk','identities':26,'forms':len(checks),'characters':checks})
    shutil.copy2(ROOT/'build/web/source-provenance.json',OUT/'source-provenance.json')
    write(ROOT/'build/validation/clawd-assets.json',{'characters':len(checks),
        'actions':sum(len(c['actions']) for c in checks),
        'frames':sum(a['frames'] for c in checks for a in c['actions']), 'checks':checks})


if __name__=='__main__': main()
