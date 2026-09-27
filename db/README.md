Database schema for NexusVPN

Files:
- schema.sql — SQL script that creates the `nexus_vpn` database and required tables (users, plans, subscriptions, payments, teams).

Import instructions (MySQL / MariaDB):

1. From the repository root run:

```bash
mysql -u root -p < db/schema.sql
```

2. Or open the file in a DB client (Sequel Pro, MySQL Workbench) and run the script.

Notes:
- Passwords should be stored hashed (the `users.password` column expects a hashed string).
- Prices are stored as integers (smallest currency unit recommended). Adjust if you prefer decimals.
- `plans.features` is JSON to allow flexible feature lists.
- If you want Laravel migrations instead, I can convert this schema into migration files for the `nexus-vpn` app.
