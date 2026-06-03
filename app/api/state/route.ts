import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_ID = "main";

function findDatabaseUrlBySuffix() {
  const preferredSuffixes = [
    "_DATABASE_URL",
    "_POSTGRES_URL",
    "_POSTGRES_PRISMA_URL",
    "_POSTGRES_URL_NON_POOLING",
    "_DATABASE_URL_UNPOOLED"
  ];

  for (const suffix of preferredSuffixes) {
    const match = Object.entries(process.env).find(([key, value]) => key.endsWith(suffix) && value);
    if (match?.[1]) return match[1];
  }

  return undefined;
}

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.michofererp_DATABASE_URL ||
    process.env.michofererp_POSTGRES_URL ||
    process.env.michofererp_POSTGRES_PRISMA_URL ||
    process.env.michofererp_POSTGRES_URL_NON_POOLING ||
    process.env.michofererp_DATABASE_URL_UNPOOLED ||
    findDatabaseUrlBySuffix()
  );
}

function getSql() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no esta configurada.");
  }

  return neon(databaseUrl);
}

async function ensureStateTable(sql: ReturnType<typeof getSql>) {
  await sql`
    CREATE TABLE IF NOT EXISTS mi_chofer_state (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function GET() {
  try {
    const sql = getSql();
    await ensureStateTable(sql);

    const rows = await sql`
      SELECT data, updated_at
      FROM mi_chofer_state
      WHERE id = ${STATE_ID}
      LIMIT 1
    `;

    return NextResponse.json({
      data: rows[0]?.data ?? null,
      updatedAt: rows[0]?.updated_at ?? null
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo leer la base de datos."
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const data = body?.data ?? body;
    const sql = getSql();

    await ensureStateTable(sql);
    await sql`
      INSERT INTO mi_chofer_state (id, data, updated_at)
      VALUES (${STATE_ID}, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo guardar en la base de datos."
      },
      { status: 500 }
    );
  }
}
