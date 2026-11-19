import pathlib,re,json,sys
root=pathlib.Path(__file__).resolve().parents[1]
errors=[];checked=0
for file in root.glob('*.md'):
 for raw in re.findall(r'\]\(([^)]+)\)',file.read_text()):
  if '://' in raw:continue
  path,_,anchor=raw.partition('#');target=(file.parent/path) if path else file
  checked+=1
  if not target.exists():errors.append({'file':file.name,'target':raw,'error':'missing file'})
  elif anchor and target.suffix=='.md' and f'id="{anchor}"' not in target.read_text():errors.append({'file':file.name,'target':raw,'error':'missing explicit anchor'})
print(json.dumps({'checked':checked,'errors':errors},ensure_ascii=False,indent=2))
sys.exit(bool(errors))
