// FTS5 Setup Script for JARVIS RAG
// Creates virtual FTS5 table + triggers to keep it in sync with Chunk table
// ~40 tokens, ~2s runtime

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function setupFTS5() {
  console.log("[FTS5] Setting up full-text search...");

  // 1. Create FTS5 virtual table
  await prisma.$executeRawUnsafe(
    `CREATE VIRTUAL TABLE IF NOT EXISTS ChunkFTS USING fts5(chunk_id, content, document_id, filename, tokenize='porter unicode61')`
  );
  console.log("[FTS5] Virtual table ChunkFTS created");

  // 2. Trigger: auto-index new chunks
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS chunk_fts_insert AFTER INSERT ON Chunk BEGIN
      INSERT INTO ChunkFTS(rowid, chunk_id, content, document_id, filename)
      SELECT NEW.id, NEW.id, NEW.content, NEW.documentId, d.filename
      FROM Document d WHERE d.id = NEW.documentId;
    END
  `);

  // 3. Trigger: remove deleted chunks from FTS
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS chunk_fts_delete AFTER DELETE ON Chunk BEGIN
      DELETE FROM ChunkFTS WHERE chunk_id = OLD.id;
    END
  `);

  // 4. Trigger: re-index updated chunks
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS chunk_fts_update AFTER UPDATE ON Chunk BEGIN
      DELETE FROM ChunkFTS WHERE chunk_id = OLD.id;
      INSERT INTO ChunkFTS(rowid, chunk_id, content, document_id, filename)
      SELECT NEW.id, NEW.id, NEW.content, NEW.documentId, d.filename
      FROM Document d WHERE d.id = NEW.documentId;
    END
  `);
  console.log("[FTS5] Triggers created (insert/delete/update)");

  // 5. Backfill: index all existing chunks
  const result = await prisma.$executeRawUnsafe(`
    INSERT OR IGNORE INTO ChunkFTS(rowid, chunk_id, content, document_id, filename)
    SELECT c.id, c.id, c.content, c.documentId, d.filename
    FROM Chunk c JOIN Document d ON d.id = c.documentId
  `);
  console.log(`[FTS5] Backfilled ${result} existing chunks`);

  // 6. Verify
  const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM ChunkFTS`);
  console.log(`[FTS5] Total indexed chunks: ${count[0].cnt}`);
  console.log("[FTS5] Setup complete!");
}

setupFTS5()
  .catch((e) => {
    console.error("[FTS5] Setup failed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());