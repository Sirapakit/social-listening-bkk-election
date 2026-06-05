import sqlite3

import pandas as pd

conn = sqlite3.connect("./backend/seed/snapshots.db")
query = "SELECT * FROM tweets"

df = pd.read_sql(query, conn)
df.to_csv("results.csv", index=False)

print(df.columns)

conn.close()
