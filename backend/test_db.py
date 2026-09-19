from sqlalchemy import inspect, text
from database import engine  # change "database" to your models filename (without .py)

print("Connecting to:", engine.url.render_as_string(hide_password=True))

with engine.connect() as conn:
    print("Connected. SELECT 1 ->", conn.execute(text("SELECT 1")).scalar())

    tables = sorted(inspect(engine).get_table_names())
    print("\nTables found:", len(tables))
    for t in tables:
        count = conn.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar()
        print(f"  {t}: {count} rows")