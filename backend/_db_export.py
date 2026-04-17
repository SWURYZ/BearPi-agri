import pymysql
import json

conn = pymysql.connect(
    host='47.108.58.107', port=3306,
    user='root', password='c0765083cd3f57ab',
    database='dream6', charset='utf8mb4'
)
cur = conn.cursor()

# Get all tables
cur.execute('SHOW TABLES')
tables = [t[0] for t in cur.fetchall()]

result = {}
for table in tables:
    info = {'columns': [], 'indexes': [], 'create_sql': '', 'row_count': 0}
    
    # Column details
    cur.execute(f'DESCRIBE `{table}`')
    for row in cur.fetchall():
        info['columns'].append({
            'Field': row[0], 'Type': str(row[1], 'utf-8') if isinstance(row[1], bytes) else str(row[1]),
            'Null': row[2], 'Key': row[3], 'Default': str(row[4]) if row[4] is not None else None,
            'Extra': row[5]
        })
    
    # Indexes
    cur.execute(f'SHOW INDEX FROM `{table}`')
    idx_rows = cur.fetchall()
    for row in idx_rows:
        info['indexes'].append({
            'Key_name': row[2], 'Seq': row[3], 'Column': row[4], 'Non_unique': row[1]
        })
    
    # Create table SQL
    cur.execute(f'SHOW CREATE TABLE `{table}`')
    create_row = cur.fetchone()
    info['create_sql'] = create_row[1] if create_row else ''
    
    # Row count
    cur.execute(f'SELECT COUNT(*) FROM `{table}`')
    info['row_count'] = cur.fetchone()[0]
    
    # Sample data (up to 3 rows)
    cur.execute(f'SELECT * FROM `{table}` LIMIT 3')
    sample_cols = [desc[0] for desc in cur.description]
    sample_rows = []
    for row in cur.fetchall():
        sample_rows.append({col: (str(val) if val is not None else None) for col, val in zip(sample_cols, row)})
    info['sample_data'] = sample_rows
    
    result[table] = info

cur.close()
conn.close()

# Output
for table, info in result.items():
    print(f"\n{'='*80}")
    print(f"TABLE: {table}  (rows: {info['row_count']})")
    print(f"{'='*80}")
    print(f"\n--- Columns ---")
    for col in info['columns']:
        nullable = 'NULL' if col['Null'] == 'YES' else 'NOT NULL'
        key = f" [{col['Key']}]" if col['Key'] else ''
        default = f" DEFAULT {col['Default']}" if col['Default'] else ''
        extra = f" {col['Extra']}" if col['Extra'] else ''
        print(f"  {col['Field']:30s} {col['Type']:30s} {nullable:8s}{key}{default}{extra}")
    
    print(f"\n--- Indexes ---")
    idx_map = {}
    for idx in info['indexes']:
        name = idx['Key_name']
        if name not in idx_map:
            idx_map[name] = {'columns': [], 'unique': idx['Non_unique'] == 0}
        idx_map[name]['columns'].append(idx['Column'])
    for name, idx_info in idx_map.items():
        uq = 'UNIQUE ' if idx_info['unique'] else ''
        print(f"  {uq}{name}: ({', '.join(idx_info['columns'])})")
    
    print(f"\n--- CREATE TABLE ---")
    print(info['create_sql'])
    
    if info['sample_data']:
        print(f"\n--- Sample Data (up to 3 rows) ---")
        for i, row in enumerate(info['sample_data']):
            print(f"  Row {i+1}: {row}")
