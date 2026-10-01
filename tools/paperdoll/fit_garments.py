#!/usr/bin/env python3
"""
Fit raw garments onto the male/female bodies and export skinned GLBs.

    python tools/paperdoll/fit_garments.py                 # every garment, both genders
    python tools/paperdoll/fit_garments.py shirt01         # one garment
    python tools/paperdoll/fit_garments.py shirt01 --gender female

Outputs: packages/shared/characters/<slot>/<gender>/<name>.glb
"""
import argparse
import glob
import os
import sys
import time


HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)

import paperdoll as pd  # noqa: E402
from validate import validate  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('names', nargs='*', help='garment names (default: all)')
    ap.add_argument('--gender', choices=['male', 'female'], action='append')
    ap.add_argument('--config', default=os.path.join(HERE, 'garments.json'))
    ap.add_argument('--fat-only', action='store_true',
                    help="keep the fitted normal shape, only (re)build the 'fat' body-shape morph")
    args = ap.parse_args()

    conf = pd.load_config(args.config)
    genders = args.gender or ['male', 'female']
    bodies = {g: pd.Body(os.path.join(REPO, conf['bodies'][g])) for g in genders}
    fat_bodies = {g: pd.Body(os.path.join(REPO, conf['bodies'][g]), morph=1.0) for g in genders}
    garments = [g for g in conf['garments'] if not args.names or g['name'] in args.names]
    if not garments:
        sys.exit(f'no garment matches {args.names}')

    failures = 0
    for cfg in garments:
        for gender in genders:
            if gender in cfg.get('skip_genders', []):
                continue
            gcfg = dict(cfg)
            gcfg.update(cfg.get('overrides', {}).get(gender, {}))
            by_name = {g['name']: g for g in conf['garments']}
            gcfg['_over_paths'] = [os.path.join(REPO, conf['output_dir'], by_name[o]['slot'], gender, f'{o}.glb')
                                   for o in cfg.get('over', [])]
            # other skinned assets to stay outside of, e.g. every hair style under a cap
            excluded = {os.path.join(REPO, conf['output_dir'], e.format(gender=gender)) for e in cfg.get('over_files_exclude', [])}
            for pattern in cfg.get('over_files', []):
                found = sorted(glob.glob(os.path.join(REPO, conf['output_dir'], pattern.format(gender=gender))))
                gcfg['_over_paths'] += [f for f in found if f not in excluded]
            missing = [p for p in gcfg['_over_paths'] if not os.path.exists(p)]
            if missing:
                sys.exit(f"{cfg['name']} is worn over {missing}; fit those first")
            out_dir = os.path.join(REPO, conf['output_dir'], cfg['slot'], gender)
            os.makedirs(out_dir, exist_ok=True)
            out = os.path.join(out_dir, f"{cfg['name']}.glb")
            t0 = time.time()
            print(f"== {cfg['name']} [{gender}]")
            if not args.fat_only:
                info = pd.fit_garment(bodies[gender], os.path.join(REPO, cfg['source']), gcfg, out)
                rep = validate(bodies[gender], out, gcfg)
                failures += not rep['ok']
                print(f"   -> {os.path.relpath(out, REPO)}  verts={info['verts']} faces={info['faces']}  ({time.time() - t0:.1f}s)")
                for line in rep['lines']:
                    print('   ' + line)
            # body-shape morph: same mesh fitted onto the fat body
            fcfg = dict(gcfg, **gcfg.get('fat', {}))  # optional overrides for the fat fit
            fat = pd.add_fat_morph(bodies[gender], fat_bodies[gender], out, fcfg)
            rep = validate(fat_bodies[gender], out, fcfg)
            failures += not rep['ok']
            print(f"   fat morph: max shift {fat['max_shift'] * 100:.1f}cm  ({time.time() - t0:.1f}s)")
            for line in rep['lines'][1:]:
                print('   [fat] ' + line)

    # Assets that are not fitted but must follow the body shape (hair, beard).
    for entry in conf.get('follow_body_shape', []):
        for gender in genders:
            if gender not in entry.get('genders', ['male', 'female']):
                continue
            for f in sorted(glob.glob(os.path.join(REPO, conf['output_dir'], entry['files'].format(gender=gender)))):
                r = pd.add_fat_morph(bodies[gender], fat_bodies[gender], f, {}, collide=False)
                print(f"== {os.path.relpath(f, REPO)}: fat morph max shift {r['max_shift'] * 100:.1f}cm")
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
