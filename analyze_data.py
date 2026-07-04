import json

def parse_duration(duration_str):
    if not duration_str or 'not available' in duration_str.lower():
        return 0
    duration_str = duration_str.strip().lower()
    
    if ':' in duration_str:
        parts = duration_str.split(':')
        parts = [p.strip() for p in parts if p.strip()]
        
        if len(parts) == 2:
            minutes = float(parts[0])
            seconds_str = parts[1].replace('min', '').strip()
            seconds = float(seconds_str) if seconds_str else 0
            return minutes + seconds/60
        elif len(parts) == 3:
            hours = float(parts[0])
            minutes = float(parts[1])
            seconds_str = parts[2].replace('min', '').strip()
            seconds = float(seconds_str) if seconds_str else 0
            return (hours * 60) + minutes + seconds/60
    else:
        import re
        match = re.search(r'(\d+(?:\.\d+)?)', duration_str)
        if match:
            return float(match.group(1))
    
    return 0

with open('server/data/tamil-dubbed.json', 'r') as f:
    data = json.load(f)

print("Analysis of Tamil Dubbed Movies:")
print(f"Total movies: {len(data)}")

high_duration = []
for i, entry in enumerate(data, 1):
    minutes = parse_duration(entry['duration'])
    if minutes > 40:
        high_duration.append((i, entry, minutes))

high_duration60 = []
for i, entry in enumerate(data, 1):
    minutes = parse_duration(entry['duration'])
    if minutes > 60:
        high_duration60.append((i, entry, minutes))

print(f"\nMovies > 40 min: {len(high_duration)} ({len(high_duration)/len(data)*100:.1f}%)")
for i, entry, minutes in high_duration[:15]:
    print(f"{i}: {entry.title} - {entry.duration} ({minutes:.1f} min)")

if len(high_duration) > 15:
    print(f"... and {len(high_duration) - 15} more")

print(f"\nMovies > 60 min: {len(high_duration60)} ({len(high_duration60)/len(data)*100:.1f}%)")

posters_with_http = 0
total_with_poster = 0

for entry in data:
    poster = entry.get('posterUrl', '')
    if poster:
        total_with_poster += 1
        if poster.startswith('http'):
            posters_with_http += 1

print(f"\nPoster Status:")
print(f"Posters available: {posters_with_http} of {total_with_poster}")
print(f"Missing or invalid: {len(data) - posters_with_http}")

bad_posters = []
for entry in data:
    poster = entry.get('posterUrl', '')
    if not poster or not poster.startswith('http'):
        bad_posters.append(entry)

print(f"\nSample movies with poster issues:")
for entry in bad_posters[:10]:
    print(f"  - {entry.title}: {entry.get('posterUrl', 'null')}")
