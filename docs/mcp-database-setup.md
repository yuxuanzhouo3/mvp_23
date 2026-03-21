# MCP Database Setup

Use two MCP server entries so the AI layer can inspect real database structure instead of guessing:

- `supabase-db`
- `cloudbase`

Project example config:

- Copy [.cursor/mcp.json.example](/mnt/d/William/projects/mornscience/Mornstack/mornstack/.cursor/mcp.json.example) to `.cursor/mcp.json`
- Fill the required environment variables in [.env.example](/mnt/d/William/projects/mornscience/Mornstack/mornstack/.env.example)

Required env:

- `SUPABASE_DB_URL`
- `CLOUDBASE_MONGODB_URL`

Recommended related env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDBASE_ENV_ID`
- `CN_DATABASE_URL`

Notes:

- `supabase-db` uses a PostgreSQL-compatible MCP server entry.
- `cloudbase` uses a MongoDB-compatible MCP server entry.
- If your local MCP runtime uses different server package names, keep the same server ids and swap only the `command/args`.
- After enabling these two MCP entries, restart the IDE agent session so the AI can see the new database tools.
