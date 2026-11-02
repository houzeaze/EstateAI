"""Builds the schema description that is sent to Gemini."""

LEGACY_RELATIONSHIPS = {
    "bookings.lead_id = leads.id",
    "bookings.property_id = properties.id",
    "leads.telecaller_id = telecallers.id",
    "leads.property_id = properties.id",
}


def get_database_schema(db) -> str:
    """Return a text description of every table in the public schema."""
    column_rows = db.execute("""
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    """).fetchall()

    # Keys come from pg_catalog because information_schema hides
    # constraints from users that only have SELECT rights.
    pk_rows = db.execute("""
        SELECT c.conrelid::regclass::text AS table_name,
               a.attname AS column_name
        FROM pg_constraint c
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'p'
          AND c.connamespace = 'public'::regnamespace
    """).fetchall()

    fk_rows = db.execute("""
        SELECT c.conrelid::regclass::text AS table_name,
               a.attname  AS column_name,
               c.confrelid::regclass::text AS ref_table,
               af.attname AS ref_column
        FROM pg_constraint c
        JOIN LATERAL unnest(c.conkey, c.confkey) AS k(attnum, fattnum) ON true
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        JOIN pg_attribute af
          ON af.attrelid = c.confrelid AND af.attnum = k.fattnum
        WHERE c.contype = 'f'
          AND c.connamespace = 'public'::regnamespace
    """).fetchall()

    primary_keys = {(r["table_name"], r["column_name"]) for r in pk_rows}

    tables: dict[str, list[str]] = {}
    for row in column_rows:
        details = f"{row['column_name']} ({row['data_type']})"
        if (row["table_name"], row["column_name"]) in primary_keys:
            details += ", PRIMARY KEY"
        tables.setdefault(row["table_name"], []).append(details)

    schema_parts = [
        f"Table {name}: " + ", ".join(columns)
        for name, columns in sorted(tables.items())
    ]

    relationships = {
        f"{r['table_name']}.{r['column_name']} = "
        f"{r['ref_table']}.{r['ref_column']}"
        for r in fk_rows
    }

    # Add the known relationships when both tables exist.
    for relationship in LEGACY_RELATIONSHIPS:
        left, right = relationship.split(" = ")
        if (
            left.split(".", 1)[0] in tables
            and right.split(".", 1)[0] in tables
        ):
            relationships.add(relationship)

    schema_parts.append("Relationships:")
    if relationships:
        schema_parts.extend(f"- {r}" for r in sorted(relationships))
    else:
        schema_parts.append("- No declared relationships discovered.")

    return "\n".join(schema_parts)
