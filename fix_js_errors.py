import glob

html_files = glob.glob('**/*.html', recursive=True)
count = 0
for filepath in html_files:
    if 'venv' in filepath or '.venv' in filepath:
        continue
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        modified = False
        # Fix Chart.js CDN mismatch
        if 'https://cdn.jsdelivr.net/npm/chart.js' in content and 'chart.umd.min.js' not in content:
            content = content.replace('https://cdn.jsdelivr.net/npm/chart.js', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js')
            modified = True
            
        # Remove session_guard.js
        lines = content.split('\n')
        new_lines = []
        for line in lines:
            if 'session_guard.js' in line:
                modified = True
            else:
                new_lines.append(line)
                
        if modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write('\n'.join(new_lines))
            print(f'Corregido: {filepath}')
            count += 1
    except Exception as e:
        print(f'Error en {filepath}: {e}')

print(f'\nTotal archivos corregidos: {count}')
