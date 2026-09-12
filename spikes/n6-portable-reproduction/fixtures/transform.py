"""Declared standard-library-only transformation of the synthetic survey."""
import csv
import json
from pathlib import Path

rows = list(csv.DictReader(Path('analysis/survey.csv').open(encoding='utf-8', newline='')))
ids = [int(row['participant_id']) for row in rows]
assert len(ids) == len(set(ids)), 'duplicate participant identity'
values = [int(row['score']) for row in rows if row['score'] != '']
Path('results').mkdir(exist_ok=True)
with Path('results/transformed.csv').open('w', encoding='utf-8', newline='') as output:
    writer = csv.DictWriter(output, fieldnames=['participant_id', 'group', 'score'])
    writer.writeheader()
    writer.writerows(rows)
Path('results/python.json').write_text(json.dumps({
    'participantIds': ids, 'rowCount': len(rows), 'validCount': len(values),
    'missingCount': len(rows) - len(values), 'sum': sum(values)
}, sort_keys=True), encoding='utf-8')
